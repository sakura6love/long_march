@echo off
setlocal
cd /d "%~dp0"

rem ---- change this if 8080 is already in use ----
set "PORT=8080"
set "URL=http://localhost:%PORT%/"

echo ==========================================
echo   Long March  ^|  Local Preview
echo   Close this window to stop the server.
echo ==========================================
echo.

if not exist "dist\index.html" (
  echo [1/2] dist not found, building now...
  where npm >nul 2>nul
  if errorlevel 1 goto :nonode
  call npm run build
  if errorlevel 1 goto :buildfail
)

echo [2/2] Serving: %URL%
echo       The browser will open in 2 seconds.
echo.

start "" /min cmd /c "timeout /t 2 >nul & start %URL%"

where python >nul 2>nul
if not errorlevel 1 goto :usepy

where py >nul 2>nul
if not errorlevel 1 goto :usepyw

where npx >nul 2>nul
if not errorlevel 1 goto :usenpx

goto :nonode

:usepy
python -m http.server %PORT% --directory dist
goto :stop

:usepyw
py -m http.server %PORT% --directory dist
goto :stop

:usenpx
npx --yes serve dist -l %PORT%
goto :stop

:stop
echo.
echo Server stopped.
pause
exit /b 0

:nonode
echo.
echo Neither Python nor Node.js was found.
echo Install one of them, or serve the dist folder with any static server.
pause
exit /b 1

:buildfail
echo.
echo Build failed. See the errors above.
pause
exit /b 1
