# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Microservices system for managing a hockey league: a React frontend behind Nginx, a Java/Spring Boot API gateway, and three backend services, all sharing one PostgreSQL database.

- **frontend** (React 19 + Vite, served via Nginx) — all UI. `src/components` is organized by role: `admin/`, `gm/`, `goalie/`, `referee/`, `public/`, `common/`. `src/services` holds API clients, `src/contexts` holds auth/app state.
- **backend/api-gateway** (port 8000) — entry point for browser API requests. Handles auth (JWT), proxies requests to the other services via `*Client.java` (in `client/`) and `*ProxyController.java` (in `controller/`). Game and Stats also enforce authorization at the service boundary; gateway authentication alone is not sufficient.
- **backend/league-service** (port 8001) — seasons, leagues, league rules.
- **backend/game-service** (port 8002) — game scheduling, game events, shifts.
- **backend/stats-service** (port 8003) — players, player/goalie stats.
- **database/migrations** — sequential numbered SQL migration files (e.g. `029_add_playoff_fields.sql`), shared by all services against one Postgres database (`obhl_db`).

### API routing and security (see docs/security-ws0.md)

- Schedule CSV uploads use the explicit multipart endpoint in `GameProxyController`; it forwards file bytes and the user's JWT without adding an internal credential. Do not send multipart bodies through the generic String-body proxy or bypass the gateway to work around an upload failure.
- Host Nginx handles public API routing. `/games-api/` and `/stats-api/` are compatibility aliases to the gateway, not direct-service access. `frontend/nginx.conf` serves static assets; `deploy/oldbuzzardhockey.nginx` is the host reference configuration and must be applied separately to the live host.
- Compose binds published database, service, and frontend ports to loopback. Only the host reverse proxy should be public; verify live host/firewall settings during rollout rather than assuming the repository config is deployed.
- Game and Stats validate JWTs and roles, including scorekeeper start/finalize/reopen workflows. Trusted backend calls use a separately configured `INTERNAL_SERVICE_KEY`; browser proxies never add or forward this credential. Preserve these boundaries when adding routes.
- Follow the config-first, sequential rollout in `docs/security-ws0.md`. The old upload-bypass and publicly exposed-port workarounds are superseded in this branch. Production rollout is still pending.
- API base paths remain distributed across frontend components; check TECHNICAL_DEBT.md item 3 before assuming a single source of truth.

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

### Docs
- Claude Design handoffs/handbacks, feature specs and plans go in `docs/handoffs/` (not the repo root). Design bundles go in `docs/handoffs/design_bundles/`.
- General guides live in `docs/`, sample data in `docs/samples/`, one-off/helper scripts in `scripts/` (SQL in `scripts/sql/`), and the host Nginx reference config in `deploy/`.
- Keep the repo root to README, CLAUDE.md, TECHNICAL_DEBT.md and the docker-compose files. Don't leave logs or scratch output there.

### Database
- Migrations live in `database/migrations/`, applied in numeric order. New migrations should follow the `NNN_description.sql` naming convention and increment from the highest existing number.
- Seed data in `database/seeds/`.
