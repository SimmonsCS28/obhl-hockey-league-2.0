@echo off
echo ================================================
echo Starting OBHL Backend Services with TEST Database
echo ================================================
echo.

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
