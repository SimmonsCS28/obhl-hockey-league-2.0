# Spec: schema integrity — stop Hibernate racing the migrations

**Status: FAST FOLLOW. Do this immediately after the Draft Tool redesign ships.**

Found while adding migration `059_add_player_draft_fields.sql` during the draft work. Not urgent
enough to block that redesign, not safe to leave indefinitely — it silently corrupts the relationship
between migration files and the actual database, and it already has in production.

Everything below was **verified experimentally on 2026-08-29**, not inferred: a database was built
from `database/migrations/*.sql` alone on the isolated 5433 test instance (`docker-compose.test.yml`),
and each service was then booted against it with `ddl-auto=validate`.

---

## The problem

Three of four services run `spring.jpa.hibernate.ddl-auto=update`. Hibernate therefore creates and
alters columns from the JPA entities at startup, racing the hand-run migrations. Whichever gets there
first wins, and because migrations are written `ADD COLUMN IF NOT EXISTS`, the loser silently
no-ops — leaving the database permanently different from what the migration file claims.

That is exactly what happened with `059`. Hibernate created all four `players` columns from
`Player.java` before the migration was run, as `varchar(255)` and nullable-with-no-default. The
migration's `ADD COLUMN IF NOT EXISTS` then skipped every one of them. It had to be rewritten to
*converge* the schema — explicit `ALTER ... TYPE` / `SET DEFAULT` / `SET NOT NULL` after each `ADD` —
so the end state is identical whichever ran first.

That convergent pattern is a **workaround for the symptom**. It should not become the house style; it
makes every future migration longer and more fragile. Once `validate` is on, a plain `ADD COLUMN` is
correct and safe again.

Migration `039_backfill_goalie_players.sql:11-14` documents the same disease from an earlier outbreak:
`players.email` / `season_id` / `is_veteran` "exist in production today (added via Hibernate
`ddl-auto=update`, not a tracked migration)".

## Why `validate` is the fix

`ddl-auto=validate` makes Hibernate refuse to boot when entities and schema disagree. Drift stops
being silent and becomes a loud startup failure. You cannot diverge if the application will not start.

---

## Current state (measured, not assumed)

| Service | Effective runtime setting | Boots with `validate`? |
|---|---|---|
| **league-service** | `validate` (no docker override) | **Yes — already doing this in production** |
| **stats-service** | `update` (`application.properties:17`, `application-docker.properties:4`) | **Yes — passes, flip is free** |
| **game-service** | `update` — `application-docker.properties:10` overrides its own base `validate` | **Yes — passes, flip is free** |
| **api-gateway** | `update` (`application.properties:24`) | **No** — fails, see below |

Two things worth knowing before starting:

- **league-service already runs `validate`.** This is not a theoretical migration — one service has
  been doing it all along, which is the proof it works in this stack.
- **game-service's base config already says `validate`.** Only the docker profile overrides it, which
  looks like a temporary workaround nobody removed. Deleting one line restores the original intent.

### api-gateway's blocker

