@echo off
cd /d "%~dp0"
start "Backend" cmd /k start-backend.bat
timeout /t 5 >nul
start "Frontend" cmd /k start-frontend.bat
