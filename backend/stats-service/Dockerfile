FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the JAR file
COPY build/libs/obhl-stats-service-1.0.0.jar app.jar

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8003/actuator/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