It fails on `SERIAL` (int4) primary keys where the JPA entity uses `Long` (bigint):

    Schema-validation: wrong column type encountered in column [id] in table [goalie_profiles];
    found [serial (Types#INTEGER)], but expecting [bigint (Types#BIGINT)]

Full set of int4 primary keys whose entity is `Long`:

| Column | Entity | Created by |
|---|---|---|
| `goalie_profiles.id` | `GoalieProfile` | `019_create_goalie_profiles.sql:5` |
| `goalie_unavailability.id` | `GoalieUnavailability` | |
| `roles.id` | `Role` | |
| `staff_unavailability.id` | `StaffUnavailability` | |
| `user_roles.role_id` | FK to `roles.id` — must move with it | |

`announcements.id` is also int4, but its entity (`Announcement`, league-service) uses `Integer`, so it
matches and must be **left alone**. `league_rules.id` is int4 with no conflicting entity.

**This mismatch is live in production right now.** It is harmless only because nothing validates.

> ⚠️ **Hibernate reports only the FIRST validation error.** Fixing these five may reveal more. Expect
> to iterate — which is the main argument for doing step 3 (CI) early rather than last.

---

## The deeper problem: migrations cannot rebuild the database

**5 of 60 migrations fail on a clean database**, applied in numeric order:

| Migration | Error |
|---|---|
| `015_create_roles_table.sql` | column `is_system_role` of relation `roles` does not exist |
| `028b_seed_league_rules.sql` | relation `league_rules` does not exist |
| `031_add_coordinator_roles.sql` | column `is_system_role` does not exist |
| `035_add_scorekeeper_coordinator_role.sql` | column `is_system_role` does not exist |
| `039_backfill_goalie_players.sql` | aborts: "No active season found" (arguably by design) |

So `validate` would be protecting a source of truth that is not yet fully trustworthy. That does not
argue against `validate` — it argues for fixing these too.

Compounding factors, all previously known:

- **No version tracking.** `run-migrations.bat` globs `*.sql` and re-executes everything, every run.
- **Duplicate `013`** — `013_create_draft_saves.sql` and `013_create_user_roles.sql`. Ordering between
  them is filename-alphabetical, i.e. accidental.
- **Init-only mount.** `docker-compose.yml:16` mounts migrations at `/docker-entrypoint-initdb.d`,
  which Postgres runs *only* against an empty volume. Existing databases never pick up new files
  automatically — which is why they get applied by hand, and why Hibernate usually wins the race.

---

## The work

### 1. Switch to `validate` — the actual prevention (~half a day)

- **stats-service** — set `application.properties:17` and `application-docker.properties:4` to
  `validate`. Verified passing.
- **game-service** — delete the `ddl-auto` line from `application-docker.properties:10` so the base
  `validate` applies. Verified passing.
- **api-gateway** — write `060_widen_int4_primary_keys.sql` altering the five columns above to
  `BIGINT` (dropping and recreating dependent FK constraints as needed), then flip
  `application.properties:24` to `validate`.
- Re-run the probe after each flip. Do **not** flip all four in one commit — one service per commit,
  so a failure is trivially revertable.

### 2. Adopt Flyway (a real project, not a chore)

Gives a `flyway_schema_history` table, checksums, once-only ordered execution, and in-process
execution at startup *before* Hibernate validates. It also kills the init-only-mount problem outright
and rejects the duplicate `013` rather than silently guessing at the order. Fix the 5 failing
migrations as part of establishing the baseline.

### 3. CI guard (do this early, not last)

Build a fresh database from `database/migrations/*.sql`, boot each service with
`SPRING_JPA_HIBERNATE_DDL_AUTO=validate`, and fail the build on `SchemaManagementException`. This is
exactly the probe run on 2026-08-29, and it would have caught `goalie_profiles` years ago. Because
Hibernate stops at the first error, this is what makes step 1 converge instead of dragging out.

Reproduction, for whoever picks this up:

```bash
docker compose -f docker-compose.test.yml up -d
docker network connect obhl-hockey-league-20_obhl-network obhl-test-db
for f in $(ls database/migrations/*.sql | sort -t/ -k3 -V); do docker exec -i obhl-test-db psql -U obhl_user -d obhl_test -v ON_ERROR_STOP=1 -q < "$f"; done
docker run --rm --network obhl-hockey-league-20_obhl-network -e SPRING_PROFILES_ACTIVE=docker -e SPRING_DATASOURCE_URL="jdbc:postgresql://obhl-test-db:5432/obhl_test" -e SPRING_DATASOURCE_USERNAME=obhl_user -e SPRING_DATASOURCE_PASSWORD=obhl_password -e SPRING_JPA_HIBERNATE_DDL_AUTO=validate -e JWT_SECRET=probe-only obhl-hockey-league-20-stats-service
```

## Out of scope

Renaming the duplicate `013` — Flyway's baseline handles it. And the `teams.gm_id` type overload,
which is a data-modelling problem rather than a schema-integrity one; it is tracked with the draft
work instead.

## Once this lands

Drop the convergent `ALTER`-after-`ADD` boilerplate from the migration house style, and simplify the
header comment on `059_add_player_draft_fields.sql` — it exists only to explain this bug.
