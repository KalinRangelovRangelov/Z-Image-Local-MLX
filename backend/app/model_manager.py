import asyncio
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, Optional
from concurrent.futures import ThreadPoolExecutor

from .config import AVAILABLE_MODELS, MODELS_DIR


class ModelState(str, Enum):
    NOT_DOWNLOADED = "not_downloaded"
    DOWNLOADING = "downloading"
    DOWNLOADED = "downloaded"
    LOADING = "loading"
    READY = "ready"
    ERROR = "error"


@dataclass
class DownloadProgress:
    total_size: int = 0
    downloaded_size: int = 0
    current_file: str = ""
    files_completed: int = 0
    total_files: int = 0
    speed: float = 0.0
    eta: float = 0.0
    percent: float = 0.0


@dataclass
class ModelStatus:
    model_id: str
    state: ModelState = ModelState.NOT_DOWNLOADED
    progress: DownloadProgress = field(default_factory=DownloadProgress)
    error: Optional[str] = None


class ModelManager:
    def __init__(self):
        self.models: dict[str, ModelStatus] = {}
        self.pipelines: dict[str, any] = {}
        self.current_model: Optional[str] = None
        self._async_callbacks: list[Callable] = []
        self._lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._executor = ThreadPoolExecutor(max_workers=2)
        self._init_models()

    def _init_models(self):
        """Initialize model status for all available models."""
        for model_id in AVAILABLE_MODELS:
            # MFLUX models are cached by huggingface_hub
            # Check if the model is already cached
            state = ModelState.NOT_DOWNLOADED
            try:
                from huggingface_hub import scan_cache_dir
                cache_info = scan_cache_dir()
                model_info = AVAILABLE_MODELS[model_id]
                repo_name = model_info["repo"]
                for repo in cache_info.repos:
                    if repo.repo_id == repo_name:
                        state = ModelState.DOWNLOADED
                        break
            except Exception:
                pass
            self.models[model_id] = ModelStatus(model_id=model_id, state=state)

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the event loop for async callbacks."""
        self._loop = loop

    def add_async_callback(self, callback: Callable):
        """Add an async callback for progress updates."""
        self._async_callbacks.append(callback)

    def _notify_progress(self, model_id: str):
        """Notify all callbacks about progress update."""
        status = self.get_model_status(model_id)
        if status is None:
            return

        if self._loop and self._async_callbacks:
            for callback in self._async_callbacks:
                try:
                    if self._loop.is_running():
                        asyncio.run_coroutine_threadsafe(
                            callback(model_id, status),
                            self._loop
                        )
                except Exception as e:
                    print(f"Async callback error: {e}")

    def get_model_status(self, model_id: str) -> Optional[ModelStatus]:
        """Get status of a specific model."""
        return self.models.get(model_id)

    def get_all_status(self) -> dict[str, ModelStatus]:
        """Get status of all models."""
        return self.models.copy()

    def is_model_ready(self, model_id: str) -> bool:
        """Check if a model is ready for inference."""
        status = self.models.get(model_id)
        return status is not None and status.state == ModelState.READY

    async def download_model(self, model_id: str) -> bool:
        """Download a model - MFLUX handles this automatically on first load."""
        if model_id not in AVAILABLE_MODELS:
            return False

        # For MFLUX, downloading happens during loading
        # We just mark it as ready to load
        with self._lock:
            self.models[model_id].state = ModelState.DOWNLOADED
            self.models[model_id].progress.percent = 100.0
        self._notify_progress(model_id)
        return True

    async def load_model(self, model_id: str) -> bool:
        """Load a model into memory using MFLUX."""
        if model_id not in AVAILABLE_MODELS:
            return False

        # Already loaded
        if model_id in self.pipelines:
            self.current_model = model_id
            with self._lock:
                self.models[model_id].state = ModelState.READY
            self._notify_progress(model_id)
            return True

        with self._lock:
            self.models[model_id].state = ModelState.LOADING
        self._notify_progress(model_id)

        try:
            model_info = AVAILABLE_MODELS[model_id]

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self._loop = loop

            pipeline = await loop.run_in_executor(
                self._executor,
                lambda: self._load_mflux_pipeline(model_info)
            )

            self.pipelines[model_id] = pipeline
            self.current_model = model_id

            with self._lock:
                self.models[model_id].state = ModelState.READY
            self._notify_progress(model_id)
            return True

        except Exception as e:
            import traceback
            traceback.print_exc()
            with self._lock:
                self.models[model_id].state = ModelState.ERROR
                self.models[model_id].error = str(e)
            self._notify_progress(model_id)
            return False

    def _load_mflux_pipeline(self, model_info: dict):
        """Load the MFLUX Z-Image Turbo pipeline."""
        from mflux.models.z_image.variants.turbo.z_image_turbo import ZImageTurbo

        quantize = model_info.get("quantize", 4)
        print(f"[Z-Image] Loading Z-Image Turbo with {quantize}-bit quantization...")

        # Load the model with quantization
        pipeline = ZImageTurbo(
            quantize=quantize,
        )

        print(f"[Z-Image] Z-Image Turbo loaded successfully")
        return pipeline

    def unload_model(self, model_id: str):
        """Unload a model from memory."""
        if model_id in self.pipelines:
            del self.pipelines[model_id]
            if self.current_model == model_id:
                self.current_model = None

            with self._lock:
                self.models[model_id].state = ModelState.DOWNLOADED
            self._notify_progress(model_id)

            # Force garbage collection
            import gc
            gc.collect()

    def get_pipeline(self, model_id: str):
        """Get a loaded pipeline."""
        return self.pipelines.get(model_id)

    def generate_image(self, model_id: str, prompt: str, width: int, height: int,
                       steps: int, guidance: float, seed: Optional[int] = None):
        """Generate an image using MFLUX Z-Image Turbo."""
        pipeline = self.pipelines.get(model_id)
        if pipeline is None:
            raise RuntimeError(f"Model {model_id} is not loaded")

        import random
        if seed is None:
            seed = random.randint(0, 2**32 - 1)

        print(f"[Z-Image] Generating image: {prompt[:50]}... (seed={seed})")

        # Generate image - returns a GeneratedImage object
        result = pipeline.generate_image(
            seed=seed,
            prompt=prompt,
            num_inference_steps=steps,
            height=height,
            width=width,
        )

        # Return the PIL image from the GeneratedImage wrapper
        return result.image, seed


# Global model manager instance
model_manager = ModelManager()
