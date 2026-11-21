@echo off
setlocal
cd /d "%~dp0"
set "TEAMUP_EXIT=0"
set "TEAMUP_NODE=node.exe"
where node.exe >nul 2>nul
if not errorlevel 1 goto node_ready
set "TEAMUP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%TEAMUP_NODE%" goto node_ready
echo [ERROR] Node.js 22.13 or newer is required. Install Node.js and try again.
set "TEAMUP_EXIT=1"
goto finish

:node_ready
if exist "node_modules\vite\bin\vite.js" goto dependencies_ready
echo [ERROR] Dependencies are missing. Run npm install in this folder first.
set "TEAMUP_EXIT=1"
goto finish

:dependencies_ready
if exist ".env" goto build
copy /y ".env.example" ".env" >nul
if errorlevel 1 goto failed

:build
set "TEAMUP_STEP=TypeScript build"
echo [1/5] %TEAMUP_STEP%
"%TEAMUP_NODE%" node_modules/typescript/bin/tsc -b
if errorlevel 1 goto failed
set "TEAMUP_STEP=Frontend build"
echo [2/5] %TEAMUP_STEP%
"%TEAMUP_NODE%" node_modules/vite/bin/vite.js build
if errorlevel 1 goto failed
set "TEAMUP_STEP=MSSQL connection check"
echo [3/5] %TEAMUP_STEP%
"%TEAMUP_NODE%" scripts/check-db.js
if errorlevel 1 goto failed
set "TEAMUP_STEP=Database/API verification"
echo [4/5] %TEAMUP_STEP%
"%TEAMUP_NODE%" scripts/verify-db-api.js
if errorlevel 1 goto failed
set "TEAMUP_STEP=TeamUP server"
echo [5/5] Starting %TEAMUP_STEP%. Keep this window open.
echo Open http://localhost:3001 after the server reports it is ready.
"%TEAMUP_NODE%" server/index.js
if errorlevel 1 goto failed
echo TeamUP server stopped.
goto finish

:failed
set "TEAMUP_EXIT=%errorlevel%"
echo.
echo [ERROR] %TEAMUP_STEP% failed. Exit code: %TEAMUP_EXIT%
echo Read the error above. Database/API details: work\db-api-verification.json

:finish
echo.
if /I not "%~1"=="--no-pause" pause
exit /b %TEAMUP_EXIT%
