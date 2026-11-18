# Technical Debt & Future Improvements

This document tracks known technical debt, workarounds, and future improvements needed for the OBHL application.

## 🔴 High Priority

### 1. API Gateway Multipart File Upload Proxy
**Status**: Implemented and locally validated in PR #38; production verification pending.

The former direct-service upload workaround is superseded. `GameProxyController` now has an explicit
multipart schedule-upload endpoint that forwards file bytes and the caller's JWT. `ScheduleManager`
uses the `/games-api` compatibility alias; the updated host Nginx reference sends that alias through
the gateway. Browser requests never receive an internal service credential.

**Remaining work**:
- Deploy the gateway before switching live Nginx aliases, following `docs/security-ws0.md`.
- Smoke-test authorized CSV uploads and denied unauthenticated uploads in the target environment.
- Preserve the explicit multipart handler: the generic String-body proxy is not a file-upload path.

**Files affected**:
- `backend/api-gateway/src/main/java/com/obhl/gateway/controller/GameProxyController.java`
- `frontend/src/components/ScheduleManager.jsx`
- `deploy/oldbuzzardhockey.nginx`

---

### 2. Nginx API Routing and Historical Transfer-Encoding Workaround
**Status**: Gateway routing locally validated in PR #38; live host configuration still requires rollout.

Earlier deployment notes reported duplicate Transfer-Encoding headers and worked around them with
direct service access. They are historical context, not instructions to expose ports or bypass auth.
The current host Nginx reference proxies `/api/`, `/games-api/`, and `/stats-api/` through the gateway;
the frontend container's Nginx serves static files. Local authorization checks cover the proxy aliases,
but do not certify the live host's header behavior or configuration.

**Remaining work**:
- Compare `deploy/oldbuzzardhockey.nginx` with the active host configuration; preserve TLS and unrelated settings.
- Patch the live aliases only after the new gateway and backends are healthy; run `nginx -t` before reloading.
- Verify both ordinary JSON and multipart responses through the public host. Diagnose any 502s without restoring public service bypasses.

---

## 🟡 Medium Priority

### 3. Centralize API URLs in Frontend
**Status**: Partially addressed  
**Issue**: Frontend has hardcoded production IP addresses scattered across multiple files instead of using a centralized configuration.

**Current State**:
- API base paths are still declared in multiple components as well as the shared client.
- Schedule uploads use `/games-api`; the shared client uses `/api/v1`. Both go through the gateway with the updated host configuration.
- Inventory any remaining hardcoded origins before declaring URL centralization complete.

**Improvement Needed**:
- Create a single `config.js` file with environment-based URL configuration
- Use environment variables for production/development/staging URLs
- Update all components to use the centralized config

**Files to Update**:
- `frontend/src/services/api.js`
- `frontend/src/components/ScheduleManager.jsx`
- `frontend/src/components/public/*.jsx`
- All other public pages

---

### 4. CORS Configuration Review
**Status**: Working but permissive  
**Issue**: CORS is currently configured to allow all origins (`*`) with credentials disabled.

**Current Config**:
- `SecurityConfig.java`: `setAllowedOriginPatterns(Arrays.asList("*"))` + `setAllowCredentials(false)`

**Improvement Needed**:
- For production, restrict CORS to specific origins (frontend domain only)
- Re-enable credentials if needed for authentication
- Review if wildcard is acceptable for your security requirements

**Files Affected**:
- `backend/api-gateway/src/main/java/com/obhl/gateway/config/SecurityConfig.java`
- `backend/api-gateway/src/main/java/com/obhl/gateway/config/CorsConfig.java`

---

### 5. Port Exposure Security
**Status**: Loopback bindings implemented in PR #38; production exposure verification pending.

Compose now binds Postgres (5432), all four Java services (8000–8003), and the frontend (8080)
to `127.0.0.1`. The public entry point is host Nginx, which routes browser API traffic through the
gateway. Game and Stats independently authorize mutations even if the gateway is bypassed locally.

**Remaining work**:
- Recreate containers with the updated Compose configuration as part of the staged rollout.
- Verify actual listener addresses and external reachability after deployment; close obsolete firewall/security-group allowances where appropriate.
- Keep the backend shared credential out of browser configuration and preserve Nginx header stripping.

