import asyncio
import base64
import io
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from PIL import Image

from .config import (
    AVAILABLE_MODELS,
    DEFAULT_GUIDANCE,
    DEFAULT_HEIGHT,
    DEFAULT_STEPS,
    DEFAULT_WIDTH,
    DEVICE,
    OUTPUTS_DIR,
    UPLOADS_DIR,
)
from .model_manager import ModelState, model_manager

app = FastAPI(title="Z-Image API (MFLUX)", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connections for real-time updates
connected_clients: set[WebSocket] = set()


class GenerationRequest(BaseModel):
    prompt: str
    model_id: str = "z-image-turbo-4bit"
    width: int = Field(default=DEFAULT_WIDTH, ge=256, le=2048)
    height: int = Field(default=DEFAULT_HEIGHT, ge=256, le=2048)
    num_inference_steps: int = Field(default=DEFAULT_STEPS, ge=1, le=50)
    guidance_scale: float = Field(default=DEFAULT_GUIDANCE, ge=0.0, le=20.0)
    seed: Optional[int] = None
    negative_prompt: Optional[str] = None


class GenerationResponse(BaseModel):
    image_id: str
    image_url: str
    image_base64: Optional[str] = None
    prompt: str
    model_id: str
    width: int
    height: int
    seed: int
    generation_time: float


async def broadcast_message(message: dict):
    """Broadcast a message to all connected WebSocket clients."""
    if not connected_clients:
        return

    message_str = json.dumps(message, default=str)
    disconnected = set()

    for client in connected_clients:
        try:
            await client.send_text(message_str)
        except Exception:
            disconnected.add(client)

    for client in disconnected:
        connected_clients.discard(client)


async def progress_callback(model_id: str, status):
    """Async callback for model download/load progress."""
    await broadcast_message({
        "type": "model_status",
        "model_id": model_id,
        "state": status.state.value,
        "progress": {
            "total_size": status.progress.total_size,
            "downloaded_size": status.progress.downloaded_size,
            "current_file": status.progress.current_file,
            "files_completed": status.progress.files_completed,
            "total_files": status.progress.total_files,
            "speed": status.progress.speed,
            "eta": status.progress.eta,
            "percent": status.progress.percent,
        },
        "error": status.error,
    })


@app.on_event("startup")
async def startup_event():
    """Set up the event loop for the model manager."""
    loop = asyncio.get_event_loop()
    model_manager.set_event_loop(loop)
    model_manager.add_async_callback(progress_callback)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Z-Image API (MFLUX)", "version": "2.0.0", "backend": "MLX"}


@app.get("/api/system")
async def get_system_info():
    """Get system information."""
    import platform

    return {
        "device": DEVICE,
        "cuda_available": False,
        "mps_available": True,
        "gpu_info": {
            "name": f"Apple {platform.processor() or 'Silicon'}",
            "memory_total": 0,
            "memory_allocated": 0,
            "memory_cached": 0,
        },
        "torch_version": "MLX",
    }


@app.get("/api/models")
async def get_models():
    """Get list of available models and their status."""
    models = []
    for model_id, model_info in AVAILABLE_MODELS.items():
        status = model_manager.get_model_status(model_id)
        models.append({
            "id": model_id,
            "name": model_info["name"],
            "description": model_info["description"],
            "recommended_steps": model_info["recommended_steps"],
            "recommended_guidance": model_info["recommended_guidance"],
            "size_gb": model_info.get("size_gb", 0),
            "state": status.state.value if status else "unknown",
            "progress": {
                "total_size": status.progress.total_size if status else 0,
                "downloaded_size": status.progress.downloaded_size if status else 0,
                "current_file": status.progress.current_file if status else "",
                "files_completed": status.progress.files_completed if status else 0,
                "total_files": status.progress.total_files if status else 0,
                "speed": status.progress.speed if status else 0,
                "eta": status.progress.eta if status else 0,
                "percent": status.progress.percent if status else 0,
            } if status else None,
            "error": status.error if status else None,
            "is_current": model_manager.current_model == model_id,
        })
    return {"models": models}


@app.get("/api/models/{model_id}")
async def get_model(model_id: str):
    """Get status of a specific model."""
    if model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    model_info = AVAILABLE_MODELS[model_id]
    status = model_manager.get_model_status(model_id)

    return {
        "id": model_id,
        "name": model_info["name"],
        "description": model_info["description"],
        "recommended_steps": model_info["recommended_steps"],
        "recommended_guidance": model_info["recommended_guidance"],
        "state": status.state.value if status else "unknown",
        "progress": {
            "total_size": status.progress.total_size if status else 0,
            "downloaded_size": status.progress.downloaded_size if status else 0,
            "current_file": status.progress.current_file if status else "",
            "files_completed": status.progress.files_completed if status else 0,
            "total_files": status.progress.total_files if status else 0,
            "speed": status.progress.speed if status else 0,
            "eta": status.progress.eta if status else 0,
            "percent": status.progress.percent if status else 0,
        } if status else None,
        "error": status.error if status else None,
        "is_current": model_manager.current_model == model_id,
    }


@app.post("/api/models/{model_id}/download")
async def download_model(model_id: str):
    """Start downloading a model."""
    if model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    status = model_manager.get_model_status(model_id)
    if status and status.state == ModelState.DOWNLOADING:
        return {"message": "Download already in progress", "model_id": model_id}

    # For MFLUX, download happens during load
    asyncio.create_task(model_manager.download_model(model_id))

    return {"message": "Model ready for loading", "model_id": model_id}


@app.post("/api/models/{model_id}/load")
async def load_model(model_id: str):
    """Load a model into memory."""
    if model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    status = model_manager.get_model_status(model_id)
    if status and status.state == ModelState.LOADING:
        return {"message": "Model is already loading", "model_id": model_id}

    if status and status.state == ModelState.READY:
        return {"message": "Model is already loaded", "model_id": model_id}

    # Start loading in background
    asyncio.create_task(model_manager.load_model(model_id))

    return {"message": "Loading started", "model_id": model_id}


@app.post("/api/models/{model_id}/unload")
async def unload_model(model_id: str):
    """Unload a model from memory."""
    if model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    model_manager.unload_model(model_id)

    return {"message": "Model unloaded", "model_id": model_id}


@app.post("/api/generate", response_model=GenerationResponse)
async def generate_image(request: GenerationRequest):
    """Generate an image from a prompt."""
    # Check if model is ready
    if not model_manager.is_model_ready(request.model_id):
        status = model_manager.get_model_status(request.model_id)
        if status:
            if status.state == ModelState.NOT_DOWNLOADED:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model {request.model_id} is not downloaded. Please load it first."
                )
            elif status.state == ModelState.DOWNLOADING:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model {request.model_id} is still downloading."
                )
            elif status.state == ModelState.LOADING:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model {request.model_id} is still loading."
                )
            elif status.state == ModelState.ERROR:
                raise HTTPException(
                    status_code=500,
                    detail=f"Model {request.model_id} has an error: {status.error}"
                )
        raise HTTPException(
            status_code=400,
            detail=f"Model {request.model_id} is not ready."
        )

    # Broadcast generation start
    await broadcast_message({
        "type": "generation_start",
        "prompt": request.prompt,
        "model_id": request.model_id,
    })

    try:
        import time
        start_time = time.time()

        # Generate image using MFLUX
        loop = asyncio.get_event_loop()
        image, seed = await loop.run_in_executor(
            None,
            lambda: model_manager.generate_image(
                model_id=request.model_id,
                prompt=request.prompt,
                width=request.width,
                height=request.height,
                steps=request.num_inference_steps,
                guidance=request.guidance_scale,
                seed=request.seed,
            )
        )

        generation_time = time.time() - start_time

        # Save image
        image_id = str(uuid.uuid4())
        image_filename = f"{image_id}.png"
        image_path = OUTPUTS_DIR / image_filename
        image.save(str(image_path))

        # Convert to base64
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()

        response = GenerationResponse(
            image_id=image_id,
            image_url=f"/api/images/{image_id}",
            image_base64=image_base64,
            prompt=request.prompt,
            model_id=request.model_id,
            width=request.width,
            height=request.height,
            seed=seed,
            generation_time=generation_time,
        )

        # Broadcast generation complete
        await broadcast_message({
            "type": "generation_complete",
            "image_id": image_id,
            "prompt": request.prompt,
            "generation_time": generation_time,
        })

        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        await broadcast_message({
            "type": "generation_error",
            "error": str(e),
        })
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate/img2img")
async def generate_img2img(
    prompt: str = Form(...),
    image: UploadFile = File(...),
    model_id: str = Form(default="z-image-turbo-4bit"),
    num_inference_steps: int = Form(default=DEFAULT_STEPS),
    image_strength: float = Form(default=0.7),
    seed: Optional[int] = Form(default=None),
):
    """Generate an image from a reference image and prompt."""
    # Check if model is ready
    if not model_manager.is_model_ready(model_id):
        status = model_manager.get_model_status(model_id)
        if status:
            if status.state == ModelState.NOT_DOWNLOADED:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model {model_id} is not downloaded. Please load it first."
                )
            elif status.state == ModelState.LOADING:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model {model_id} is still loading."
                )
            elif status.state == ModelState.ERROR:
                raise HTTPException(
                    status_code=500,
                    detail=f"Model {model_id} has an error: {status.error}"
                )
        raise HTTPException(
            status_code=400,
            detail=f"Model {model_id} is not ready."
        )

    # Save uploaded image temporarily
    upload_id = str(uuid.uuid4())
    upload_path = UPLOADS_DIR / f"{upload_id}.png"

    try:
        # Read and save uploaded image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        pil_image.save(str(upload_path))

        # Get dimensions from uploaded image
        width, height = pil_image.size

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    # Broadcast generation start
    await broadcast_message({
        "type": "generation_start",
        "prompt": prompt,
        "model_id": model_id,
    })

    try:
        import time
        start_time = time.time()

        # Generate image using MFLUX with reference image
        loop = asyncio.get_event_loop()
        result_image, result_seed = await loop.run_in_executor(
            None,
            lambda: model_manager.generate_image(
                model_id=model_id,
                prompt=prompt,
                width=width,
                height=height,
                steps=num_inference_steps,
                guidance=0.0,
                seed=seed,
                image_path=str(upload_path),
                image_strength=image_strength,
            )
        )

        generation_time = time.time() - start_time

        # Save generated image
        image_id = str(uuid.uuid4())
        image_filename = f"{image_id}.png"
        output_path = OUTPUTS_DIR / image_filename
        result_image.save(str(output_path))

        # Convert to base64
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()

        # Clean up uploaded file
        upload_path.unlink(missing_ok=True)

        response = GenerationResponse(
            image_id=image_id,
            image_url=f"/api/images/{image_id}",
            image_base64=image_base64,
            prompt=prompt,
            model_id=model_id,
            width=width,
            height=height,
            seed=result_seed,
            generation_time=generation_time,
        )

        # Broadcast generation complete
        await broadcast_message({
            "type": "generation_complete",
            "image_id": image_id,
            "prompt": prompt,
            "generation_time": generation_time,
        })

        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        # Clean up uploaded file on error
        upload_path.unlink(missing_ok=True)
        await broadcast_message({
            "type": "generation_error",
            "error": str(e),
        })
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/images/{image_id}")
async def get_image(image_id: str):
    """Get a generated image."""
    image_path = OUTPUTS_DIR / f"{image_id}.png"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path, media_type="image/png")


