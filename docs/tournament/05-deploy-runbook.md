# C League Classic deploy runbook

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
and the admin console shows the C League Classic group with the Scheduling group gone.

## Rollback

`git checkout <previous-sha> && docker compose up -d --build` restores the code. The migrations are
additive — new tables and nullable columns — so the previous code runs against the new schema
unchanged, and they do not need reverting. Restore the dump only if data is actually damaged.

## Nothing changes for the league until a tournament exists

Seasons default to `type='LEAGUE'`, no tournament exists on first deploy, so every tournament
surface renders its empty state. The only visible league change is the three retired Scheduling
pages.

---

## Deployment record — 2026-08-18

Executed in the order above. Prod HEAD `6afc686` → `c43038d`.

| Step | Result |
|---|---|
| Pre-flight | 6 containers healthy. One untracked drift file (`frontend/src/components/api.js`) left in place. Swap 2.0Gi present, postgres `unless-stopped`. |
| Disk | 76% used with 4.4G free — below comfort for four image builds. Pruned 6.099GB of build cache → 47%. Ended at 60% / 7.5G free after the rebuilds. |
| Backup | `/home/ubuntu/backup-pre-tournament-2026-08-18-1857.sql`, 548K, 25 tables, completion marker confirmed. |
| Migrations 046–053 | All 8 applied, each reported ok. Re-run safe (idempotent). |
| Schema check | `seasons.type`, `games.tournament_stage`, `games.period_count`, `teams.seed`, `players.user_id`, `tournaments`, 3 draft tables, `chk_tournament_never_active` — all present. |
| Data check | 2 seasons, both `LEAGUE`. 165 games (150 REGULAR_SEASON, 15 PLAYOFF). Unchanged. |
| league-service | Healthy, started in 17.7s — `ddl-auto=validate` accepted the new schema, which is the real proof the migrations match the entities. |
| stats-service | Healthy, 14.2s. |
| game-service | Healthy, 14.4s. |
| api-gateway | Healthy, 21.9s. |
| frontend | Up. Build stamp `2026-08-18T19:09:59Z`. Rebuilding it restarted api-gateway as a dependency; it came back healthy. |

Post-deploy verification:

- `/`, `/api/v1/seasons`, `/api/v1/tournaments`, `/tournaments` → all 200.
- `GET /api/v1/seasons` returns only the two `LEAGUE` seasons — the default-deny `?type=LEAGUE` filter holds.
- `GET /api/v1/tournaments` → `[]`. Correct: none created yet.
- 20 teams, 165 games — league data untouched.
- `PUT /stats-api/players/deactivate-unregistered` without `seasonIds` → **400**, confirming the
  positive-list guard is live and a malformed call now deactivates nobody instead of everybody.
- Log scan across all four services: no real errors. The only hits were the 400 above (deliberate)
  and two gateway DEBUG startup lines matching on class names.

**Nothing tournament-facing is visible to members yet** — the first tournament has to be created in
Admin → C League Classic → Tournament Setup, and stays unpublished until the publish toggle is set.

---

## Rename deploy — "The Conley Classic" → "The C League Classic"

Don Conley asked for the tournament not to be named after him. The chocolate-milk Player of the
Game award stays exactly as it is; only his name comes off.

Migration `058_rename_tournament_to_c_league_classic.sql` does the data half: tournament name and
slug, the backing season's name, the `scoring_profile` key and its column DEFAULT, and the
`COMMENT ON TABLE` set by 048.

```
docker exec -i obhl-postgres psql -U obhl_admin -d obhl_db -v ON_ERROR_STOP=1 \
  < database/migrations/058_rename_tournament_to_c_league_classic.sql
```

Then rebuild `league-service`, `game-service` and `frontend` as in step 5 above.

**Order does not matter here.** The natural worry is that the migration writes `classic-v1` while
old jars are still running and `TournamentScoringProfile.byKey` rejects the unknown key — but
`byKey` has no production callers. `TournamentPointsPolicy` resolves the profile from the constant,
not from the column, so the stored key is written and echoed in the DTO and never read back.
`byKey` also still accepts `conley-v1` regardless, for a restored backup.

**Expected prod impact is DEFAULT + COMMENT only.** As of the 2026-08-18 record above,
`GET /api/v1/tournaments` returned `[]` — no tournament row had been created yet. All three UPDATEs
are guarded (`WHERE ... ILIKE '%conley%'`) and will report `UPDATE 0` if that is still true. If a
tournament *has* since been created, they rewrite it and the old
`/tournaments/the-conley-classic-2026` URL stops resolving; the bare `/tournaments` entry point is
unaffected, since it resolves by year and published flag rather than by slug.

The `tcc-` CSS prefix is deliberately left alone — see the note at the top of `tournament-theme.css`.
