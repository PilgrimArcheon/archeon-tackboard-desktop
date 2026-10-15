@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>&1 || (echo Node.js 22+ required & pause & exit /b 1)
call npm install || (pause & exit /b 1)
call npm test || (pause & exit /b 1)
call npm run dist:win || (pause & exit /b 1)
echo Installer saved in dist\
pause
endlocal
