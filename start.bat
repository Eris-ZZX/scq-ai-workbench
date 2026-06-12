@echo off
chcp 65001 >nul
title SCQ AI 工作台

echo ============================================
echo  供应链质量部 AI 综合工作台
echo ============================================
echo.

set SCRIPT_DIR=%~dp0
set DEV_DIR=%SCRIPT_DIR%02-frontend

if not exist "%DEV_DIR%\package.json" (
  echo [错误] 找不到 02-frontend\package.json
  echo 当前路径: %DEV_DIR%
  pause
  exit /b 1
)

echo [1/3] 关闭已有 dev 服务器...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
  taskkill /f /pid %%a >nul 2>&1
  echo     ✓ 已关闭端口 3000 上的进程 (PID %%a)
)

echo [2/3] 初始化...
cd /d "%DEV_DIR%"

echo [3/3] 启动开发服务器...
echo.
echo     → 浏览器打开 http://localhost:3000
echo     → 按 Ctrl+C 停止服务器
echo.
start http://localhost:3000
call npm run dev
pause
