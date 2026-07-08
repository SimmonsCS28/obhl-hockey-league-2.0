# Handoff request — Assignments: staffing filter + goalie availability panel

**Ask:** Add two things to the admin **Assignments** page so it reaches feature parity
with the old per-role Goalie/Referee/Scorekeeper Schedule pages and those can be
retired (per `ADMIN_RESTRUCTURE_PLAN.md`, which already calls for consolidating all
admin staffing into Assignments):

1. An **assigned / unassigned filter** for the games table.
2. A **goalie availability override panel** (admin can mark a goalie unavailable/
   available for a specific date, overriding their own self-reported availability).

**Not in scope — already solved:** a season selector. `AdminAssignments` already reads
its season from the global topbar switcher in `AdminLayout.jsx` (shared across every
admin tab via `SeasonContext`); it doesn't need its own. The old `GoalieSchedule.jsx`
has a redundant local one that just won't get ported over.

## Current state
- Component: `frontend/src/components/admin/AdminAssignments.jsx` +
  `AdminAssignments.css`. Nav: Operations → Assignments (`/admin?tab=assignments`).
- One row per game, in one combined table: Goalies (home/away, 2 selects), Referees
  (2 selects), Scorekeeper (1 select). Each `<select>` is a direct-write override —
  changing it calls `api.updateGame(gameId, { field: value })` immediately, no
  confirm/publish step. An unfilled slot shows "— unassigned —" and the select gets a
  soft red border (`.obi-asgn-select.is-unset`).
- Above the table: a week-chip row (`.obi-chip` / `.obi-chip.is-active`, "All" +
  each week number) and a note: "Direct admin override — changes save straight to
  each game. For the self sign-up → confirm → publish workflow, use the Coordinator
  Console" (links to `/coordinator`).
- Card/table pattern: `.obi-asgn-table-wrap` (dark card, `var(--obi-bg-card)`,
  `border-radius: 12px`), header row `.obi-asgn-header` (uppercase muted labels on
  `rgba(0,0,0,0.25)`), rows `.obi-asgn-row` with `rgba(157,185,205,0.07)` separators.

## What the old pages have that Assignments doesn't (the gap)
Reference: `frontend/src/components/admin/GoalieSchedule.jsx` +
`StaffSchedule.css` (same pattern duplicated in `RefereeSchedule.jsx` /
`ScorekeeperSchedule.jsx` for their one role each — light/legacy-adjacent styling,
NOT the target look, just the source of truth for behavior).

**1. Assigned/unassigned filter.** On `GoalieSchedule` it's a `<select>` next to the
week filter: "All Games / Assigned / Unassigned", filtering by whether
`goalie1Id`/`goalie2Id` are set.
   - **Open question for Design (and worth a product call before building):**
     Assignments is multi-role per row (5 slots: 2 goalie, 2 ref, 1 scorekeeper), so
     "assigned" isn't a single yes/no per row the way it was on the single-role old
     pages. Proposed default — **"Unassigned" = at least one of the 5 slots is empty;
     "Assigned" = all 5 filled** — but flagging this as an assumption, not a decided
     spec. An alternative is per-column filtering (e.g. a small chip per role: Goalies
     / Refs / Scorekeeper, each independently toggleable to show only rows missing
     that role) which might actually be more useful for an admin triaging open slots
     across all three roles at once. Design should pick a direction and show it.

**2. Goalie availability override panel.** On `GoalieSchedule`, appears only when a
specific week is selected (not "All Weeks"): a table of goalies (rows) × that week's
distinct game dates (columns), each cell a clickable badge — "✓ Available" /
"✗ Unavailable" — click toggles it via `api.adminMarkGoalieUnavailable(goalieId, date)`
/ `api.adminRemoveGoalieUnavailability(goalieId, date)`. Hover state previews the
toggle ("⟳ Override"); a saving state shows "⟳ Saving...". This overrides the
goalie's own self-reported availability (used elsewhere to gray out/filter unavailable
goalies from assignment dropdowns — see `isGoalieAvailable()` in the same file).
   - In Assignments this only makes sense once a single week is selected (same
     constraint as today), so it should probably render below the table exactly like
     it does now, gated on the week-chip selection (not "All").

## Design system to build within
Everything needed already exists in `frontend/src/styles/theme.css` (see
`--obi-bg-card`, `--obi-accent`, `--obi-error`/`--obi-success`, `--obi-card-border`,
`--obi-font-display`/`--obi-font-body`) and the patterns already live in
`AdminAssignments.css` (chips, table card, select styling) — match those, don't
introduce a new visual language. `--obi-success` (`#7FB59A`) / `--obi-error`
(`#E08A8A`) are the natural fit for the Available/Unavailable badge colors.

## Deliverable format
Same as prior handoffs — an `.dc.html` prototype (or screenshot set) with a short
README, dropped into a new `Website theme integration` folder in Downloads.
