@echo off
chcp 65001 >nul
rem Libera a porta 8000 (backend) e 8081 (Expo) no Firewall do Windows para o celular acessar o PC.
net session >nul 2>&1
if errorlevel 1 (
  echo Pedindo permissao de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="Engenheiro Copilot - Backend 8000" >nul 2>&1
netsh advfirewall firewall delete rule name="Engenheiro Copilot - Expo 8081" >nul 2>&1
netsh advfirewall firewall add rule name="Engenheiro Copilot - Backend 8000" dir=in action=allow protocol=TCP localport=8000 profile=private,public
netsh advfirewall firewall add rule name="Engenheiro Copilot - Expo 8081" dir=in action=allow protocol=TCP localport=8081 profile=private,public
echo.
echo Portas 8000 e 8081 liberadas. Seu IP na rede:
ipconfig | findstr /i "IPv4"
echo.
pause
