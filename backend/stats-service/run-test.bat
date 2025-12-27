@echo off
echo Starting Stats Service with TEST profile...
set SPRING_PROFILES_ACTIVE=test
gradlew bootRun
pause
