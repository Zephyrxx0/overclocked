@echo off
REM Run the WorldSim backend server

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -q -r requirements.txt

REM Run server
echo Starting WorldSim server on http://localhost:8000
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