This change does not establish that the live server or AWS security groups already match the repository.
See `docs/security-ws0.md` for prerequisites, service order, smoke checks, and rollback boundaries.

---

## 🟢 Low Priority

### 6. Incomplete API Implementations
**Status**: Mock data in place  
**Issue**: Several API methods in `frontend/src/services/api.js` use mock data instead of real API calls.

**Methods with TODO comments**:
- Line 81: `updateGame()`
- Line 95: `deleteGame()`
- Line 113: `submitScore()`
- Line 132: `validateGamePenalties()`
- Line 135: `saveGamePenalties()`
- Line 162: `getLiveGameStatus()`
- Line 165: `getGamePlayers()`
- Line 175: `getTeamPlayers()`

**Fix Needed**:
- Implement actual API endpoints in backend services
- Replace mock data with real API calls
- Update frontend to use real endpoints

---

### 7. Live Score Entry Backend Integration
**Status**: Frontend implemented, backend TODO  
**Issue**: `LiveScoreEntry.jsx` component has placeholder comments for backend integration.

**Files Affected**:
- `frontend/src/components/LiveScoreEntry.jsx` (lines 75, 256)

**Fix Needed**:
- Implement backend endpoints for loading/saving live game events
- Connect frontend to real endpoints

### 8. Player profile detaches on email change
**Status**: Known gap, by design in v1 (2026-09-12)

**Issue**: `player_profiles` (migration 063) is keyed by `lower(players.email)` because email is the
only identity carried into each new season row. Two edits silently orphan a profile: an admin
changing `players.email` on a season row (Player Management), or a member changing their account
email in Account Settings (`AuthService.updateProfile` touches `users` only). The card then falls
back to the legacy per-season columns and initials; the old profile row and its photo file linger.

**Current Workaround**: None. `player_profiles.user_id` is recorded when resolvable, so a repair
query can re-key by user when needed.

**Proper Fix Needed**: On either email change, re-key the profile (`UPDATE player_profiles SET
email_lower = ...`) or, better, make `user_id` the primary link once `players.user_id` is populated
for league players (today only the tournament draft writes it).

**Affected files**:
- `backend/api-gateway/src/main/java/com/obhl/gateway/service/PlayerProfileService.java`
- `backend/api-gateway/src/main/java/com/obhl/gateway/service/AuthService.java` (`updateProfile`)
- `frontend/src/components/PlayerManagement.jsx` (admin email edit)

### 9. `PlayerRepository.findByEmail` throws for returning players
**Status**: Latent bug, noted 2026-09-12

**Issue**: `findByEmail` returns `Optional<Player>`, but `players` has one row per person PER SEASON,
so any email present in two seasons makes Spring Data throw
`IncorrectResultSizeDataAccessException`. `GET /players/exists` and `GET /players/by-email` call it.
`Login.jsx` uses `/exists` via `api.checkPlayerProfileExists`, so a returning player's login-time
check 500s and is swallowed. Both endpoints also match email case-sensitively while `users.email`
is case-insensitive-unique (044).

**Proper Fix Needed**: Switch both to `findByEmailIgnoreCaseOrderBySeasonIdDesc` (added for the
profile card's `/players/history`) and take the first row, or drop the endpoints if nothing
depends on them.

**Affected files**:
- `backend/stats-service/src/main/java/com/obhl/stats/repository/PlayerRepository.java`
- `backend/stats-service/src/main/java/com/obhl/stats/controller/PlayerController.java` (`playerExists`, `getPlayerByEmail`)

---

## 📝 Notes

- **Last Updated**: 2026-11-12
- **Priority Legend**: 🔴 High | 🟡 Medium | 🟢 Low
- Historical notes recorded production-IP substitution and service-port security-group allowances. Recheck live configuration during rollout; these are not the intended routing model or a current exposure assessment.

## 🔍 How to Add New Items

When adding technical debt:
1. Choose appropriate priority (High/Medium/Low)
2. Include **Status**, **Issue**, **Current Workaround** (if any), **Proper Fix Needed**
3. List affected files with line numbers
4. Reference conversation steps or PR numbers if available
5. Update "Last Updated" date
