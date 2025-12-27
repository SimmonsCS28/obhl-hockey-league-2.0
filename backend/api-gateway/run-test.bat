@echo off
echo Starting API Gateway with TEST profile...
set SPRING_PROFILES_ACTIVE=test
gradlew bootRun
pause
