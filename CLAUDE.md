# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Microservices system for managing a hockey league: a React frontend behind Nginx, a Java/Spring Boot API gateway, and three backend services, all sharing one PostgreSQL database.

- **frontend** (React 19 + Vite, served via Nginx) — all UI. `src/components` is organized by role: `admin/`, `gm/`, `goalie/`, `referee/`, `public/`, `common/`. `src/services` holds API clients, `src/contexts` holds auth/app state.
- **backend/api-gateway** (port 8000) — single entry point for the frontend. Handles auth (JWT), proxies requests to the other services via `*Client.java` (in `client/`) and `*ProxyController.java` (in `controller/`). Most cross-cutting concerns (auth, CORS, role checks) live here.
- **backend/league-service** (port 8001) — seasons, leagues, league rules.
- **backend/game-service** (port 8002) — game scheduling, game events, shifts.
- **backend/stats-service** (port 8003) — players, player/goalie stats.
- **database/migrations** — sequential numbered SQL migration files (e.g. `029_add_playoff_fields.sql`), shared by all services against one Postgres database (`obhl_db`).

### Known architectural workarounds (see TECHNICAL_DEBT.md)

- File uploads (multipart/form-data) **cannot** go through the API Gateway — `GameProxyController` reads bodies as String, which breaks binary uploads. The frontend calls game-service directly on port 8002 for these (e.g. `ScheduleManager.jsx` uses `GAME_SERVICE_URL`). Don't "fix" this by routing uploads through the gateway without addressing the proxy first.
- Nginx cannot proxy to the Spring Boot services due to duplicate `Transfer-Encoding: chunked` headers (502s). Service ports 8000/8002/8003 are exposed directly; Nginx only serves static frontend files. Multiple header-stripping attempts have already failed — see TECHNICAL_DEBT.md before retrying that approach.
- Frontend has hardcoded production URLs/IPs scattered across files rather than a single config — check TECHNICAL_DEBT.md item 3 before assuming a single source of truth for API base URLs.

## Common Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Vite dev server (also regenerates version info)
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Backend services (each of api-gateway, league-service, game-service, stats-service)
```bash
./gradlew.bat bootRun   # run service locally (Windows)
./gradlew.bat build     # build
./gradlew.bat test      # run all tests
./gradlew.bat test --tests "com.obhl.<service>.SomeTest"   # run a single test
```

### Docker Compose
```bash
docker-compose up -d              # full stack (Postgres + all 4 services)
docker-compose -f docker-compose.test.yml up -d   # isolated test Postgres on port 5433 (db: obhl_test)
docker-compose down
```

### Database
- Migrations live in `database/migrations/`, applied in numeric order. New migrations should follow the `NNN_description.sql` naming convention and increment from the highest existing number.
- Seed data in `database/seeds/`.
