@echo off
echo Starting League Service with TEST profile...
set SPRING_PROFILES_ACTIVE=test
gradlew bootRun
pause
