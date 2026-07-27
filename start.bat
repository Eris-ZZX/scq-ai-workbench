@echo off
setlocal EnableExtensions
title SCQ AI Workbench

set "REPO_ROOT=%~dp0"
set "APP_DIR=%REPO_ROOT%quality-workbench-app"
set "BRANCH=feat/ai-resources-merge"
set "PGBIN=D:\AI\postgresql17\pgsql\bin"
set "PGDATA_DIR=D:\AI\pgdata"
set "PORT=3000"

echo ============================================
echo  SCQ AI Workbench
echo  Branch: %BRANCH%
echo  Portal: http://localhost:%PORT%/portal
echo ============================================
echo.

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] Missing quality-workbench-app\package.json
  echo Path: %APP_DIR%
  pause
  exit /b 1
)

echo [1/6] Checkout branch %BRANCH% ...
cd /d "%REPO_ROOT%"
if errorlevel 1 (
  echo [ERROR] Cannot cd to repo root
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Not a git repository: %REPO_ROOT%
  pause
  exit /b 1
)

git show-ref --verify --quiet "refs/heads/%BRANCH%"
if errorlevel 1 (
  echo [ERROR] Branch not found: %BRANCH%
  pause
  exit /b 1
)

for /f "delims=" %%b in ('git branch --show-current 2^>nul') do set "CUR_BRANCH=%%b"
if /I not "%CUR_BRANCH%"=="%BRANCH%" (
  git checkout "%BRANCH%"
  if errorlevel 1 (
    echo [ERROR] git checkout failed. Commit or stash local changes first.
    pause
    exit /b 1
  )
) else (
  echo   Already on %BRANCH%
)

echo [2/6] Ensure PostgreSQL is running...
if not exist "%PGBIN%\pg_ctl.exe" (
  echo   [WARN] pg_ctl not found, skip DB start
) else (
  "%PGBIN%\pg_ctl.exe" status -D "%PGDATA_DIR%" >nul 2>&1
  if errorlevel 1 (
    echo   Starting PostgreSQL...
    "%PGBIN%\pg_ctl.exe" start -D "%PGDATA_DIR%" -l "%PGDATA_DIR%\server.log"
  ) else (
    echo   PostgreSQL already running
  )
)

echo [3/6] Ensure AI_RESOURCES_ENABLED=true ...
cd /d "%APP_DIR%"
if errorlevel 1 (
  echo [ERROR] Cannot cd to app dir
  pause
  exit /b 1
)

node "%REPO_ROOT%scripts\ensure-ai-resources-enabled.js"
if errorlevel 1 (
  echo   [WARN] Could not update .env automatically
)

echo [4/6] Free port %PORT% ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo   Kill PID %%a
  taskkill /PID %%a /F >nul 2>&1
)

echo [5/6] Open browser...
start "" "http://localhost:%PORT%/portal"

echo [6/6] Start dev server...
echo.
echo   Login then choose Workbench or AI Resources on /portal
echo   Press Ctrl+C to stop
echo.
call npm run dev
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
