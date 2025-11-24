# OBHL Hockey League 2.0

A comprehensive hockey league management system built with microservices architecture.

## Architecture

### Microservices
- **API Gateway** (Port 8000): Team management and coordination
- **League Service** (Port 8001): Season and league management
- **Game Service** (Port 8002): Game scheduling and event tracking
- **Stats Service** (Port 8003): Player statistics and analytics

### Technology Stack
- **Backend**: Java 21, Spring Boot 3.2.0
- **Database**: PostgreSQL 16
- **Containerization**: Docker & Docker Compose
- **Build Tool**: Gradle

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Java 21 (for local development)
- PostgreSQL 16 (for local development without Docker)

### Running with Docker Compose

```bash
# Clone the repository
cd obhl-hockey-league-2.0

# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Running Locally

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run database migrations
cd database/scripts
./run_migrations.sh

# Build and run each service
cd backend/api-gateway
./gradlew.bat bootRun

# In separate terminals:
cd backend/league-service
./gradlew.bat bootRun

cd backend/game-service
./gradlew.bat bootRun

cd backend/stats-service
./gradlew.bat bootRun
```

## API Endpoints

### API Gateway (Port 8000)
- `GET /api/v1/teams` - List all teams
- `POST /api/v1/teams` - Create a team
- `GET /api/v1/teams/{id}` - Get team by ID
- `PATCH /api/v1/teams/{id}` - Update team
- `DELETE /api/v1/teams/{id}` - Delete team

### League Service (Port 8001)
- `GET /api/v1/seasons` - List all seasons
- `GET /api/v1/seasons/active` - Get active season
- `POST /api/v1/seasons` - Create a season
- `GET /api/v1/leagues` - List all leagues
- `POST /api/v1/leagues` - Create a league

### Game Service (Port 8002)
- `GET /api/v1/games` - List all games
- `POST /api/v1/games` - Schedule a game
- `PATCH /api/v1/games/{id}` - Update game
- `GET /api/v1/game-events?gameId={id}` - Get game events
- `POST /api/v1/game-events` - Record game event

### Stats Service (Port 8003)
- `GET /api/v1/players` - List all players
- `POST /api/v1/players` - Create a player
- `GET /api/v1/stats/players?seasonId={id}` - Get player stats
- `GET /api/v1/stats/goalies?seasonId={id}` - Get goalie stats

## Database Schema

The system uses a shared PostgreSQL database with the following tables:
- `teams` - Team information and standings
- `seasons` - League seasons
- `leagues` - Divisions and conferences
- `players` - Player roster
- `games` - Game schedule and results
- `game_events` - In-game events (goals, penalties, etc.)
- `player_stats` - Skater statistics
- `goalie_stats` - Goalie statistics

## Development

### Building Services

```bash
# Build all services
cd backend/api-gateway && ./gradlew.bat build
cd backend/league-service && ./gradlew.bat build
cd backend/game-service && ./gradlew.bat build
cd backend/stats-service && ./gradlew.bat build
```

### Running Tests

```bash
# Run tests for each service
./gradlew.bat test
```

## License

MIT