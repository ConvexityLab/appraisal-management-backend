@echo off
REM Production API Integration Test Script for Windows
REM This script starts the production server and runs comprehensive integration tests

echo 🚀 Starting Production API Integration Tests
echo ===========================================

setlocal enabledelayedexpansion
set "SERVER_PID="
set "CLEANUP_NEEDED=false"

REM Check if server is already running
echo 🔍 Checking if production server is already running...
curl -s http://localhost:3000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Production server is already running
    goto :run_tests
)

echo 🔧 Starting production server...

REM Build the project first
echo 📦 Building project...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed
    exit /b 1
)

REM Start production server in background
echo 🚀 Starting production server on port 3000...
set NODE_ENV=development
set PORT=3000
start /B node dist/app-production.js
set "CLEANUP_NEEDED=true"

echo ⏳ Waiting for server to start...

REM Wait for server to be ready (max 30 seconds)
set /a "attempts=0"
:wait_loop
set /a "attempts+=1"
if %attempts% GTR 15 (
    echo ❌ Production server failed to start within timeout
    goto :cleanup_and_exit
)

curl -s http://localhost:3000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Production server is ready
    goto :server_ready
)

echo 🔄 Waiting for server... (%attempts%/15)
timeout /t 2 /nobreak >nul
goto :wait_loop

:server_ready
REM Wait a bit more to ensure full initialization
timeout /t 3 /nobreak >nul

:run_tests
echo.
echo 🧪 Running Integration Tests...
echo ==============================

REM Run the integration tests
call npx vitest tests/integration/production-api.test.ts --reporter=verbose --run

set "TEST_EXIT_CODE=%ERRORLEVEL%"

echo.
echo 📊 Test Results Summary
echo ======================

if %TEST_EXIT_CODE% EQU 0 (
    echo ✅ All integration tests passed!
    echo 🎉 Production API is fully functional
) else (
    echo ❌ Some integration tests failed
    echo 🔍 Check the test output above for details
)

echo.
echo 🏁 Integration test run complete

:cleanup_and_exit
REM Cleanup: Kill any node processes we started
if "%CLEANUP_NEEDED%"=="true" (
    echo 🧹 Cleaning up: Stopping any node processes...
    taskkill /F /IM node.exe >nul 2>&1
)

REM Exit with test result code
exit /b %TEST_EXIT_CODE%