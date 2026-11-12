# WS0: service authorization hardening

This branch protects Game and Stats mutations even when a request reaches the service directly.
It is a locally validated remediation, not a completed production security assessment.

## Authorization policy

| Surface | Allowed callers |
| --- | --- |
| Public game, event, roster and statistics reads | Anonymous; existing player field masking remains |
| Game creation/deletion, schedule/bracket changes, revert-to-scheduled and direct staff edits | ADMIN or internal backend credential |
| Scores, start/finalize/reopen, events, penalty validation and game awards | ADMIN, SCOREKEEPER or internal backend credential |
| Player CRUD and raw statistics writes | ADMIN or internal backend credential |
| GM jersey update | ADMIN or GM |
| GM skill update | Existing ADMIN/GM/GOALIE_COORDINATOR policy; coordinator remains goalie-only |
| GM roster reads | ADMIN, GM, GOALIE_COORDINATOR or internal backend credential |
| Referee/scorekeeper self-service | Existing gateway endpoints determine the user from authentication, then call Game with backend credentials |

Game and Stats validate the gateway's JWT signatures and expiration. Anonymous writes return 401;
authenticated callers without the required role return 403. A JWT claiming INTERNAL_SERVICE cannot
acquire backend privileges. Unknown service routes are denied. Internal keys are compared in constant
time, and Game/Stats reject blank, short or the formerly committed default key on startup.

The public `/games-api/` and `/stats-api/` compatibility aliases now route through the gateway.
Nginx removes incoming `X-Internal-Service-Key`; gateway browser proxies forward user JWTs, never
add backend credentials, and never forward that internal header. An explicit multipart proxy preserves
schedule CSV uploads. The gateway also proxies legacy `/game-events` calls.

## Deployment requirements: config first, then sequential services

This is the proposed rollout procedure, not an executed production deployment or completed mixed-version
rehearsal. Rehearse against the actual previous images on an isolated stack before applying it to the
host. The earlier instruction to rebuild everything together is superseded: the production runbook
requires one Java build at a time because of host memory limits.

### Preflight and credentials

1. Schedule a maintenance window and pause scoring, draft finalization, coordinator edits, and other
   writes throughout the transition. Verify host Nginx can reach loopback ports; this Compose layout
   assumes Nginx runs on the Docker host. If it runs elsewhere, resolve that topology before proceeding.
2. Back up the database, current host Nginx config, Compose config, and protected environment file.
   Record the deployed commit and tag the current images for rollback **before** rebuilding: local
   Compose build tags will otherwise be overwritten. Keep credentials and backup data out of Git/logs.
3. Before pulling the updated Compose file, add a new unpredictable `INTERNAL_SERVICE_KEY` of at least
   32 characters to the protected host `.env` (`openssl rand -base64 48` can generate one). Use one
   value for all four Java services, different from `JWT_SECRET`. Compose's required-variable syntax
   blocks even unrelated commands if this value is missing.
4. Preserve the current `JWT_SECRET` for this rollout and supply that same value to Gateway, Game,
   and Stats. Game now needs it. Treat JWT rotation as a separately coordinated operation rather than
   mixing a second credential transition into this deployment.
5. Pull/check out the reviewed release, retain host-specific configuration, and run
   `docker compose config --quiet` to validate interpolation without printing secrets. Confirm the
   rollout's selected images exist locally; `--no-build` must use the recorded previous images.

### Recreate old images with the shared environment

The main baseline (`4cecb31`) reads `internal.service.key` through Spring configuration in all four
services, so `INTERNAL_SERVICE_KEY` overrides the old property value. Confirm this behavior for the
**actual deployed images**, including profile/command-line overrides, during rehearsal. Do not assume
editing `.env` changes already-running containers. Check key agreement without printing key values.

Run each command separately and verify that service's health before continuing:

```bash
docker compose up -d --no-deps --no-build --force-recreate api-gateway
docker compose up -d --no-deps --no-build --force-recreate league-service
docker compose up -d --no-deps --no-build --force-recreate game-service
docker compose up -d --no-deps --no-build --force-recreate stats-service
```

Do not build the new enforcement code until all four old images use the shared environment. New
Game/Stats reject a present-but-wrong internal key; old gateway staff writes also lack the header
required by new Game. A partially upgraded stack is not ready for user traffic.

### Rebuild sequentially, then switch host Nginx

Run one build/replacement at a time, checking health after each step and stopping on failure:

```bash
docker compose up -d --no-deps --build api-gateway
docker compose up -d --no-deps --build league-service
docker compose up -d --no-deps --build game-service
docker compose up -d --no-deps --build stats-service
docker compose up -d --no-deps --build frontend
```

Gateway first ensures coordinator/staff requests carry the backend header before Game enforces it.
Game must be updated before Stats so finalization's aggregation calls carry the header. The unchanged
JWT secret remains consistent throughout. `--no-deps` avoids restarting other services implicitly.

Only after these services are healthy, patch the **active host** Nginx `/games-api/` and `/stats-api/`
locations using `deploy/oldbuzzardhockey.nginx` as a reference. Preserve TLS, maintenance, and other
host-specific settings; do not blindly overwrite the live config. Both aliases must target the gateway
and strip incoming `X-Internal-Service-Key`. The new gateway's multipart upload handler must exist
before this routing switch. Run `sudo nginx -t`, then reload only if validation succeeds.

