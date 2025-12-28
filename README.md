# Z-Image Local MLX

Local image generation using Z-Image Turbo with MFLUX (native MLX backend for Apple Silicon).

## Features

- **Z-Image Turbo 4-bit**: Alibaba's 6B parameter image model, quantized for efficiency
- **Native MLX**: Optimized for Apple Silicon (M1/M2/M3/M4)
- **Low Memory**: ~6GB unified memory usage (vs 19GB for full precision)
- **Fast Inference**: 8 steps, typically 15-30 seconds per image
- **Modern UI**: React + TypeScript frontend with real-time updates
- **WebSocket**: Live progress updates during model loading

## Requirements

- macOS with Apple Silicon (M1/M2/M3/M4)
- Python 3.11+
- Node.js 18+
- ~6GB free memory for inference

## Quick Start

```bash
# Clone the repository
git clone git@github.com:KalinRangelovRangelov/Z-Image-Local-MLX.git
cd Z-Image-Local-MLX

# Start everything (installs dependencies automatically)
./start.sh
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## Manual Installation

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Open http://localhost:5173
2. Click **Load Model** (downloads ~6GB on first run)
3. Enter a prompt and click **Generate**

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── config.py       # Model configuration
│   │   ├── main.py         # FastAPI application
│   │   └── model_manager.py # MFLUX model handling
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── api.ts          # API client
│   │   ├── store.ts        # Zustand store
│   │   └── types.ts        # TypeScript types
│   └── package.json
├── start.sh                # Start all servers
└── stop.sh                 # Stop all servers
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system` | System info (device, memory) |
| GET | `/api/models` | List available models |
| POST | `/api/models/{id}/load` | Load model into memory |
| POST | `/api/generate` | Generate an image |
| GET | `/api/images` | List generated images |
| GET | `/api/images/{id}` | Get specific image |
| WS | `/ws` | WebSocket for real-time updates |

## Generation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `prompt` | required | Text description of the image |
| `width` | 1024 | Image width (256-2048) |
| `height` | 1024 | Image height (256-2048) |
| `num_inference_steps` | 8 | Number of denoising steps |
| `guidance_scale` | 0.0 | CFG scale (0 for Z-Image-Turbo) |
| `seed` | random | Random seed for reproducibility |

## Model Info

**Z-Image Turbo** is a 6B parameter text-to-image model from Alibaba Tongyi Lab:
- Excellent text rendering (English & Chinese)
- 8 inference steps
- 1024x1024 default resolution
- No guidance scale needed (set to 0)

## Credits

- [Z-Image](https://github.com/Tongyi-MAI/Z-Image) by Tongyi-MAI (Alibaba)
- [MFLUX](https://github.com/filipstrand/mflux) by Filip Strand
- [4-bit Quantized Model](https://huggingface.co/filipstrand/Z-Image-Turbo-mflux-4bit)

## License

MIT
