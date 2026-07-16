@echo off
title SpeakWell
echo ================================
echo  Starting SpeakWell App...
echo ================================
echo.

echo [1/2] Starting Backend on port 8000...
start "SpeakWell Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\uvicorn.exe main:app --reload --port 8000"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend on port 5173...
start "SpeakWell Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================
echo  App starting in two windows!
echo  Open: http://localhost:5173
echo ================================
echo.
timeout /t 4 /nobreak > nul
start "" http://localhost:5173
