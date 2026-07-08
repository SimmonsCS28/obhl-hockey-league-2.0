# Handback: public Seasons page (`/seasons`) — full redesign

## Purpose
The public **Seasons** page (`frontend/src/components/public/SeasonsPage.jsx` +
`SeasonsPage.css`, route **`/seasons`**, in the public nav) lets any visitor pick a
season and see its high-level details. It's the **last surface still on the
pre-redesign light theme** — white card (`background: white`), `#2d3748` text,
`#e2e8f0` borders, none of the `--obi-*` tokens. This is a full page redesign onto
the OBHL dark theme, matching the other public pages (Teams / Players / Standings).

Renders inside the **public site chrome** (PublicLayout header/footer). It's a simple
read-only page: a season picker + a details panel. No forms, no auth, no mutations.

## Current content (what it actually shows)
1. **Page header** — an "Seasons" title bar at the top.
2. **Season selector** — a dropdown of all seasons (each labeled `{name} (Active)` for
   the active one). Changing it swaps the details below. **Use the shared
   `SeasonSelector` component we already built** (`frontend/src/components/common/
   SeasonSelector.jsx`, class prefix `obi-season-picker`) — the same control now on
   Teams/Players/Standings — rather than a bespoke dropdown, so this page joins the
   family. It's driven by the global `SeasonContext` (same as the other public pages).
3. **Season details panel** (for the selected season):
   - **Header row**: the season **name** (large) + an **"Active Season"** badge when
     it's the active season.
   - **A grid of 4 info cards**:
     - **Status** — one of `upcoming` / `active` / `completed` (design a small status
       treatment — e.g. colored pill; current admin uses blue=upcoming, green=active,
       gray=completed, but pick what fits the dark theme).
     - **Start Date** — formatted long date (e.g. "September 1, 2026").
     - **End Date** — formatted long date.
     - **Duration** — a derived human string (e.g. "3 months, 12 days"), computed from
       start/end.

That's the entire page — there is no roster/schedule/standings content here; those
live on their own pages. Keep it a lightweight "season at a glance" card.

## Data
- Seasons come from the shared `SeasonContext` (`useSeason()`): `seasons[]`,
  `selectedSeason`, `selectedSeasonId`, `setSelectedSeasonId`.
- A **season object** has exactly: `{ id, name, startDate (YYYY-MM-DD), endDate
  (YYYY-MM-DD), status ('upcoming'|'active'|'completed'), isActive (bool) }`. There are
  no other fields (no week counts, GM, etc.) to surface — don't invent data the model
  doesn't have.
- Dates are plain `YYYY-MM-DD` strings and must be formatted **without timezone
  conversion** (parse the parts, don't `new Date(string)` — that shifts the day). The
  current code already does this; keep it.

## States to design
- **Loading / empty** — currently just a bare "No seasons available." Give it a proper
  dark-theme empty state.
- **Default / populated** — selector + details for the active season (the default
  selection).
- **Active vs non-active** selected season — the "Active Season" badge shows only for
  the active one; a `completed`/`upcoming` season shows its status but no active badge.

## Design system to build within
Match the redesigned public pages. Reference `TeamsPage` / `StandingsPage` for the
hero + `obi-container` body pattern, the `obi-page-hero` / `obi-eyebrow` /
`obi-page-title` / `obi-page-sub` header treatment, and the dark card/stat-box styling
(`obi-stat-box` on Teams is a close cousin of these info cards). Tokens in
`frontend/src/styles/theme.css` (`--obi-bg`/`--obi-bg-card`/`--obi-accent`/
`--obi-success` for the Active badge/`--obi-card-border`/`--obi-font-display`/
`--obi-font-body`). The season selector is the existing `obi-season-picker` component —
place it deliberately (e.g. leading a toolbar under the hero, like Teams), not as a
bare control.

## Gotcha for whoever implements it (not for Design)
This codebase has no CSS scoping — the current file uses generic classnames
(`.season-selector`, `.info-card`, `.season-header`, `.active-badge`, `.no-data`) that
**collide** with other components (`.season-selector` already clashed with the shared
picker and with `ShiftSignup.css`; `.active-badge` is used by the admin
`SeasonManagement`). The rebuild must use scoped/prefixed classnames (e.g. `obi-seasons-*`),
and — per the recurring global-`button{}` reset in `DraftDashboard.css` — any
`<button>`-styled elements need explicit `height`/`border-radius`/`padding`/
`white-space`/`justify-content`/`align-items` overrides.

## Deliverable format
Same as prior handoffs — an `.dc.html` prototype (populated page + empty state) with a
short README, dropped into a new `Website theme integration` folder in Downloads.