### Smoke checks and rollback

Before reopening writes, verify through the public host:

- Anonymous game/player reads succeed; anonymous writes are denied; ordinary members cannot score,
  reopen games, change schedules, or mutate player records.
- Admin CSV upload succeeds through the gateway, with no multipart/header regression.
- A scorekeeper can score, finalize, reopen to correct a mistake, and re-finalize a designated test game;
  team totals stay correct. Schedule/staff changes and revert-to-scheduled remain admin-only.
- Coordinator assignments, referee/scorekeeper self-signup/cancellation, GM jersey edits, and draft/player
  operations retain their expected permissions. Use designated test records and verify cleanup.
- Backend/database listener bindings are loopback-only and externally unreachable; the host proxy is
  the public entry point. A browser-supplied internal header cannot elevate an ordinary user's access.

On failure, keep writes paused and restore the recorded previous image set and compatible Nginx/Compose
configuration in a coordinated rollback. Keep the new shared key consistent across the restored old
services where verified compatible; do not mix credentials or silently restore a compromised default.
This PR has no schema migration, so application rollback does not require restoring the database and
losing intervening writes. Rolling back to old authorization code restores its known vulnerabilities;
treat that as a temporary maintenance state, not a safe completed deployment.

No production deployment, secret rotation, credential-use test or history rewrite was performed.
The removed `GM_LOGIN_CREDENTIALS.md`, `login.json` and `prod_backup.sql` remain in old Git history.
Owners must assess whether the data and credentials are authentic, rotate/revoke affected live
credentials, and decide on history cleanup and incident handling independently of merging this branch.

## Validation on November 12, 2026

- Baseline local requests: gateway rejected anonymous writes with 401; direct Game, Stats and Nginx
  aliases returned 400 for malformed JSON, demonstrating parsing without an authorization rejection.
  No successful unauthorized mutation was attempted.
- Java 21 test suites: Game **55**, Stats **5**, Gateway **62**, all passing (122 total).
  Tests include actual controller/security chains, valid and invalid JWTs, internal identity, role
  denials before parsing, public reads, privileged writes, coordinator transport, stats aggregation
  transport and UTF-8 multipart forwarding without backend-header propagation.
- Disposable workflow smoke test: **27** successful HTTP assertions, including admin season/team/player/game
  creation, denied USER score writes, successful SCOREKEEPER writes, public player masking, goalie
  coordinator ratings, referee/scorekeeper signup and cancellation, internal staff updates, and cleanup
  of all records created by the smoke test.
- All four backend production images and the frontend production image build successfully.
- Healthy disposable Docker stack: **74/74** HTTP assertions pass through gateway, direct-service
  and Nginx routes. Anonymous/invalid/expired callers get 401; USER gets 403; authorized malformed
  requests reach validation (400); reads succeed (200). Supplying an internal header to a browser
  proxy does not elevate a USER token.

The fresh database migration sequence failed at `015_create_roles_table.sql` because
`roles.is_system_role` was absent after the earlier roles-table creation. To isolate authorization
validation, the disposable stack used `SPRING_JPA_HIBERNATE_DDL_AUTO=update`. This override is **not**
in the application Compose file. The test database also needed a missing `roles.created_at` column
and a REF seed row to exercise the existing staff flows. These results do not establish that the clean migration sequence
works, and the existing database/bootstrap problem remains separate work.

## Reproduce the regression suites

Review follow-up on November 12, 2026: scorekeepers retain `POST /games/{id}/unfinalize`, matching
the existing Reopen Game UI. The Game suite was rerun in the isolated Java 21 test image: **56 tests,
zero failures/errors/skips**. The added regression verifies scorekeeper/admin/backend access and
denies anonymous callers, unrelated roles, and a user JWT claiming INTERNAL_SERVICE. Revert-to-scheduled
and schedule/staff changes remain restricted. The earlier Gateway/Stats and HTTP results above were
not rerun for this one-route change. PR #43 supplies CI separately; no GitHub security-suite result
or production rehearsal is claimed here.

From the repository root, with Docker available:

```bash
docker build -f deploy/security-test.Dockerfile backend/game-service
docker build -f deploy/security-test.Dockerfile backend/stats-service
docker build -f deploy/security-test.Dockerfile backend/api-gateway
```

The Dockerfile-specific ignore file deliberately includes tests, overriding the gateway's production
`.dockerignore` that excludes `src/test`. These tests do not need a running database or real secrets.

For the isolated `obhl-security` stack used during this session (its generated JSON and credentials
are ignored local artifacts):

```bash
python3 scripts/test-service-authorization.py .obhl-local-security.compose.json --report .obhl-local-security-report.json
docker compose -p obhl-security -f .obhl-local-security.compose.json down
```

The HTTP script accepts only the named disposable project with loopback ports. It refuses redirects,
uses malformed request bodies, produces no token/secret output and exits nonzero if any assertion
fails. Its expected 400 for an authorized caller confirms access to parsing, not a successful write.

## Remaining scope

WS0 stays open for credential/history remediation and production verification. This change does not
claim an audit of every gateway/League endpoint, staff-to-game ownership, or GM-to-team ownership.
Existing role-level access is preserved; any stricter resource ownership policy needs its own review
and regression coverage. WS1 and later workstreams have not been started.
