import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent.parent
MODELS_DIR = BASE_DIR / "models"
OUTPUTS_DIR = BASE_DIR / "outputs"
UPLOADS_DIR = BASE_DIR / "uploads"

# Create directories if they don't exist
MODELS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

# Available models - MFLUX versions for Apple Silicon
AVAILABLE_MODELS = {
    "z-image-turbo-4bit": {
        "id": "z-image-turbo-4bit",
        "name": "Z-Image Turbo (4-bit MLX)",
        "repo": "filipstrand/Z-Image-Turbo-mflux-4bit",
        "description": "6B model quantized to 4-bit for Apple Silicon. ~6GB memory, fast inference.",
        "recommended_steps": 8,
        "recommended_guidance": 0.0,
        "size_gb": 6,
        "quantize": 4,
    },
}

# Default generation settings
DEFAULT_WIDTH = 1024
DEFAULT_HEIGHT = 1024
DEFAULT_STEPS = 8
DEFAULT_GUIDANCE = 0.0

# Device - MFLUX uses MLX which auto-detects Apple Silicon
DEVICE = "mlx"

print(f"[Z-Image] Using MFLUX with MLX backend")
