# Deferred follow-ups

Things found while building the Conley Classic that are **out of scope for the tournament work** and
were deliberately left alone. Recorded here so they are not lost, and so the decision to defer is
visible rather than implied.

Nothing in this list is a tournament bug. Most predate the tournament entirely — the tournament work
just walked past them. **Revisit after the tournament feature ships.**

Status legend: 🔴 live bug affecting users · 🟠 security · 🟡 correctness/debt · ⚪ cleanup

---

## 🔴 1. The `/referee` route is unreachable by everyone

[`App.jsx:106`](frontend/src/App.jsx:106) gates `/referee` with
`<ProtectedRoute requiredRoles={['REFEREE']}>`, but **`REFEREE` is not a role in the database.**
Verified against `SELECT name FROM roles`: the full set is `ADMIN, GM, GOALIE, GOALIE_COORDINATOR,
REF, REF_COORDINATOR, SCOREKEEPER, SCOREKEEPER_COORDINATOR, USER`. The referee role is `REF`.

**Impact: 34 users currently hold `REF`** and all of them get "Access Denied — Required role:
REFEREE" on that route. The sibling route `/user/referee` ([`App.jsx:179`](frontend/src/App.jsx:179))
correctly requires `REF` and does work, so referees are not completely stranded — but
`referee/RefereeSchedulePage.jsx` is currently dead code reachable by nobody.

Found while checking that deleting the legacy admin Scheduling pages had not broken the routes that
share `StaffSchedule.css`. It also means one of that stylesheet's two importers is a dead route
(`/goalie` requires `GOALIE`, which does exist, so that one is live).

**Decide first, then fix:** is `/referee` meant to be reachable, or has `/user/referee` superseded
it? If superseded, delete the route and the page rather than repointing the role.

## 🟠 2. game-service is unauthenticated and published to the internet

`backend/game-service` has no `spring-boot-starter-security`, no `SecurityConfig` and no JWT filter,
and `oldbuzzardhockey.nginx` proxies it publicly at `location /games-api/`. Unauthenticated, from
anywhere:

```
POST   /games-api/games/{id}/finalize
POST   /games-api/games/generate
DELETE /games-api/games/season/{id}      <- deletes an entire season's schedule
POST   /games-api/games/{id}/events
PATCH  /games-api/games/{id}/bracket-slot
```

Partially mitigated in practice by `FeignClientConfig` forwarding the caller's JWT: a write that
needs to call back into the gateway (e.g. team standings on finalize) fails with 401 when there is
no token. That is a side effect, not a control — anything not needing a downstream authenticated
call still succeeds.

This is why all tournament writes were put in league-service instead: nginx does not expose port
8001, so the gateway is the only route in.

**Fix:** `stats-service`'s `SecurityConfig` + `JwtAuthenticationFilter` +
`InternalServiceAuthentication` is a working template, roughly 150 lines. Alternatively stop
exposing `/games-api/` and fix the gateway's multipart proxy so uploads can go through it.

## 🟡 3. The league's 7+ penalty deduction has never worked

[`PointsCalculator.countTeamPenalties()`](backend/game-service/src/main/java/com/obhl/game/service/PointsCalculator.java)
is a `// TODO` that returns `0`, so the documented "7 or more penalties in a game = −1 point" rule
has never been applied to any league game.

It **is** implemented for tournament games (`TournamentPointsPolicy` counts penalty events per
team). Implementing it for the league path was deliberately left out of the tournament work because
**it would retroactively change historical league standings** the moment any old game were
re-finalized, and that is a league decision, not a side effect of building a tournament.

**Decide:** enforce it going forward only, backfill and accept the standings change, or drop the
rule from the rulebook.

## 🟡 4. `GET /teams` and `GET /players` return tournament rows when unfiltered

Audited 2026-08-16 with real tournament data present. **14** call sites use `api.getTeams()` with no
`seasonId` — more than the ~6 originally estimated. Most are id→name/colour lookup maps where extra
rows are harmless, and every public page passes a season.

Verified safe: `AdminStandings.jsx:35` filters client-side on `selectedSeasonId`.

**The one with real impact is [`UserModal.jsx:67`](frontend/src/components/UserModal.jsx:67)** — its
team picker will offer tournament teams (Blue, Red…) when assigning a user to a league team. Admin
only, no data corruption, hence deferred.

**Fix:** make `GET /teams` and `GET /players` exclude tournament-season rows by default when no
`seasonId` is given, mirroring the `?type=LEAGUE` default already added to `GET /seasons` in
migration-046 work. Needs a season-type join in the gateway's `TeamService` and stats'
`PlayerService`.

