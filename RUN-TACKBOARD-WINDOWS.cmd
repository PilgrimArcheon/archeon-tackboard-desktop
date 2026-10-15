@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>&1 || (echo Node.js 22+ required & pause & exit /b 1)
if not exist "node_modules\electron" call npm install || (pause & exit /b 1)
call npm start
if errorlevel 1 pause
endlocal
