@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ========================================================
echo                 GITFLOW BOOTSTRAPPER 🚀
echo ========================================================

echo 0. Cleaning old GitFlow and Ngrok processes...
for /f "tokens=2 delims=," %%P in ('tasklist /FI "IMAGENAME eq ngrok.exe" /FO CSV /NH 2^>NUL') do (
	taskkill /F /PID %%~P >NUL 2>&1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'turbo run dev|next dev|nodemon src/index.ts|nodemon src/worker.ts' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >NUL 2>&1

for %%P in (3000 3001 3002 3003 4040) do (
	for /f "tokens=5" %%I in ('netstat -aon ^| findstr /R /C:":%%P .*LISTENING"') do (
		taskkill /F /PID %%I >NUL 2>&1
	)
)

echo 1. Starting PostgreSQL and Redis in the background...
docker compose up -d

echo.
echo 2. Opening Ngrok in a new window...
set NGROK_DOMAIN=--domain=nonfloriferous-dell-nonmanipulatory.ngrok-free.dev

if "%NGROK_DOMAIN%"=="" (
    echo [WARNING] Using random Ngrok URL! Edit start.bat to set NGROK_DOMAIN.
    start "Ngrok Webhook Tunnel" cmd /k "npx ngrok http 3001"
) else (
    echo [SUCCESS] Using static domain: %NGROK_DOMAIN%
    start "Ngrok Webhook Tunnel" cmd /k "npx ngrok http %NGROK_DOMAIN% 3001"
)

echo.
echo 3. Starting Sentinel, Auditor, and Cockpit Dashboard...
set NO_UPDATE_NOTIFIER=1
npm run dev
