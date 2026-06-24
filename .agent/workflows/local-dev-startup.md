---
description: Start local development environment — backend services in Docker, frontend via Vite dev server (hot reload)
---

# Local Dev Startup Workflow

Starts all backend microservices and the database in Docker, then launches the Vite dev server so the frontend has full hot-module-replacement (HMR). The Docker `frontend` container is intentionally excluded — the Vite dev server replaces it locally.

## Steps

1. Stop any running containers to ensure a clean state
```bash
docker compose -f docker-compose.yml down
```

2. Start backend services only (postgres, api-gateway, league-service, game-service, stats-service) — exclude the frontend container
```bash
docker compose -f docker-compose.yml up -d postgres api-gateway league-service game-service stats-service
```

3. Wait for services to be healthy
```bash
docker compose -f docker-compose.yml ps
```

4. Start the Vite dev server in the background (this runs with hot-module-replacement enabled)
```bash
npm run dev
```
> Run this command inside `e:\projects\obhl-hockey-league-2.0\frontend`

5. Verify all backend containers are running
```bash
docker compose -f docker-compose.yml ps
```

## Post-Startup

| Service | URL |
|---|---|
| Frontend (Vite HMR) | http://localhost:5173 |
| API Gateway | http://localhost:8000 |
| League Service | http://localhost:8001 |
| Game Service | http://localhost:8002 |
| Stats Service | http://localhost:8003 |
| PostgreSQL | localhost:5432 |

### Notes
- The Vite dev server proxies API calls to `http://localhost:8000` automatically
- Backend changes (Java) require a container rebuild: `docker compose up -d --build <service-name>`
- Frontend changes hot-reload automatically — no restart needed
- To stop everything: `docker compose down` and kill the Vite terminal
- If you need a full backend rebuild (e.g. after schema changes): `docker compose up -d --build postgres api-gateway league-service game-service stats-service`
- **Git worktrees:** do NOT run this workflow from a secondary worktree. `docker compose` names its project after the directory, so a worktree spins up a *separate* stack with a fresh, EMPTY database. When working in a worktree, leave the backend running from the main checkout and start only Vite (`npm run dev`) — it proxies to the shared `localhost:8000`. If you must have a worktree-local backend, seed it (`database/migrations/*` then `database/seeds/*`) before testing.
