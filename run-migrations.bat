@echo off
echo Running database migrations...

for %%f in (database\migrations\*.sql) do (
    echo Running %%f...
    docker exec -i obhl-test-db psql -U obhl_user -d obhl_test < %%f
    if errorlevel 1 (
        echo ERROR running %%f
    ) else (
        echo SUCCESS: %%f
    )
)

echo.
echo All migrations complete!
pause
