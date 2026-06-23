# v3 Build Plan — Officials & Goalie Scheduling Loop

Design source: `C:\Users\Simmo\Downloads\Website theme integration (2)\design_handoff_obhl_v3`
Branch: `ui-ux-redesign` (coordinator backend already merged in — commit `5b6dd0b`).

v3 = three gated pages on one assignment lifecycle:
`open → signed-up (official self-signs) → pending (coordinator assigns/confirms, email sent) → confirmed (player accepts → publishes everywhere)`.

## What already exists (post-merge, reuse)
- `shift_assignments` (game_id, season_id, role GOALIE|REF, slot 1|2, user_id, status PROPOSED|CONFIRMED|DECLINED, published, confirm tokens…).
- `CoordinatorService`: getAssignments(season,role), propose, withdraw, publishWeek (writes CONFIRMED → game slot cols).
- Confirm flow: token (`/auth/shift-confirm`) + in-app (`/shifts/pending`, `/shifts/{id}/respond`).
- Confirmed assignments already publish to game.goalie1/2Id, referee1/2Id (consumed by Game Preview/Recap).

## Backend gaps to build (v3 needs these)
1. **Status: add `SIGNED_UP`.** Map to v3 vocab in the API: no row = `open`; `SIGNED_UP` = `signed-up`; `PROPOSED` = `pending`; `CONFIRMED` = `confirmed`. (status col is varchar — no migration needed for the new value.)
2. **SCOREKEEPER as an assignable slot.** Role is varchar; allow `SCOREKEEPER` (1 slot, slot=1). Extend `getAssignments` + publish to write `game.scorekeeperId`. Goalie slots map to teams: slot 1 = home goalie, slot 2 = away goalie (label by team name in the API/UI).
3. **Open Slots (self-service)** — new `OpenSlotsController/Service`:
   - `GET /open-slots?role=&week=` → unfilled REF/SCOREKEEPER slots across the season (a slot is open when it has no signed-up/pending/confirmed row). Synthetic slot id = `${gameId}-${role}-${slot}`.
   - `POST /slots/:id/signup` (creates a `SIGNED_UP` row) / `DELETE /slots/:id/signup` (undo). Ref/scorekeeper only — never goalie.
4. **Goalie weekly availability** — new `goalie_availability` table (migration 034): `(user_id, season_id, week, status available|unavailable)`; null = not set.
   - `GET /goalie/availability` → weeks w/ status + games count; `PUT /goalie/availability`.
   - Coordinator goalie pool filters/flags by this week's availability.
   - NOTE: this supersedes the date-based goalie_unavailability for the UI; keep the old table for now, just don't surface it.
5. **Coordinator Console actions** — extend `CoordinatorController`:
   - `GET /coordinator/assignments?role=&week=` → per-slot `{status, player, team?}` incl. signed-up + scorekeeper.
   - assign → pending+email (≈ existing propose); `…/confirm` (confirm a signed-up → pending); clear (≈ withdraw → open).
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
