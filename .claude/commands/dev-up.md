---
description: Start local dev environment (backend in Docker, frontend via Vite)
---

Run the local dev startup workflow described in @.agent/workflows/local-dev-startup.md:

1. `docker compose -f docker-compose.yml down`
2. `docker compose -f docker-compose.yml up -d postgres api-gateway league-service game-service stats-service`
3. Wait for all containers to be healthy (`docker compose -f docker-compose.yml ps`)
4. Start `npm run dev` in `frontend/` in the background
5. Confirm everything is up and report the URLs from the workflow's Post-Startup table.
