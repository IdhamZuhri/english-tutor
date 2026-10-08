@echo off
title SpeakWell
cd /d "%~dp0"
if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  call npm.cmd --prefix frontend install
  if errorlevel 1 goto failed
)
echo Building SpeakWell...
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Open http://localhost:8000 in your browser.
start "" http://localhost:8000
call npm.cmd start
goto end
:failed
echo SpeakWell could not start. See the error above.
pause
:end
