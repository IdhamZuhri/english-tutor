@echo off
title SpeakWell Backend
echo ================================
echo  SpeakWell Backend - Port 8000
echo ================================
echo.
cd /d %~dp0
venv\Scripts\uvicorn.exe main:app --reload --port 8000
pause
