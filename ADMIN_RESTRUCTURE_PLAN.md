# Admin Console Restructure — match v2 design, preserve all functionality

Goal: restructure the admin to the v2 design's module breakdown for a cleaner UI/UX, WITHOUT
losing any functionality we currently use. New design-only features get built as UI now and
"plumbed" to real data later. Anything the design drops gets a tracked placeholder.

## Target sidebar (v2 groups + our must-keep items)
```
OPERATIONS
  Overview            ← NEW (design). Build dashboard UI; wire to real data later.
  Live Score Entry    ← EXISTING LiveScoreEntry, promoted to top-level (game picker → live entry).
  Game Management     ← box-score editor for past/finalized games (goals/penalties + Edit Game).
  Assignments         ← NEW (design). Game × Goalie/Ref/Scorekeeper dropdowns + week filter.
                         Wire to existing game assignment fields (goalie1Id/referee1Id/etc.).
                         Coordinator confirm/publish workflow = PLACEHOLDER (lives on coordinator-feature branch).

LEAGUE SETUP
  Schedule            ← EXISTING ScheduleManager (done).
  Seasons             ← EXISTING SeasonManagement (done).
  Teams               ← EXISTING TeamManagement (done). [v2-GAP: design omits; KEPT — core functionality]
  Players             ← EXISTING PlayerManagement (done). [v2-GAP: design omits; KEPT — core functionality]
  Draft Tool          ← EXISTING DraftDashboard (functional, NOT yet restyled — no design). Keep accessible.

PEOPLE
  Users & Roles       ← EXISTING UserManagement (done).
  Announcements       ← EXISTING AnnouncementsManagement (done).
  Rules Editor        ← EXISTING LeagueRulesAdmin (done; sectioned-model upgrade deferred).

SCHEDULING  [v2-GAP group: design folds these into "Assignments"; KEPT until Assignments fully replaces them]
  Goalie Schedule     ← EXISTING GoalieSchedule (done).
  Referee Schedule    ← EXISTING RefereeSchedule (done).
  Scorekeeper Schedule← EXISTING ScorekeeperSchedule (done).
```

## What changes structurally
- Current `Game Management` tab = ScorekeeperContent (GameSchedule list + LiveScoreEntry + admin Standings sub-tabs).
  Split into design's three Operations items:
  - **Live Score Entry** (top-level): pick an in-progress/scheduled game → LiveScoreEntry.
  - **Game Management** (top-level): box-score editor for a selected game (reuse game-events API + existing edit/finalize).
  - The **admin Standings** sub-tab has no home in the v2 admin → see Placeholders.
- Add `Overview` and `Assignments` as new modules + routes (`?tab=overview`, `?tab=assignments`, `?tab=livescore`, `?tab=gamemgmt`).

## Placeholders / track for Claude Design (functionality the v2 admin drops or doesn't cover)
- [ ] **Admin Standings**: v2 admin has no standings module (standings exist on the redesigned PUBLIC site). Action: removed from admin nav; if an admin standings view is still wanted, ask Claude Design for one. (Public `/standings` still covers viewing.)
- [ ] **Teams / Players admin**: not in the v2 admin design at all — KEPT in our sidebar (League Setup). Ask Claude Design to design these admin screens so they match.
- [ ] **Goalie / Referee / Scorekeeper Schedule** admin screens: not in v2 (folded into Assignments). KEPT for now. Revisit once Assignments covers their use.
- [ ] **Draft Tool**: no v2 design yet (marked "soon" in design). KEPT functional + unstyled. Ask Claude Design for a Draft mockup.

## New features to build now (UI), plumb later
- [ ] **Overview** dashboard: 4 stat cards + "Needs Attention" panel + "This Week" game list (v2 Admin.dc.html "Overview"). Wire stats/attention to real data incrementally; OK to start with computed-where-easy + clearly-marked placeholders.
- [ ] **Assignments**: table of games with Goalie/Ref/Scorekeeper dropdowns (pools = users holding those roles) + week filter chips. Save via existing game-update (goalie1Id, referee1Id, referee2Id, scorekeeperId). The confirm/publish coordinator workflow is a PLACEHOLDER (real impl on `coordinator-feature`).
- [ ] **Game Management** box-score editor: list/select game → show goals & penalties (from game events) with add/remove + Edit Game/finalize. Reuse LiveScoreEntry's data layer.

## Execution notes
- `AdminLayout` + `AdminDashboard` are the structural core — restructure them CENTRALLY (not in parallel worktrees) since everything routes through them.
- Keep all existing data fetching/props. New modules reuse existing api.js methods.
- Follow the dark-theme conventions in REDESIGN_HANDOFF.md (obi tokens, clickable cards = div role=button, etc.).
- Branch: `ui-ux-redesign` (or a child branch for the restructure).
