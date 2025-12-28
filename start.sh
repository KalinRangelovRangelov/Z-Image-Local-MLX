#!/bin/bash

# Z-Image Local Installation Startup Script

set -e

echo "🚀 Starting Z-Image..."

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the Z-Image root directory"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "📦 Starting backend server..."
cd backend

if [ ! -d "venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Check if dependencies are installed
if ! python -c "import mflux" 2>/dev/null; then
    echo "  Installing backend dependencies..."
    pip install -r requirements.txt
fi

python run.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "  Waiting for backend to start..."
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "  Installing frontend dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Z-Image is running!"
echo ""
echo "   🌐 Frontend: http://localhost:5173"
echo "   🔧 Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait
