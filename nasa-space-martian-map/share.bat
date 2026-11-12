@echo off
setlocal EnableDelayedExpansion
title RedNav-N399 — Share Server (LAN & Local)

cd /d "%~dp0"

echo ========================================================
echo   RedNav-N399 - Starting Shareable Mission Server
echo ========================================================

:: 1. Build frontend if needed
if not exist "frontend\.next\BUILD_ID" (
    echo [1/4] Building Next.js production frontend (first run)...
    pushd frontend
    call npm run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed.
        popd
        exit /b 1
    )
    popd
) else (
    echo [1/4] Frontend production build already exists.
)

:: 2. Start Backend on 0.0.0.0:8000
echo [2/4] Starting API server on 0.0.0.0:8000...
start "RedNav-N399 Backend (8000)" /MIN cmd /c "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Wait up to 20s for /api/health
set READY=0
for /L %%i in (1,1,20) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
    if !errorlevel! EQU 0 (
        set READY=1
        goto :backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if "!READY!"=="0" (
    echo WARNING: Backend did not respond within 20s on port 8000. Check the Backend window.
) else (
    echo     API health check: OK
)

:: 3. Start Frontend on 0.0.0.0:3000
echo [3/4] Starting web app on 0.0.0.0:3000...
start "RedNav-N399 Frontend (3000)" /MIN cmd /c "cd /d "%~dp0frontend" && npx next start -H 0.0.0.0 -p 3000"

timeout /t 3 /nobreak >nul

:: 4. Detect active non-loopback IPv4 LAN address dynamically
set LAN_IP=
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' -and $_.IPAddress -notlike '169.254.*' } | Sort-Object InterfaceMetric; if ($ips) { $ips[0].IPAddress }"`) do set LAN_IP=%%a

echo.
echo ========================================================
echo   RedNav-N399 IS LIVE!
echo ========================================================
echo   On this laptop:     http://localhost:3000
if not "!LAN_IP!"=="" (
    echo   On same Wi-Fi/LAN:  http://!LAN_IP!:3000
) else (
    echo   On same Wi-Fi/LAN:  Run 'ipconfig' and share http://^<YOUR-IPv4^>:3000
)
echo.
echo   Note: If teammates on the same Wi-Fi cannot connect,
echo   allow Python and Node through Windows Defender Firewall
echo   (Private network) when Windows prompts you.
echo   To share over the internet instead, run: share-public.bat
echo ========================================================
pause

