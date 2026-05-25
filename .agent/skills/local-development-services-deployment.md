# Skill: Local Development Services Deployment

Deploy and run all OBHL services locally using Docker Compose. This brings up PostgreSQL and all four Spring Boot backend microservices. The frontend can be run either via Docker (static build) or via the Vite dev server for hot-module replacement (HMR) during active frontend development.

---

## Prerequisites

- Docker Desktop must be installed and running
- You must be in the project root: `e:\projects\obhl-hockey-league-2.0`

---

## Steps

### Step 1: Verify Docker is Running

```powershell
docker ps
```

Expected: Command returns without error (even if no containers are listed). If Docker is not running, open Docker Desktop and wait for it to fully start.

---

### Step 2: Start the PostgreSQL Database

Start the database first and wait for it to become healthy before starting the backend services.

```powershell
docker compose up -d postgres
```

Verify it's healthy:

```powershell
docker compose ps postgres
```

Expected: Status shows `Up` and `(healthy)`. This may take 10–20 seconds.

---

### Step 3: Build and Start All Backend Services

Build and start the API Gateway, League Service, Game Service, and Stats Service. The `--build` flag ensures your latest local code changes are compiled into the Docker images.

**Option A — Include Docker frontend (static build, no HMR):**
```powershell
docker compose up -d --build api-gateway league-service game-service stats-service frontend
```

**Option B — Backend only (use with hot-swap frontend, see Step 3b):**
```powershell
docker compose up -d --build api-gateway league-service game-service stats-service
```

> **Note:** This step compiles all four Java/Gradle services. The first time (or after code changes), this will take **3–5 minutes**. Subsequent runs that use cached layers will be faster.

---

### Step 3b: Run Frontend with Hot-Swap (HMR) — Recommended for Frontend Development

Use this instead of the Docker frontend when actively making frontend changes. It enables instant hot-module replacement so changes appear in the browser without a rebuild.

First, stop the Docker frontend container if it's running:

```powershell
docker compose stop frontend
```

Then, in the `frontend` directory, start the Vite dev server:

```powershell
npm run dev
```

The frontend will be available at **http://localhost:5173/** with HMR enabled. The Vite proxy (configured in `vite.config.js`) will automatically forward all `/api`, `/games-api`, and `/stats-api` requests to the backend Docker containers.

---

### Step 4: Verify All Services Are Running

```powershell
docker compose ps
```

Expected output (all containers should show `Up`):

| Container | Port | Status |
|---|---|---|
| `obhl-postgres` | 5432 | Up (healthy) |
| `obhl-api-gateway` | 8000 | Up |
| `obhl-league-service` | 8001 | Up |
| `obhl-game-service` | 8002 | Up |
| `obhl-stats-service` | 8003 | Up |
| `obhl-frontend` *(Docker mode only)* | 8080 | Up |

> **Note:** Backend Java services will show `(health: starting)` for 30–60 seconds after container start while Spring Boot initializes. Wait until they show `(healthy)` before testing.

---

## Service URLs

| Service | URL | Mode |
|---|---|---|
| **Frontend (HMR / hot-swap)** | http://localhost:5173 | `npm run dev` |
| **Frontend (Docker / static)** | http://localhost:8080 | Docker only |
| **API Gateway** | http://localhost:8000 | Docker |
| **League Service** | http://localhost:8001 | Docker |
| **Game Service** | http://localhost:8002 | Docker |
| **Stats Service** | http://localhost:8003 | Docker |
| **PostgreSQL** | localhost:5432 (DB: `obhl_db`, User: `obhl_admin`) | Docker |

---

## Viewing Logs

To tail logs for a specific service:

```powershell
docker compose logs -f api-gateway
docker compose logs -f game-service
docker compose logs -f league-service
docker compose logs -f stats-service
docker compose logs -f frontend
```

To view all service logs at once:

```powershell
docker compose logs -f
```

---

## Stopping All Services

To stop all running containers without removing data:

```powershell
docker compose stop
```

To stop and remove all containers (data volumes are preserved):

```powershell
docker compose down
```

To stop, remove containers, **and** wipe the database volume (full reset):

```powershell
docker compose down -v
```

---

## Rebuilding a Single Service

If you've only changed one service, you can rebuild just that service to save time:

```powershell
docker compose up -d --build api-gateway
```

Replace `api-gateway` with whichever service was modified: `league-service`, `game-service`, `stats-service`, or `frontend`.

---

## Notes

- There is an orphaned `obhl-test-db` container from a separate test Docker Compose config. The warning about it can be safely ignored, or run `docker compose down --remove-orphans` to clean it up.
- The `version` attribute warning in docker-compose.yml output can also be ignored — it is obsolete in newer Docker versions but harmless.
- Database migrations run automatically on first startup via the `./database/migrations` volume mount.
