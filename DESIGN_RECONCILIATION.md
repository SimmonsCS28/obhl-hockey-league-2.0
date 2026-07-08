# Design ↔ Implementation Reconciliation

Tracks where the built app (`ui-ux-redesign`) diverges from the **current** Claude Design, in BOTH directions:
- **(A)** things implemented that aren't in the design yet → back-port to the design or consciously account for them
- **(B)** newer designs not yet built → bring through a handoff and implement

Started after v3, because Claude Design has evolved past the v1/v2/v3 handoff packages.

## How to feed the current design to Claude Code
`DesignSync` can't auth in this (desktop) environment. Provide the current design one of these ways:
- Claude Design → **"Send to Claude Code Web"** (seeds the project into the workspace), or
- **Export a fresh handoff package** to a folder (like the v1/v2/v3 packages in Downloads) and point me at it, or
- **Screenshots per page** (slower fallback).

Once I can read the current design, I'll fill in the design column and finalize the gap list below.

## Implementation surface (current — what the app actually exposes)
- **Public:** Home, Seasons, Teams, Team Roster, Players, Standings, Schedule, Game Preview, Game Recap, Rules, Signup, Forgot/Reset Password, Shift Confirm, Account Settings.
- **Dashboards:** `/user` (PlayerDashboard), `/user/shifts` (UserDashboard) — **two separate** dashboards.
- **Staff (v3):** `/user/open-slots` (Open Slots), `/user/goalie-availability` (Goalie Availability).
- **Coordinator:** `/coordinator` (Coordinator Console — Goalie/Ref/Scorekeeper tabs).
- **Admin:** `/admin` (Overview, Live Score Entry, Game Management, Assignments, Standings[placeholder], Teams, Players, Schedule, Seasons, Draft[soon], Users & Roles, Announcements, Rules Editor, staff schedules), `/admin/schedule`, `/admin/teams/:id`.
- **GM:** `/gm`, `/gm/team`, `/gm/schedule`.
- **Legacy role layouts (pre-redesign, still routed):** `/goalie`, `/referee`, `/scorekeeper` (+ live score); `/user/goalie`, `/user/referee`, `/user/scorekeeper` (orphaned — no dashboard links after v3).

## (A) Implemented but NOT in current Claude Design — account for / back-port
1. **Logged-in public header nav buttons.** `PublicLayout` renders GM Dashboard / Admin Dashboard / Coordinator / My Shifts / My Dashboard / Account Settings / Log Out when authenticated. The design's public header instead uses a compact **user pill** (e.g. "KD · Blue · ADMIN · LOG OUT") and moves role access into the dashboard's **"Preview Your Access"** switcher. → Our button row is a stopgap the unified-Dashboard design supersedes.
2. **Two separate dashboards** (`/user` PlayerDashboard + `/user/shifts` UserDashboard). The design has **one unified Dashboard** (see B1).
3. **`SCOREKEEPER_COORDINATOR` as a distinct role** (migration 035). Verify whether the design's role model treats scorekeeper coordination as its own role or folds it under the ref coordinator. [confirm vs design]
4. **Legacy orphaned routes** (`/user/goalie`, `/user/referee`, `/user/scorekeeper`; `/goalie`, `/referee`, `/scorekeeper` layouts) — predate the redesign, not in current design; candidates for retirement.

## (B) In Claude Design (newer) but NOT implemented — build via handoff
1. **Unified user Dashboard** (confirmed via screenshot). One dashboard with: identity header + **"Preview Your Access"** role switcher (Player / Goalie·Official / General Manager), tabs (**My Week / Officiating / Team Management**), an **"Action Needed"** coordinator-assigned confirm/decline card, **Your Next Game** (I'm In / Can't Make It), **Last Game** stats, **My Schedule**. Replaces our two older dashboards and much of the header nav.
2. **Sectioned Rules Editor** (confirmed via screenshot). Admin SECTIONS list + per-section title/rich-text + Edit/Preview/Publish; public Rules page renders grouped sections with a proper ToC. Replaces the single-blob rules model. (Also tracked in memory `v3-claude-design-followups`.)
3. **[unknown]** other pages may have evolved since the v1/v2/v3 handoffs — pending a full design read.

## Next handoff — request checklist (relay to Claude Design)
Because this is a reconciliation (diff both directions + wire data), ask the handoff to include:
1. **Coverage** — every current screen (not just new ones), OR an explicit "what's new/changed since the v3 handoff" list, so drift on already-built pages is caught.
2. **Manifest/README** — each file: screen name, intended route, one-line purpose (like the v1/v2/v3 packages).
3. **Unified Dashboard in full** — every state: each "Preview Your Access" role view (Player / Goalie·Official / GM), each tab (My Week / Officiating / Team Management), the Action Needed card states, and empty/loading states.
4. **Sectioned Rules Editor** — admin editor (sections list, add/edit/reorder/delete, preview, publish) AND the public Rules render (grouped ToC + sections).
5. **Navigation / IA** — the public header **logged-in** state (user pill + its menu contents), the admin left-nav module list/order, and any global nav changes. (Needed to reconcile our impl-only header buttons.)
6. **Data contracts** — what each dynamic element binds to (endpoints/fields), like the v3 README. Critical for wiring (dashboard Next Game / Action Needed / stats, etc.).
7. **Role & permission model** — which roles see which screens/tabs/actions; and confirm whether scorekeeper coordination is **its own role** or under the ref coordinator (we built `SCOREKEEPER_COORDINATOR` as its own role).
8. **Theme/token changes** — any color/font/spacing changes since v3.
9. **Shared components** — header, footer, buttons, cards, chips, badges, form controls (for chrome consistency).
10. **Interaction notes** — what controls do, and flows/transitions between screens (+ modals/toasts).

