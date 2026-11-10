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

where node >nul 2>nul
if errorlevel 1 goto :nofull

if not exist "node_modules\vite" (
  echo [1/3] Installing dependencies, this may take a minute...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto :buildfail
)

if not exist "dist\index.html" (
  echo [2/3] Building the site...
  call npm run build
  if errorlevel 1 goto :buildfail
)

echo [3/3] Serving: %URL%   (with /api)
echo       The browser will open in 2 seconds.
echo.
start "" /min cmd /c "timeout /t 2 >nul & start %URL%"
set "PORT=%PORT%"
node server.mjs
goto :stop

:nofull
if not exist "dist\index.html" goto :nonode
echo [fallback] Node.js not found, serving dist without /api
where python >nul 2>nul
if not errorlevel 1 goto :usepy
where py >nul 2>nul
if not errorlevel 1 goto :usepyw
goto :nonode

:usepy
start "" /min cmd /c "timeout /t 2 >nul & start %URL%"
python -m http.server %PORT% --directory dist
goto :stop

:usepyw
start "" /min cmd /c "timeout /t 2 >nul & start %URL%"
py -m http.server %PORT% --directory dist
goto :stop

:stop
echo.
echo Server stopped.
pause
exit /b 0

:nonode
echo.
echo Node.js (>= 20.19) is required for the first run.
echo Install it from https://nodejs.org and run this file again.
pause
exit /b 1

:buildfail
echo.
echo Install or build failed. See the errors above.
pause
exit /b 1
