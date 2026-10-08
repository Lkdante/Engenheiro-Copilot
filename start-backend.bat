@echo off
chcp 65001 >nul
title Engenheiro de Campo IA - Backend
cd /d "%~dp0backend"

where py >nul 2>nul && (set PY=py -3) || (set PY=python)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Criando ambiente Python...
  %PY% -m venv .venv || (echo ERRO: instale o Python 3.10+ em python.org e marque "Add to PATH". & pause & exit /b 1)
)
echo [2/3] Instalando dependencias...
".venv\Scripts\python.exe" -m pip install -q --upgrade pip
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt || (echo ERRO ao instalar dependencias. & pause & exit /b 1)

if not exist ".env" copy ".env.example" ".env" >nul

echo [3/3] Backend em http://localhost:8000  - docs em http://localhost:8000/docs
".venv\Scripts\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
pause