## Deltas to verify against a fresh design read
- Public header logged-in state (design's user pill vs our button row).
- Whether the admin nav / module set matches the latest design.
- Any already-restyled pages that changed in the design since their handoff.
- The three visual polish items in memory `v3-claude-design-followups` (role-picker contrast, Goalie Availability meta row, Rules page sectioning).

---

# v4 reconciliation — findings & build plan
Source: `C:\Users\Simmo\Downloads\Website theme integration (4)\design_handoff_obhl_v4` (full snapshot: 16 screens + README + screenshots). Read each `.dc.html` at build time; README is the contract.

## Resolved / confirmed
- **`SCOREKEEPER_COORDINATOR` is its own role** — v4 §3 confirms three separate coordinator roles. Our migration 035 is correct. (A3 closed.)
- **Public header logged-in state** — design uses a compact **user pill** (avatar · name/team · Admin link if admin · Log Out), NOT our row of dashboard buttons. (A1 → back-port.)
- **Two dashboards → one** — design has a single unified **Dashboard**; our PlayerDashboard + UserDashboard are superseded. (A2 → B1.)
- **Both polish items are now in the design:** role/name chips brightened (§8a) and Goalie Availability date/count split to two lines (§8b).

## Build/back-port plan (prioritized)

### Tier 1 — quick polish / back-port (small, mostly frontend)
1. **Goalie Availability** — split date-range and games-count onto two lines (§8b). *[resolves polish #2]*
2. **Role-name chip contrast** — brighten role chip text (`#D4DCE3`–`#CBD6DE` on `rgba(157,185,205,.16–.18)`) in the Users table + role picker (§8a). *[resolves polish #1]*
3. **Public header** — replace the logged-in dashboard-button row with the **user pill** (§2b). *[A1]*
4. **Admin nav** — add **Standings** module (design lists it in OPERATIONS); verify module set/order vs §2c; add the sidebar **Coordinator Console** launcher link.
5. **Rink vocabulary** — sheets = **Cardinal / Eagle** (Tubbs→Eagle), venue = **Sun Prairie Ice Arena** (§8). Confirm sheet names with owner.

### Tier 2 — Unified Dashboard (LARGE — frontend + backend)
New `/dashboard` replacing `/user` + `/user/shifts`. Zones: My Week (`USER`), Officiating (`GOALIE`/`REF`/`SCOREKEEPER` tabs), Team Management (`GM`) — gated by real roles (drop the "Preview your access" toggles).
- **Backend:** `GET /me/dashboard` aggregation (nextGame, lastGame+stats, mySchedule w/ per-game rsvp, actionNeeded); **`POST /games/:id/rsvp {in|out}`** — genuinely NEW (player self-RSVP per game); reuse v3 (`/shifts/pending`→Action Needed, `/me/assignments`, `/open-slots`, `/goalie/availability`); GM roster `PATCH /players/:id {num?,skill?}`.
- **Frontend:** build the 3 zones + Action Needed + Next/Last game + My Schedule + officiating role tabs (reusing v3 data) + GM roster editor.
- **Cleanup:** retire PlayerDashboard + UserDashboard; repoint My Shifts / My Dashboard links → `/dashboard`.

### Tier 3 — Sectioned Rules (NET-NEW — backend + admin + public)
- **Backend:** rules `sections[]` model (migration: `id, group ∈ {gen,game,mou}, title, content HTML, order`) + `GET/PUT /admin/rules`, `POST /admin/rules/publish`, `GET /rules`; migrate the existing single blob into seed sections; sanitize HTML on write.
- **Admin Rules Editor** module: sections list + ▲▼ reorder + rich-text body editor (block style/B·I·U/lists/clear) + Add/Delete (min 1) + Edit/Preview toggle + Publish.
- **Public Rules page:** render grouped ToC (by `group`) + section bodies from `sections[]` (replaces the blob + auto-heading ToC). *[resolves polish #3]*

### Notes
- **RSVP** (player marks in/out for their own games) is a new backend concept — not in the current schema; needs a table + endpoint.
- The Dashboard **Officiating** zone is a new UI surface over EXISTING v3 data — mostly wiring, not new backend.
- Minor: `accentColor` is a per-page prop in the design; keep it single-sourced in `theme.css` (no change needed).
