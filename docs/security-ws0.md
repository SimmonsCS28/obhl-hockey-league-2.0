# WS0: service authorization hardening

This branch protects Game and Stats mutations even when a request reaches the service directly.
It is a locally validated remediation, not a completed production security assessment.

## Authorization policy

| Surface | Allowed callers |
| --- | --- |
| Public game, event, roster and statistics reads | Anonymous; existing player field masking remains |
| Game creation/deletion, schedule/bracket changes, reopening games and direct staff edits | ADMIN or internal backend credential |
| Scores, start/finalize, events, penalty validation and game awards | ADMIN, SCOREKEEPER or internal backend credential |
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

## Deployment requirements

1. Set a new, unpredictable `INTERNAL_SERVICE_KEY` (at least 32 characters) in the backend environment.
   `openssl rand -base64 48` produces a suitable value. Use the same value in all four services and a
   different value from `JWT_SECRET`. Neither credential belongs in frontend configuration.
2. Supply the same existing or newly rotated `JWT_SECRET` to Gateway, Game and Stats. Game now needs it.
3. Rebuild/restart all four backends and the frontend together, and install/reload the updated host
   Nginx configuration. Compose binds its published ports to 127.0.0.1; host Nginx remains the public entry.
   This deployment model assumes Nginx runs on the Docker host, as in the checked-in configuration.
4. Verify public reads, admin scheduling/CSV uploads, scoring/finalization, draft/player operations,
   GM/coordinator workflows and staff signup/cancellation in the target environment.

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
