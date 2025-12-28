#!/bin/bash

# Z-Image Stop Script - Kill all running instances

echo "🛑 Stopping Z-Image..."

# Kill backend (uvicorn/python running on port 8000)
BACKEND_PIDS=$(lsof -ti:8000 2>/dev/null)
if [ -n "$BACKEND_PIDS" ]; then
    echo "  Stopping backend (PIDs: $BACKEND_PIDS)..."
    echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null
    echo "  ✓ Backend stopped"
else
    echo "  Backend not running"
fi

# Kill frontend (vite running on port 5173)
FRONTEND_PIDS=$(lsof -ti:5173 2>/dev/null)
if [ -n "$FRONTEND_PIDS" ]; then
    echo "  Stopping frontend (PIDs: $FRONTEND_PIDS)..."
    echo "$FRONTEND_PIDS" | xargs kill -9 2>/dev/null
    echo "  ✓ Frontend stopped"
else
    echo "  Frontend not running"
fi

# Also kill any orphaned processes by name
pkill -f "uvicorn.*app.main:app" 2>/dev/null
pkill -f "vite.*frontend" 2>/dev/null

echo ""
echo "✅ All Z-Image processes stopped"