## 🟡 5. `players.season_id` and `teams.season_id` have no foreign key

Every other season-scoped table cascades on season delete — `games`, `player_stats`, `goalie_stats`,
`leagues`, `season_goalies` and `tournaments` all carry
`FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE`. **`players` and `teams` carry no
season foreign key at all**, because their `season_id` was added later by Hibernate's `ddl-auto`
rather than by a migration.

So deleting any season silently orphans its players and teams — rows pointing at a season id that no
longer exists, which then surface in any query filtering by team rather than by season.

Found 2026-08-17 by deleting a test tournament and finding 5 players and 2 teams left behind.
Worked around in `TournamentService.delete`, which now removes them explicitly and says why.

**Not fixed properly here on purpose:** adding the FKs would also change league behaviour, since
deleting a league season would begin cascade-deleting its players and teams where today it does not.
That is a bigger decision than the tournament delete path. Any fix also has to clean up whatever
orphans already exist on production first, or the constraint will not apply.

## 🟡 6. Duplicate key `getMyAssignments` in `api.js`

ESLint `no-dupe-keys` at `frontend/src/services/api.js:540`. The later definition silently wins, so
the earlier one is dead code and editing it has no effect. A duplicate `getSeasons` with the same
hazard was removed during Phase 0; this one was left because it is unrelated to seasons and
deserves its own look at which of the two behaviours is wanted.

## 🟡 7. Global unscoped `button {}` rule leaks into every component

`DraftDashboard.css` (~line 86) declares a bare `button { ... }` tag selector — including
`border-radius: 4px !important`, `height: 36px`, `white-space: nowrap`, `justify-content: center`,
`color: white` — and is bundled globally, so it applies to every button in the app. New components
have to re-declare all of it defensively; `TournamentAdmin.css` does exactly that and says so in its
header.

A fix exists on the **unmerged** branch `claude/sharp-ellis-1eeb87`, which scopes it to
`:where(.draft-dashboard) button, .btn-draft` and removes the 38 `!important` workarounds it had
forced into other stylesheets. Once that lands: drop the defensive block in `TournamentAdmin.css`,
and do the owed `.gpb-btn !important` cleanup in `GoalieProposerBar.css`.

## ⚪ 8. `fix_team_constraints.sql` in the repo root is now redundant

Its contents were folded into `database/migrations/046_add_season_type.sql`, which applies them
idempotently as part of the numbered sequence. The root-level copy is now a misleading duplicate
that implies a manual step still exists. Safe to delete once 046 is on production.

## ⚪ 9. `docker-compose-prod.yml` is invalid and `deploy.sh` is harmful

- `docker-compose-prod.yml` line 31 contains a literal escaped `\n` inside a `ports:` value plus a
  duplicate `ports:` key — it would fail to parse. Nothing references it; production uses the plain
  `docker-compose.yml`. Delete it, or fix it, before someone reaches for `-f` during a deploy.
- `deploy.sh` is superseded and would now do damage: it runs `git reset --hard` and then `sed`s
  frontend sources to rewrite API base URLs, which would clobber the current
  `import.meta.env.VITE_API_URL` handling. Delete it or clearly mark it dead.

## ⚪ 10. `TECHNICAL_DEBT.md` items 2 and 3 are stale, and `CLAUDE.md` repeats one

- Item 2 says nginx cannot proxy the Spring services and that only static files are served. The live
  `oldbuzzardhockey.nginx` proxies all three (`/api/`, `/games-api/`, `/stats-api/`) using
  `proxy_http_version 1.0` + `Connection close`. **`CLAUDE.md` repeats this stale claim**, so it
  actively misleads future work.
- Item 3 says hardcoded production IPs are scattered through the frontend. `frontend/src` is now
  clean of them; the real remaining issue is four different base-URL idioms.

## ⚪ 11. Accepted losses from retiring the Scheduling pages

- **Assigned/unassigned filter.** The old Goalie Schedule page had a filter that
  `AdminAssignments.jsx` never gained. Deliberately accepted when the legacy pages were deleted. The
  open design question from `ASSIGNMENTS_HANDOFF.md` still stands: Assignments is multi-role per row
  (5 slots), so "assigned" is not one yes/no — per-column chips may be better than a single filter.
- **`StaffSchedule.css` could be trimmed** to only the classes `GoalieSchedulePage` and
  `RefereeSchedulePage` actually use, now that its three original consumers are gone. Low value, and
  see item 1 first — one of those two pages may itself be dead.
