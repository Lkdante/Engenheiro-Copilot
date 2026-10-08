@echo off
chcp 65001 >nul
title Engenheiro de Campo IA - Frontend
cd /d "%~dp0frontend"

where node >nul 2>nul || (echo ERRO: instale o Node.js 22 LTS em nodejs.org & pause & exit /b 1)

if not exist ".env" copy ".env.example" ".env" >nul

rem Verifica se o Expo instalado e o SDK 57; se nao for, reinstala do zero
node -e "try{process.exit(require('./node_modules/expo/package.json').version.startsWith('57.')?0:1)}catch(e){process.exit(1)}"
if errorlevel 1 goto install
goto start

:install
echo.
echo Instalando dependencias do Expo SDK 57 - pode demorar alguns minutos...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del /q "package-lock.json"
call npm install
if errorlevel 1 call npm install --legacy-peer-deps
if errorlevel 1 (echo ERRO no npm install. Copie a mensagem acima e envie. & pause & exit /b 1)

:start
for /f %%v in ('node -p "require('./node_modules/expo/package.json').version"') do echo Expo instalado: %%v
echo.
echo App web: http://localhost:8081  -  no celular, leia o QR code com o Expo Go
call npx expo start --clear
pause
