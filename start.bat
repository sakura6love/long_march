@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem 若 8080 被占用（提示 Address already in use），把下面改成 8081 再试
set "PORT=8080"
set "URL=http://localhost:%PORT%/"

echo ==========================================
echo   长征万里 · 薪火千秋  ·  本地预览
echo   关闭此窗口即停止服务
echo ==========================================
echo.

if not exist "dist\index.html" (
  echo [1/2] 未找到 dist，正在构建……
  where npm >nul 2>nul
  if errorlevel 1 goto :nonode
  call npm run build
  if errorlevel 1 goto :buildfail
)

echo [2/2] 启动本地服务器：%URL%
echo       浏览器会自动打开；若没有，请手动访问上面的地址。
echo.

rem 两秒后开浏览器（URL 无空格，不需要引号，避免嵌套引号解析问题）
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
echo 服务器已停止。
pause
exit /b 0

:nonode
echo.
echo 没找到可用的 Python 或 Node.js。
echo 请安装其中之一，或用任意静态服务器指向 dist 目录。
pause
exit /b 1

:buildfail
echo.
echo 构建失败，请检查上面的报错。
pause
exit /b 1
