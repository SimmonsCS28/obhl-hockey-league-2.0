# v3 Phase 2 — Frontend Pages (Parallel Session Brief)

Three independent frontend builds on branch `ui-ux-redesign`. **Backend is DONE (Phase 1, commits `a4e15a2` + `1d09642`)** — do NOT touch backend or `api.js`; every endpoint/client method you need already exists (listed below). Each session owns a disjoint set of files, so all three merge clean.

Design source (read your page's `.dc.html` — inline styles + `{{ }}`/`<sc-for>`/`<sc-if>` templating; treat as visual reference, map to React):
`C:\Users\Simmo\Downloads\Website theme integration (2)\design_handoff_obhl_v3\`

## Sessions / worktrees
| Session | Worktree | Branch | Builds |
|---|---|---|---|
| A | `../obhl-v3-openslots` | `v3-openslots` | Open Slots page |
| B | `../obhl-v3-goalieavail` | `v3-goalieavail` | Goalie Availability page |
| C | `../obhl-v3-console` | `v3-console` | Coordinator Console |

**Backend is SHARED on `:8000` (already running from the main worktree, with seeded data). Do NOT run `docker compose` or `/dev-up` from your worktree** — that spins up a *separate* compose project with its own fresh, EMPTY Postgres volume, and every query will return no data. Run ONLY `npm run dev` in `frontend/`; Vite proxies to `localhost:8000` automatically and will pick 5174+ if 5173 is taken. (If you ever genuinely need your own backend, you must seed it from `database/migrations/*` + `database/seeds/*` first — never test against an empty DB.) Login `simmonscs28` / `Welcome1!` (ADMIN — sees all coordinator tabs). Active season id is **13**.

## Conventions (all sessions)
- **Theme tokens** in `src/styles/theme.css` (CSS vars: `--obi-bg`, `--obi-bg-card #13171d`, `--obi-accent #F6A91C`, `--obi-icy #9DB9CD`, `--obi-text #EAEEF2`, `--obi-text-secondary/-muted`, `--obi-success #7FB59A`, `--obi-error #E08A8A`, `--obi-font-display` Saira Condensed, `--obi-font-body` Saira, `--obi-card-border`, `--obi-divider`). Shared primitives in `src/styles/obi.css` (`.obi-container`, `.obi-page-title`, `.obi-eyebrow`, `.obi-chip`, `.obi-season-select`, `.obi-ghost-btn`, `.obi-cta-btn`). Use vars, never hardcode hex.
- **Clickable cards/rows = `<div role="button" tabIndex={0} onClick onKeyDown>`, NEVER `<button>`** (a button collapses flex-column layouts — learned the hard way).
- **Team colors:** `import { resolveTeamColor, textOn } from '../../constants/teamColors'` → `resolveTeamColor(team.teamColor)` for bg, `textOn(bg)` for text.
- **Active season:** `import { useSeason } from '../../contexts/SeasonContext'` → `const { selectedSeasonId } = useSeason();` (fall back to id 13 only in dev if null).
- **Dates:** game dates arrive as UTC ISO without `Z` (e.g. `2026-06-05T00:00:00`). Append `Z` then display in `America/Chicago` (see `PlayerDashboard.toDate`).
- Per-page CSS file next to the component. Run `npm run lint` before committing (pre-existing errors in `PlayerDashboard`/`UserDashboard`/`api.js` are not yours — don't fix them here).

## FROZEN — do not edit (shared / already done)
`styles/theme.css`, `styles/obi.css`, `services/api.js`, `constants/roles.js`, `constants/teamColors.js`, `constants/config.js`, `App.jsx` (routes already added), `AdminLayout.*`, `PublicLayout.jsx`, `main.jsx`, `index.html`, and the dashboards `user/PlayerDashboard.jsx` / `user/UserDashboard.jsx` (dashboard entry links are Phase 3, done centrally). **If you think you need a new `api.js` method, STOP and flag it — do not add one (avoids cross-session conflicts).**

---

## Session A — Open Slots  (`/user/open-slots`, gated REF/SCOREKEEPER)
Replace stub `src/components/user/OpenSlots.jsx`; add `OpenSlots.css`. Design: `OpenSlots.dc.html`.
Serves REF and SCOREKEEPER. A user may hold one or both roles (`useAuth().user.roles`) — show a role toggle if both.

**Data — `api.getOpenSlots(role, seasonId, week?)`** → array of:
```
{ slotId:"123-REF-2", gameId, seasonId, role, slot, week, gameDate, rink,
  homeTeam, awayTeam, state:"OPEN"|"MINE"|"TAKEN", rowStatus, assignmentId, takenByName }
```
**Actions:** `api.signupForSlot(slotId)` (OPEN→MINE), `api.dropSlotSignup(slotId)` (only your own, still SIGNED_UP). Refetch after each.
Group by week/day; week filter (ALL / per-week). Show OPEN as pick-up-able, MINE as drop-able, TAKEN as read-only (`takenByName`).

## Session B — Goalie Availability  (`/user/goalie-availability`, gated GOALIE)
Replace stub `src/components/user/GoalieAvailability.jsx`; add `GoalieAvailability.css`. Design: `GoalieAvailability.dc.html` + the reference screenshot (ALL WEEKS / JUNE / JULY / AUGUST month filter; `N AVAILABLE / N OUT / N NOT SET` summary; MARK ALL AVAILABLE / CLEAR; per-week rows with AVAILABLE/UNAVAILABLE toggle, "This Week" highlight, date range + games count).

**Data — `api.getGoalieAvailability(seasonId)`** → array of:
```
{ week, startDate, endDate, gamesCount, status:"AVAILABLE"|"UNAVAILABLE"|null }   // null = not set
```
**Action:** `api.setGoalieAvailability(seasonId, week, status)` (status `"AVAILABLE"`/`"UNAVAILABLE"`, or `null`/`""` to clear) → returns the updated array. For MARK ALL / CLEAR, loop the weeks.

## Session C — Coordinator Console  (`/coordinator`)
Redesign existing `src/components/coordinator/CoordinatorDashboard.jsx`, `CoordinatorBoard.jsx`, `Coordinator.css` (may add new files under `coordinator/`). Design: `CoordinatorConsole.dc.html` + reference screenshot. Role tabs Goalie / Referee / Scorekeeper are already gated in `CoordinatorDashboard` (`canGoalie/canRef/canScorekeeper`).

The board shows **every slot per game** (open + filled), so derive slots from games and overlay assignments:
- **Games:** `api.getGames(seasonId)` → `{ id, week, gameDate, rink, homeTeamId, awayTeamId, goalie1Id, goalie2Id, referee1Id, referee2Id, scorekeeperId }`. Filter by week.
- **Slots per role:** GOALIE = 2 (**slot 1 = home team goalie, slot 2 = away** — label by team name), REF = 2 (Ref 1 / Ref 2), SCOREKEEPER = 1.
- **Assignments overlay:** `api.getCoordinatorAssignments(seasonId, role, week)` → `[{ id, gameId, slot, userId, userName, status, ... }]`. Match by `(gameId, slot)`.
- **Slot state → chip & actions:** no row = `OPEN` (Assign) · `SIGNED_UP` = `SIGNED UP` (Confirm, Reassign) · `PROPOSED` = `AWAITING <name>` (Reassign, Clear) · `CONFIRMED` = `SET · CONFIRMED` (Reassign). Game badges: `N OPEN`, `X / Y SET`.
- **Goalie pool band:** `api.getCoordinatorGoalieAvailability(seasonId, week)` → `[{ userId, userName, status }]` (who's AVAILABLE that week).
- **Candidate picker:** `api.getUsers({ role })` → users holding that role.

**Actions:** Assign → `api.proposeShift({ gameId, seasonId, role, slot, userId })` (upserts the slot → PROPOSED + email). Reassign → call `proposeShift` again with the new user (it supersedes). Confirm → `api.confirmSignup(assignmentId, role)` (SIGNED_UP→CONFIRMED). Clear → `api.withdrawShift(assignmentId, role)`. Publish → `api.publishShiftWeek(seasonId, role, week)` → `{ publishedCount, unconfirmedSlots[] }` (surface the unconfirmed list).

---

## When done (each session)
`npm run lint`, navigate to your route, smoke-test the actions against the live `:8000` backend, commit on your branch. The parent session merges all three into `ui-ux-redesign`, then does Phase 3 (dashboard entry links, wire Admin Assignments, retire RefAvailability, restyle PendingShifts/ConfirmShift, full lifecycle test).
