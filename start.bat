@echo off
chcp 65001 >nul
title 供应链质量部 AI 综合工作台

set "REPO_ROOT=%~dp0"
set "APP_DIR=%REPO_ROOT%quality-workbench-app"
set "BRANCH=feat/ai-resources-merge"
set "PGBIN=D:\AI\postgresql17\pgsql\bin"
set "PGDATA_DIR=D:\AI\pgdata"
set "PORT=3000"

echo ============================================
echo  供应链质量部 AI 综合工作台
echo  分支: %BRANCH%
echo  入口: http://localhost:%PORT%/portal
echo ============================================
echo.

if not exist "%APP_DIR%\package.json" (
  echo [错误] 找不到 quality-workbench-app\package.json
  echo 路径: %APP_DIR%
  pause
  exit /b 1
)

echo [1/6] 切换到合并分支 %BRANCH% ...
cd /d "%REPO_ROOT%"
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [错误] 当前目录不是 git 仓库: %REPO_ROOT%
  pause
  exit /b 1
)

git show-ref --verify --quiet "refs/heads/%BRANCH%"
if errorlevel 1 (
  echo [错误] 本地不存在分支 %BRANCH%
  pause
  exit /b 1
)

for /f "delims=" %%b in ('git branch --show-current') do set "CUR_BRANCH=%%b"
if /I not "%CUR_BRANCH%"=="%BRANCH%" (
  git checkout "%BRANCH%"
  if errorlevel 1 (
    echo [错误] 无法切换到 %BRANCH%，请先处理未提交改动后再试
    pause
    exit /b 1
  )
) else (
  echo   已在 %BRANCH%
)

echo [2/6] 确保 PostgreSQL 运行...
if not exist "%PGBIN%\pg_ctl.exe" (
  echo   [警告] 未找到 pg_ctl: %PGBIN%\pg_ctl.exe，跳过数据库启动
) else (
  "%PGBIN%\pg_ctl.exe" status -D "%PGDATA_DIR%" >nul 2>&1
  if errorlevel 1 (
    echo   正在启动 PostgreSQL...
    "%PGBIN%\pg_ctl.exe" start -D "%PGDATA_DIR%" -l "%PGDATA_DIR%\server.log"
  ) else (
    echo   PostgreSQL 已在运行
  )
)

echo [3/6] 确保 AI_RESOURCES_ENABLED=true ...
cd /d "%APP_DIR%"
node -e "const fs=require('fs'); const p='.env'; let c=fs.existsSync(p)?fs.readFileSync(p,'utf8'):''; if(/AI_RESOURCES_ENABLED=/.test(c)){c=c.replace(/^AI_RESOURCES_ENABLED=.*$/m,'AI_RESOURCES_ENABLED=true')}else{c=(c.replace(/\s+$/,'')+'\nAI_RESOURCES_ENABLED=true\n')} fs.writeFileSync(p,c); console.log('  .env ready')"
if errorlevel 1 (
  echo   [警告] 无法自动写入 .env，请手动确认 AI_RESOURCES_ENABLED=true
)

echo [4/6] 释放端口 %PORT% ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo   结束旧进程 PID %%a
  taskkill /PID %%a /F >nul 2>&1
)

echo [5/6] 打开浏览器...
start "" "http://localhost:%PORT%/portal"

echo [6/6] 启动开发服务器...
echo.
echo   登录后可在门户选择「质量工作台」或「AI 资源库」
echo   按 Ctrl+C 停止
echo.
call npm run dev
pause