@app.get("/api/images")
async def list_images():
    """List all generated images."""
    images = []
    for image_path in OUTPUTS_DIR.glob("*.png"):
        image_id = image_path.stem
        stat = image_path.stat()
        images.append({
            "id": image_id,
            "url": f"/api/images/{image_id}",
            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "size": stat.st_size,
        })

    # Sort by creation time, newest first
    images.sort(key=lambda x: x["created_at"], reverse=True)
    return {"images": images}


@app.delete("/api/images/{image_id}")
async def delete_image(image_id: str):
    """Delete a generated image."""
    image_path = OUTPUTS_DIR / f"{image_id}.png"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    image_path.unlink()
    return {"message": "Image deleted", "image_id": image_id}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        # Send initial state
        models_status = []
        for model_id, model_info in AVAILABLE_MODELS.items():
            status = model_manager.get_model_status(model_id)
            models_status.append({
                "model_id": model_id,
                "state": status.state.value if status else "unknown",
                "progress": {
                    "total_size": status.progress.total_size if status else 0,
                    "downloaded_size": status.progress.downloaded_size if status else 0,
                    "files_completed": status.progress.files_completed if status else 0,
                    "total_files": status.progress.total_files if status else 0,
                    "percent": status.progress.percent if status else 0,
                } if status else None,
            })

        await websocket.send_text(json.dumps({
            "type": "initial_state",
            "models": models_status,
            "current_model": model_manager.current_model,
        }))

        # Keep connection alive and handle messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                message = json.loads(data)

                # Handle ping
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_text(json.dumps({"type": "heartbeat"}))

    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(websocket)


# Serve static files for frontend (production)
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
