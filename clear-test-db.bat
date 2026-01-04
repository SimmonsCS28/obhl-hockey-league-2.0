@echo off
echo ========================================
echo Clearing Test Database
echo ========================================
echo.
echo WARNING: This will delete ALL data from the test database!
echo.
set /p confirm="Are you sure you want to continue? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo Operation cancelled.
    pause
    exit /b
)

echo.
echo Clearing all data...
docker exec -i obhl-test-db psql -U obhl_user -d obhl_test < database\scripts\clear-test-data.sql

if errorlevel 1 (
    echo.
    echo ERROR: Failed to clear database
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS: Test database cleared!
    echo ========================================
    echo.
    echo You can now:
    echo 1. Create a new league and season
    echo 2. Run the draft tool
    echo 3. Generate the schedule
    echo.
)

pause
