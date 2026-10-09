# v3 Build Plan — Officials & Goalie Scheduling Loop

Design source: `C:\Users\Simmo\Downloads\Website theme integration (2)\design_handoff_obhl_v3`
Branch: `ui-ux-redesign` (coordinator backend already merged in — commit `5b6dd0b`).

v3 = three gated pages on one assignment lifecycle. **Two parallel paths to `confirmed`:**
- **Self-signup (refs/scorekeepers):** `open` → official picks it up on Open Slots (`signed-up`) → coordinator **Confirms** the pickup → `confirmed`. No email-confirm loop — the official already opted in by signing up. Coordinator may instead **Reassign** (override).
- **Coordinator-assign (any role, incl. goalies):** `open` → coordinator **Assigns** someone (`pending` / "Awaiting <name>", email sent) → that person accepts (token/in-app) → `confirmed`.

`confirmed` publishes onto the game everywhere. **Reassign** (override an existing pickup/assignment) and **Clear** (→ open) are available on filled slots.

Status chips / actions (per the v3 Coordinator Console screenshots):
| Slot state | Chip | Coordinator actions |
|---|---|---|
| no row | `OPEN` | Assign |
| official self-signed (SIGNED_UP) | `SIGNED UP` | **Confirm**, Reassign |
| coordinator-assigned, awaiting accept (PROPOSED) | `AWAITING <name>` | Reassign, Clear |
| accepted (CONFIRMED) | `SET · CONFIRMED` | Reassign |

Game-level badges: `N OPEN`, `X / Y SET`.

## What already exists (post-merge, reuse)
- `shift_assignments` (game_id, season_id, role GOALIE|REF, slot 1|2, user_id, status PROPOSED|CONFIRMED|DECLINED, published, confirm tokens…).
- `CoordinatorService`: getAssignments(season,role), propose, withdraw, publishWeek (writes CONFIRMED → game slot cols).
- Confirm flow: token (`/auth/shift-confirm`) + in-app (`/shifts/pending`, `/shifts/{id}/respond`).
- Confirmed assignments already publish to game.goalie1/2Id, referee1/2Id (consumed by Game Preview/Recap).

## Backend gaps to build (v3 needs these)
1. **Status: add `SIGNED_UP`.** Map to v3 vocab in the API: no row = `open`; `SIGNED_UP` = `signed-up`; `PROPOSED` = `pending`; `CONFIRMED` = `confirmed`. (status col is varchar — no migration needed for the new value.)
2. **SCOREKEEPER as an assignable slot — mirrors REF exactly** (self-signup → coordinator Confirm/Reassign; goalies are coordinator-assign only, no self-signup). Role is varchar; allow `SCOREKEEPER` (1 slot, slot=1). Extend `getAssignments` + publish to write `game.scorekeeperId`. Goalie slots map to teams: slot 1 = home goalie, slot 2 = away goalie (label by team name in the API/UI).
   - **Publish requirement:** a `CONFIRMED` goalie/ref/scorekeeper must land on the game's slot columns (`goalie1/2Id`, `referee1/2Id`, `scorekeeperId`) so it shows on ALL game pages that display staff (Game Preview, Game Recap, schedule, dashboards). Verify scorekeeper surfaces alongside goalie/ref after publish.
3. **Open Slots (self-service)** — new `OpenSlotsController/Service`:
   - `GET /open-slots?role=&week=` → unfilled REF/SCOREKEEPER slots across the season (a slot is open when it has no signed-up/pending/confirmed row). Synthetic slot id = `${gameId}-${role}-${slot}`.
   - `POST /slots/:id/signup` (creates a `SIGNED_UP` row) / `DELETE /slots/:id/signup` (undo). Ref/scorekeeper only — never goalie.
4. **Goalie weekly availability** — new `goalie_availability` table (migration 034): `(user_id, season_id, week, status available|unavailable)`; null = not set.
   - `GET /goalie/availability` → weeks w/ status + games count; `PUT /goalie/availability`.
   - Coordinator goalie pool filters/flags by this week's availability.
   - NOTE: this supersedes the date-based goalie_unavailability for the UI; keep the old table for now, just don't surface it.
5. **Coordinator Console actions** — extend `CoordinatorController`:
   - `GET /coordinator/assignments?role=&week=` → per-slot `{status, player, team?}` incl. signed-up + scorekeeper.
   - **Assign** (open→pending) → `SIGNED_UP`? no: creates PROPOSED + sends accept email (≈ existing `propose`).
   - **Confirm** (signed-up→confirmed) → NEW `confirmSignup`: a `SIGNED_UP` row goes straight to `CONFIRMED` (no token loop; the official already opted in). Optional courtesy "you're confirmed" email, no accept link.
   - **Reassign** = clear the current row + Assign someone else (→ new PROPOSED/awaiting).
   - **Clear** (→ open) ≈ existing `withdraw`.
6. **api.js**: add all new client methods (open-slots, signup, goalie availability, coordinator console actions). **Do this in the backend phase so the page sessions don't all edit api.js.**

## Model shift to be aware of (track)
- v3 changes **refs/scorekeepers from "mark availability" → "self-sign-up for slots."** So `RefAvailability.jsx` + the ref side of `StaffAvailabilityService` are **superseded by Open Slots**. Goalies still use availability (now weekly/positive). Plan to retire RefAvailability after Open Slots ships.

## Frontend
- **Open Slots** page (refs/scorekeepers) — new.
- **Goalie Availability** page (goalies) — new (weekly toggles, month filter, bulk actions).
- **Coordinator Console** — redesign existing `CoordinatorDashboard`/`CoordinatorBoard` to v3 (role tabs Goalie/Ref/Scorekeeper, week scope, summary cards, available-goalie pool band, per-game slot rows with assign/confirm/reassign/clear + inline candidate picker).
- Dashboard entry links (gated): Open Slots (ref/scorekeeper), Goalie Availability (goalie), Coordinator Console (coordinator).
- Restyle/keep `PendingShifts` + `ConfirmShift` (player-accept side) to the obi theme.

## Tie-ins
- Admin **Assignments** (`AdminAssignments.jsx`, currently placeholder) operates on the SAME records — wire it to the coordinator endpoints (all-roles admin view).
- Game Preview/Recap already read confirmed assignments — verify once scorekeeper publishes.

## Sequencing
- **Phase 1 — backend + api.js (central, sequential, ONE session):** status/scorekeeper/open-slots/goalie-availability/console actions + migration 034 + all api.js methods. Everything else depends on these contracts.
- **Phase 2 — frontend pages (parallelizable, disjoint files; no api.js edits since Phase 1 added them):** Open Slots / Goalie Availability / Coordinator Console can each be a session.
- **Phase 3 — integration:** dashboard links, wire Admin Assignments, retire RefAvailability, end-to-end lifecycle test (signup → coordinator confirm → player accept → publish → shows on Preview/Recap), restyle PendingShifts/ConfirmShift.
