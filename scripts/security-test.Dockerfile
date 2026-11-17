FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
RUN ./gradlew test --no-daemon --max-workers=2
