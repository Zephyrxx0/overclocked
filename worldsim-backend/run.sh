#!/usr/bin/env bash
# Run the WorldSim backend server

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Run server
echo "Starting WorldSim server on http://localhost:8000"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
