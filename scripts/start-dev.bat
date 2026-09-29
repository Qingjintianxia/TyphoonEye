@echo off
title TyphoonEye Dev Server
cd /d E:\4_cc\Typhoon
echo.
echo   TyphoonEye dev server
echo   backend  http://localhost:3000
echo   frontend http://localhost:5173   (demo / demo123)
echo.
echo   Press Ctrl+C in this window to stop both services.
echo.
"C:\Users\duolu\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" scripts\dev-all.mjs
pause
