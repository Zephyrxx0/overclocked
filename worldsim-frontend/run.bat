@echo off
REM Run the WorldSim frontend

echo Installing dependencies...
call npm install

echo Starting development server on http://localhost:3000
call npm run dev
