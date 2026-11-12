@echo off
setlocal
title RedNav-N399 — Public Internet Tunnel

echo ========================================================
echo   RedNav-N399 - Public Share Tunnel (Port 3000)
echo ========================================================

where cloudflared >nul 2>&1
if errorlevel 1 (
    echo cloudflared was not found on PATH.
    echo.
    echo Install Cloudflare Tunnel (free, no account needed for quick tunnels):
    echo   winget install --id Cloudflare.cloudflared
    echo Or download from:
    echo   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo.
    echo Alternative if you use ngrok:
    echo   ngrok http 3000
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if errorlevel 1 (
    echo NOTE: Nothing is responding on http://127.0.0.1:3000 yet.
    echo Run share.bat first so backend ^(8000^) and frontend ^(3000^) are running!
    pause
    exit /b 1
)

echo Opening public HTTPS URL for RedNav-N399 (proxies /api automatically)...
echo Copy the https://*.trycloudflare.com URL below and share it!
echo Press Ctrl+C to stop sharing.
echo.
cloudflared tunnel --url http://localhost:3000

