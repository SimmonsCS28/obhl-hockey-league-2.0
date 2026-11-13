---
description: Deploy main branch to production AWS server
---

# Production Deployment Workflow

This workflow deploys the latest main branch code to the production AWS EC2 server.

## Normally the pipeline does this

Merges to `main` deploy through GitHub Actions: `.github/workflows/deploy-production.yml` waits
for approval in the `production` environment, then runs `scripts/deploy/deploy.sh` on the box
through AWS SSM. The script is this runbook automated: it checks for drift, prunes Docker build
cache if the disk is over 80%, rebuilds only the services whose files changed, one at a time,
waiting for each to turn healthy, does the frontend last, and never runs `docker compose down`.
One-time setup is in `docs/deploy-pipeline-setup.md`; until the repository variable
`PROD_DEPLOY_ENABLED` is `true`, the pipeline does nothing and this runbook is still the way to
deploy.

The pipeline stops **before pulling anything** and asks for a person when:

| Situation | What to do |
| --- | --- |
| The range has files under `database/migrations/` (exit 4) | Apply them by hand as below, **before** any service rebuilds. The failed run prints a ready-made command per file. Then Actions > Deploy production > Run workflow with **migrations applied** ticked, which deploys the rest. |
| `docker-compose.yml` changed (exit 4) | A compose change can touch any service, postgres included. Deploy that range by hand with the steps below, recreating each affected service on its own. |
| Tracked files on the box have local edits (exit 3) | Find out where the drift came from, get it into a PR or discard it, then re-run. |
| `/` still over 90% full after pruning (exit 6) | `docker system df`, free space by hand, re-run. Postgres shares the disk. |

Also still by hand, because the pipeline does not touch the host: changes under `deploy/` (host
nginx config, the maintenance page; see `deploy/README.md`), and new variables the box's `.env`
needs (watch for `.env.example` changes; the pipeline warns but cannot fill them in).

If you deploy by hand, set `PROD_DEPLOY_ENABLED` to `false` first so an approved run cannot start
underneath you (the script also takes a lock on the box), and back to `true` afterwards. On the box,
`scripts/deploy/deploy.sh --dry-run` prints exactly what the pipeline would do, and running it
without `--dry-run` over SSH is a fine way to do a by-hand deploy of an ordinary range. Its full
output is kept in `~/obhl-deploy-logs`.

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

When the pipeline stopped on a migration, nothing has been pulled yet, so the files are not in the
working tree. Apply them from the fetched commit instead (the failed run prints this line per file,
with the commit filled in), then re-run the workflow with **migrations applied** ticked:

```bash
cd ~/obhl-hockey-league-2.0 && git fetch origin main && git show origin/main:database/migrations/NNN_description.sql | docker exec -i obhl-postgres psql -v ON_ERROR_STOP=1 -U obhl_admin -d obhl_db
```

## Post-Deployment

- The site is at https://oldbuzzardhockey.com — `http://44.193.17.173` 301s there, so test the
  domain, not the IP.
- Allow 2-5 minutes for the frontend build to finish.
- Hard refresh (Ctrl+Shift+R) — the built bundle is cached aggressively and you will otherwise
  be looking at the old one.
- Test the feature you shipped, in the browser, before calling it done.

## If it goes wrong

With the pipeline on, the clean rollback is a revert PR on `main`: it deploys like any other merge.
A failed pipeline run says which services it finished; the box remembers where that deploy started,
so the next run (a re-run, or the fix-forward merge) also rebuilds whatever the failed one skipped.

For an emergency rollback on the box itself, set `PROD_DEPLOY_ENABLED` to `false` first: the next
approved run would otherwise redeploy `main`, bad commit and all. Then roll back to the previous
commit and rebuild the same single service:

```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && git reset --hard HEAD~1 && docker compose up -d --build frontend"
```

If the box becomes unresponsive mid-build it is almost certainly memory. Check `free -h` and
`docker compose ps` first; Postgres has a restart policy, so it should come back on its own.
