@echo off
REM Runs from the repo root wherever it is launched from.
cd /d "%~dp0.."
echo ================================================
echo Starting OBHL Backend Services with TEST Database
echo ================================================
echo.

REM bootRun does not read Compose's .env. Configure the parent shell first:
REM   set "JWT_SECRET=your-local-random-value"
REM   set "INTERNAL_SERVICE_KEY=a-different-local-random-value"
REM Generate each separately with: openssl rand -base64 48
REM All child service windows inherit these variables. Never use production secrets.
if not defined JWT_SECRET goto missing_secrets
if not defined INTERNAL_SERVICE_KEY goto missing_secrets
if "%JWT_SECRET:~31,1%"=="" goto missing_secrets
if "%INTERNAL_SERVICE_KEY:~31,1%"=="" goto missing_secrets
if "%INTERNAL_SERVICE_KEY%"=="obhl-internal-service-key-change-in-production" goto missing_secrets
if "%JWT_SECRET%"=="%INTERNAL_SERVICE_KEY%" goto missing_secrets

REM Set test profile
set SPRING_PROFILES_ACTIVE=test

echo Starting Stats Service on port 8082...
start "Stats Service (TEST)" cmd /k "cd backend\stats-service && gradlew bootRun"

timeout /t 3 /nobreak >nul

echo Starting API Gateway on port 8000...
start "API Gateway (TEST)" cmd /k "cd backend\api-gateway && gradlew bootRun"

timeout /t 3 /nobreak >nul

echo Starting League Service on port 8081...
start "League Service (TEST)" cmd /k "cd backend\league-service && gradlew bootRun"

timeout /t 3 /nobreak >nul

echo Starting Game Service on port 8002...
start "Game Service (TEST)" cmd /k "cd backend\game-service && gradlew bootRun"

echo.
echo ================================================
echo All services starting with TEST database!
echo Database: localhost:5433/obhl_test
echo ================================================
echo.
echo Wait for all services to finish starting...
echo Check each window for "Started" message
echo.
pause

exit /b 0

:missing_secrets
echo ERROR: Set distinct JWT_SECRET and INTERNAL_SERVICE_KEY values of at least 32 characters first.
echo Generate each with: openssl rand -base64 48
echo See .agent/workflows/local-dev-startup.md. No services were started.
exit /b 1
