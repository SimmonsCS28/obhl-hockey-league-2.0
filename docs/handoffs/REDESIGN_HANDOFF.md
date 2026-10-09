# OBHL UI Redesign — Parallel Admin-Module Handoff

We're applying the OBHL design-handoff **dark theme** (Saira fonts, gold accent `#F6A91C`)
across the app. The public site, shared chrome, Donate, and the **Admin shell** are DONE and
committed. This brief is for parallel sessions restyling the remaining **admin module bodies**.

Your branch was created off `ui-ux-redesign`. Work ONLY on your assigned files, commit to your
branch, and do NOT merge — the human reconciles branches afterward.

---

## Design references (read-only, absolute paths)
- v2 admin design: `C:\Users\Simmo\Downloads\Website theme integration (1)\design_handoff_obhl_v2\Admin.dc.html`
  (one big file; each module is a section — search for the module name). Other `*.dc.html` in that folder too.
- v1 tokens/spec: `E:\projects\obhl-hockey-league-2.0\Website theme integration\design_handoff_obhl\README.md`
- These are HTML prototypes; their inline styles map to React + CSS. Reference for the LOOK, not literal markup.

## The theme is already built — REUSE it, don't reinvent
- **Tokens**: `frontend/src/styles/theme.css` — CSS vars incl. `--obi-bg #0b0c0f`, `--obi-bg-elevated #0e1014`,
  `--obi-bg-card #13171d`, `--obi-accent #F6A91C`, `--obi-icy #9DB9CD`, `--obi-text #EAEEF2`,
  `--obi-text-secondary`, `--obi-text-muted`, `--obi-text-dim`, `--obi-success #7FB59A`, `--obi-error #E08A8A`,
  `--obi-warning #E8C26A`, `--obi-card-border`, `--obi-divider`, `--obi-accent-soft`, `--obi-accent-hover`,
  `--obi-font-display` (Saira Condensed), `--obi-font-body` (Saira), `--obi-radius-*`, `--obi-shadow-gold`, `--obi-ring-light`.
- **Shared primitives**: `frontend/src/styles/obi.css` — `.obi-container`, `.obi-page-hero*`, `.obi-eyebrow`,
  `.obi-page-title`, `.obi-page-sub`, `.obi-season-select`, `.obi-chip` / `.obi-chip.is-active` / `.obi-chip-dot`, `.obi-team-dot`.
- **Team colors**: `frontend/src/constants/teamColors.js` — `resolveTeamColor(color)`, `textOn(color)`. Use these for any team color swatch/dot/contrast.
- **Copy patterns from already-redesigned components**: `components/public/StandingsPage.{jsx,css}` (dark table card, header row, rows, team dots, playoff cut), `PlayersPage` (table + filter chips + search box), `TeamsPage` (cards + stat boxes), `SchedulePage` (game rows + week chips + selects + .ics modal), and `components/AdminLayout.css` (dark sidebar/topbar/button styles you should echo).

## FROZEN — do NOT edit (shared across sessions; editing causes merge conflicts)
`frontend/src/styles/theme.css`, `frontend/src/styles/obi.css`, `frontend/src/constants/teamColors.js`,
`frontend/src/constants/config.js`, `frontend/src/components/AdminLayout.{jsx,css}`, `frontend/src/main.jsx`,
`frontend/index.html`. If you think you need a NEW shared primitive, instead add a LOCAL class in your own module's CSS.

## Conventions & gotchas
- Convert light → dark: white/`#f8f9fa` backgrounds → `var(--obi-bg-card)` or `--obi-bg-elevated`; dark text
  (`#1a202c`, `#2d3748`) → `var(--obi-text)` / `--obi-text-secondary`; borders → `var(--obi-card-border)` / `--obi-divider`.
- Titles: `--obi-font-display`, weight 900, often italic. Labels: `--obi-font-display` 700, uppercase, letter-spacing. Body: `--obi-font-body`.
- Table card pattern: wrapper `background: linear-gradient(180deg,#13171d,#10141a); border:1px solid var(--obi-card-border); border-radius:16px; overflow:hidden;`
  header row `background: rgba(0,0,0,0.25)` + muted uppercase; row separators `1px solid rgba(157,185,205,0.07)`.
- Buttons: gold CTA = `background:var(--obi-accent); color:#0b0c0f`. Ghost/secondary = transparent + `--obi-card-border`, hover gold border + `--obi-accent-hover`. Destructive = `--obi-error`.
- **Clickable cards/rows must be `<div role="button" tabIndex={0} onClick onKeyDown>` — NOT `<button>`.** A `<button>` wrapping a flex-column layout collapses in some browsers (we hit this on Teams cards).
- This is a RESTYLE: keep ALL existing data fetching, props, and logic. Change classNames + CSS, light markup tweaks only.
- Modules render inside the dark admin content area; don't set a full-page background — use card/section surfaces.
- Team color resolution: never hardcode a team-color map; import `resolveTeamColor`/`textOn`.

## Verify
Frontend-only; no backend/Docker needed. Worktrees start WITHOUT `node_modules`. To lint/preview:
`cd frontend && npm install` once, then `npx eslint <changed files>`. Preview (`npm run dev -- --port 51xx`) is
optional — final verification happens post-merge in the main repo. Ignore pre-existing warnings
(`react-hooks/exhaustive-deps`; `no-useless-escape` in a password regex).

## Already done (consistency reference)
Public: Home, Standings, Teams, Players, Schedule, GamePreview, GameRecap, Rules, TeamRoster + PublicLayout chrome
+ DonateButton/DonatePopup. Admin: shell (`AdminLayout`) + Game Management toolbar (`ScorekeeperContent.css`).

## Session assignments (disjoint file sets)
1. **scoring** — `components/LiveScoreEntry.*`, `components/GameSchedule.*`, `components/Standings.*` (the admin standings shown inside Game Management). v2 ref: Admin.dc.html "Live Score Entry" + "Game Management" sections.
2. **schedmgr** — `components/ScheduleManager.*` (CSV import + generated round-robin schedule). v2 ref: Admin.dc.html "Schedule Import & Generate".
3. **users** — `components/PlayerManagement.*`, `components/UserManagement.*`, `components/UserModal.jsx`, `components/admin/UserRoleManagement.*`. NOTE: `PlayerManagement.css` and `UserManagement.css` are also imported by `UserModal` — that's why these are one session. v2 ref: Admin.dc.html "Users & Roles" (Manage Users / Generate Users / Roles tabs).
4. **setup** — `components/TeamManagement.*`, `components/TeamDetails.*`, `components/SeasonManagement.*`, `components/admin/StaffSchedule.css` (one file styling GoalieSchedule/RefereeSchedule/ScorekeeperSchedule + the availability panel), `components/admin/AnnouncementsManagement.*`, `components/LeagueRulesAdmin.*`. v2 ref: Admin.dc.html "Seasons", "Announcements", "Rules Editor", "Assignments".

**DraftDashboard is intentionally NOT restyled** (no design yet) — leave it as-is.
