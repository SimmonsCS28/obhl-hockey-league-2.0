# Handoff request — Season selector was never actually designed

**Ask:** Every season selector in the live app today is a developer stopgap — reusing
existing tokens/classes so it doesn't look broken, but never actually specified by
Claude Design as part of any page's layout. None of them went through a design pass.
This handoff asks Design to properly design the season selector for each page it
belongs on, as part of that page's design, rather than leaving it as an ad hoc widget
bolted onto an otherwise-designed page.

## Pages that need the selector designed in (page itself is otherwise already redesigned)
These pages are built and dark-themed; the selector on them today just reuses the
shared `.obi-season-select` class with no real design thought given to placement,
sizing, or how it relates to the rest of the page's toolbar/filters. Design should
treat it as a first-class element of each page's layout:

- **Teams** — `frontend/src/components/public/TeamsPage.jsx` (currently sits in a
  toolbar below the hero)
- **Players** — `frontend/src/components/public/PlayersPage.jsx` (same toolbar
  pattern)
- **Standings** — `frontend/src/components/public/StandingsPage.jsx` (currently next
  to the points-legend, above the table)
- **Admin shell (global)** — `frontend/src/components/AdminLayout.jsx`, topbar,
  class `.obi-admin-season`. This ONE selector drives every admin tab via
  `SeasonContext` (Overview, Live Score, Game Management, Assignments, Standings,
  Users & Roles, etc. all share it) — design it once as part of the Admin shell,
  not per-module.

Current (undesigned) markup, for reference only — not what it should end up looking
like, just what exists to replace:
```jsx
<select className="obi-season-select" value={...} onChange={...}>
  {seasons.map(s => <option>{s.name}{s.isActive ? ' (Active)' : ''}</option>)}
</select>
```

## Seasons page — bigger scope, the whole page needs designing
- **Seasons page** — `frontend/src/components/public/SeasonsPage.jsx` +
  `SeasonsPage.css`, route `/seasons`. Confirmed: this page has not been redesigned
  at all — white card (`background: white`), `#2d3748` text, `season-dropdown`/
  `season-selector` classes, none of the `--obi-*` tokens. This isn't "the selector
  needs designing," the entire page needs the same treatment the auth screens got.
  Its season selector should be designed as part of that full pass, not separately.
  Current content: a season picker at the top, then a detail card for the selected
  season (name, Active badge, start/end dates, and whatever other season metadata is
  shown — read the full component for the exact field list before designing).
  - **This should be its own follow-up design pass**, not bundled with the Bucket-A
    pages above — flagging it here so it isn't missed, but it's a bigger scope.

## Explicitly excluded — do not spend design effort here
`GoalieSchedule.jsx` / `RefereeSchedule.jsx` / `ScorekeeperSchedule.jsx` each have
their own local season selector (not even synced to the global admin topbar one — a
known inconsistency, but moot). These three pages are already slated for
**retirement** once the Assignments page reaches feature parity (see
`ADMIN_RESTRUCTURE_PLAN.md` and `ASSIGNMENTS_HANDOFF.md`).

## Design tokens
No new tokens needed — `frontend/src/styles/theme.css` covers everything
(`--obi-bg-card`, `--obi-accent`, `--obi-card-border`, `--obi-font-display`/
`--obi-font-body`). The point isn't new tokens, it's actually designing the
selector's placement/sizing/interaction within each page rather than reusing a
generic `<select>` styled just enough to not look broken.
