# Conley Classic deploy runbook

Production is a single t3.medium running `docker compose` from a git checkout, with migrations
applied by hand via psql. Nginx already serves `maintenance.html` on 502/503, so the frontend being
down during its rebuild shows a maintenance page rather than an error.

## Why the order matters

- **`league-service` and `game-service` run `ddl-auto=validate`.** They refuse to start against a
  schema missing the new columns, so **every migration runs before any service is rebuilt**.
  `api-gateway` and `stats-service` run `update` and would cope, but there is no reason to rely on it.
- **`deactivate-unregistered` changed contract** — it now requires `seasonId`. An old
  `league-service` calling a new `stats-service` gets a 400, which breaks league draft finalize.
  The two are rebuilt back to back to keep that window as small as possible. Do not finalize a
  league draft during the deploy.
- **Frontend last.** The new UI calls endpoints the new backends provide; the old UI works fine
  against the new backends because every backend change is additive. So old-UI/new-API is safe and
  new-UI/old-API is not.
- **Build one service at a time.** The box has no swap headroom; building several JVMs at once has
  caused an outage before.

## Sequence

### 1. Pre-flight
```
ssh ubuntu@44.193.17.173
cd ~/obhl-hockey-league-2.0
git status            # expect clean — prod has a history of uncommitted drift
docker compose ps     # all five healthy before starting
df -h /               # migrations + image builds need headroom
```

### 2. Back up the database
```
docker exec obhl-postgres pg_dump -U obhl_admin obhl_db > ~/backup-pre-tournament-$(date +%F-%H%M).sql
```
Non-negotiable. Migrations 046–053 are additive and idempotent, but 046 and 047 drop and recreate
CHECK constraints, and there is no down-migration.

### 3. Pull
```
git pull origin <branch>
```

### 4. Run migrations 046–053, in order
```
for f in 046_add_season_type \
         047_extend_game_type_for_tournaments \
         048_create_tournaments \
         049_add_tournament_team_and_player_fields \
         050_create_tournament_awards \
         051_create_tournament_rules_sections \
         052_add_game_period_count \
         053_create_tournament_draft; do
  echo "== $f"
  docker exec -i obhl-postgres psql -U obhl_admin -d obhl_db -v ON_ERROR_STOP=1 \
    < database/migrations/$f.sql
done
```
All are idempotent, so a re-run is safe. Stop if any reports ERROR.

**Pre-verified against production:** `games.game_type` holds only `REGULAR_SEASON` and `PLAYOFF`, so
047's new CHECK accepts every existing row; and prod already carries the per-season team constraints,
so 046's fold-in of `fix_team_constraints.sql` is a no-op there.

### 5. Rebuild services, one at a time, checking health between each
```
docker compose up -d --build league-service   # then: docker compose ps
docker compose up -d --build stats-service
docker compose up -d --build game-service
docker compose up -d --build api-gateway
docker compose up -d --build frontend
```

### 6. Verify
```
curl -s -o /dev/null -w '%{http_code}\n' https://oldbuzzardhockey.com/api/v1/seasons
curl -s https://oldbuzzardhockey.com/api/v1/tournaments        # expect []
```
Then in a browser: the public site is unchanged, `/tournaments` shows "No Classic announced yet",
and the admin console shows the Conley Classic group with the Scheduling group gone.

## Rollback

`git checkout <previous-sha> && docker compose up -d --build` restores the code. The migrations are
additive — new tables and nullable columns — so the previous code runs against the new schema
unchanged, and they do not need reverting. Restore the dump only if data is actually damaged.

## Nothing changes for the league until a tournament exists

Seasons default to `type='LEAGUE'`, no tournament exists on first deploy, so every tournament
surface renders its empty state. The only visible league change is the three retired Scheduling
pages.
