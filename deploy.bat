@echo off
REM MindVault Habit System - Deployment Script (Windows)
REM This script automates deployment to GitHub and Vercel

setlocal enabledelayedexpansion

echo.
echo ================================
echo MindVault Habit System Deployment
echo ================================
echo.

REM Step 1: Check git status
echo Step 1: Checking git status...
git status --porcelain > nul
if %errorlevel% neq 0 (
    echo ERROR: Git command failed
    exit /b 1
)

for /f %%A in ('git status --porcelain 2^>nul ^| find /c /v ""') do (
    if %%A gtr 0 (
        echo.
        echo ERROR: Uncommitted changes detected
        echo Please commit all changes before deploying
        echo.
        exit /b 1
    )
)
echo [OK] Working tree clean

REM Step 2: Check if remote is configured
echo.
echo Step 2: Checking GitHub remote...
git remote get-url origin > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: GitHub remote not configured
    echo.
    echo Please set up GitHub first:
    echo   1. Create repo at https://github.com/new
    echo   2. Run: git remote add origin https://github.com/[USERNAME]/[REPO].git
    echo   3. Run this script again
    echo.
    exit /b 1
)

for /f "tokens=*" %%i in ('git config --get remote.origin.url') do set REMOTE_URL=%%i
echo [OK] GitHub remote configured
echo      URL: !REMOTE_URL!

REM Step 3: Build the project
echo.
echo Step 3: Building project...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed
    echo.
    exit /b 1
)
echo [OK] Build successful

REM Step 4: Push to GitHub
echo.
echo Step 4: Pushing to GitHub...
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Push to GitHub failed
    echo.
    exit /b 1
)
echo [OK] Pushed to GitHub

REM Step 5: Suggest Vercel deployment
echo.
echo ================================
echo [OK] DEPLOYMENT READY
echo ================================
echo.
echo Next steps:
echo   1. Go to https://vercel.com/dashboard
echo   2. Click 'New Project'
echo   3. Select your GitHub repo
echo   4. Click 'Deploy'
echo.
echo Or use Vercel CLI:
echo   npm install -g vercel
echo   vercel --prod
echo.
echo Your app will be live at:
echo   https://mindvault.vercel.app
echo.
echo Deployment complete! 🚀
echo.

endlocal
