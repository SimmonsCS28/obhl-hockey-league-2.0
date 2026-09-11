---
description: Deploy main branch to production AWS server
---

# Production Deployment Workflow

This workflow deploys the latest main branch code to the production AWS EC2 server.

**Read this first:** the box has 3.7Gi of RAM. Building every service at once has taken
production down before (a ~1 hour outage on 2026-07-01). A 2Gi swapfile now cushions it, but the
rule still stands: **only rebuild the services you actually changed**, and if you genuinely need
all of them, build them one at a time.

There is also no reason to `docker compose down` first. Recreating a single service leaves
Postgres and every untouched service running, so the site stays up for everyone not using the
part you are shipping.

## Steps

// turbo-all

1. SSH in and confirm what production is currently running
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && git log --oneline -1 && git status --short && free -h"
```

Check `git status` for uncommitted drift on the box before pulling — production has been
hand-edited in the past, and a dirty file will block the pull or silently survive it.

2. Pull latest code from main branch
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && git pull origin main"
```

Read the diffstat it prints. The files listed tell you which services need rebuilding:

| Changed paths | Rebuild |
| --- | --- |
| `frontend/**` | `frontend` |
| `backend/api-gateway/**` | `api-gateway` |
| `backend/league-service/**` | `league-service` |
| `backend/game-service/**` | `game-service` |
| `backend/stats-service/**` | `stats-service` |
| `database/migrations/**` | none — apply by hand, see below |

3. Rebuild only what changed
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose up -d --build frontend"
```

Substitute the service name(s) from the table. Note that Compose also recreates anything the
named service `depends_on` — rebuilding `frontend` will recreate `api-gateway` as well. That is
expected and safe; it is still far less than rebuilding everything.

If more than one service changed, run this once per service rather than naming them all in a
single command, so only one Java build holds memory at a time:

```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose up -d --build league-service"
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose up -d --build game-service"
```

4. Verify every container is back, not just the one you rebuilt
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose ps && free -h"
```

All six (`postgres`, `api-gateway`, `league-service`, `game-service`, `stats-service`,
`frontend`) should be `Up`. The ones you did not touch should show their old uptime — if an
untouched service restarted, something rebuilt that you did not intend.

## Database migrations

Migrations are **not** applied by this workflow. If the pull brought in new files under
`database/migrations/`, apply them by hand, in numeric order:

```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker exec -i obhl-postgres psql -U obhl_admin -d obhl_db < database/migrations/NNN_description.sql"
```

## Post-Deployment

- The site is at https://oldbuzzardhockey.com — `http://44.193.17.173` 301s there, so test the
  domain, not the IP.
- Allow 2-5 minutes for the frontend build to finish.
- Hard refresh (Ctrl+Shift+R) — the built bundle is cached aggressively and you will otherwise
  be looking at the old one.
- Test the feature you shipped, in the browser, before calling it done.

## If it goes wrong

Roll back to the previous commit and rebuild the same single service:

```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && git reset --hard HEAD~1 && docker compose up -d --build frontend"
```

If the box becomes unresponsive mid-build it is almost certainly memory. Check `free -h` and
`docker compose ps` first; Postgres has a restart policy, so it should come back on its own.
