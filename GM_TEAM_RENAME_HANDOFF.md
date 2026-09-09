# Handoff request — GMs cannot find the team-rename control

**Ask:** Two related pieces of design on the GM "Team Management" section: (1) give the
editable team name a real affordance so it reads as editable, and (2) add an info bubble
that says, briefly, what a GM can do on this section. Both are discoverability fixes for a
control that already works — no change to the save behaviour is being requested.

## Why — this is measured, not a hunch

GM Phil Pedracine reported on 2026-09-09 that he "can't edit his team name." The save path
is fine end to end: the click-to-edit works, the API returns 200, the rename persists.

The prod nginx access log contains **zero `PUT /api/v1/teams/40`** — ever. His browser has
never once attempted the save. He was on `/dashboard`, and in the same session he reloaded
the public `/teams/40` page five times in ninety seconds, watching for a name change that
he had never actually triggered.

He is not alone. Of ten season-15 GMs, **only two have ever renamed their own team.** The
other seven names were set by the admin by hand from `/admin?tab=teams`.

Phil was on **desktop Chrome**, so the `:hover` colour change was available to him and he
still missed it. This is not a mobile-only problem, though mobile is strictly worse — see
the constraint below.

## What exists today (to be replaced, not a target)

`frontend/src/components/gm/GMTeam.jsx`, the section heading:

```jsx
<h2 className="gm-team-title">
    Manage{' '}
    <button type="button" className="gm-team-name" title="Click to rename your team"
            onClick={...}>
        {teamInfo?.name || 'My Team'}
    </button>
</h2>
```

`frontend/src/components/gm/GMTeam.css`:

```css
.gm-team-name { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }
.gm-team-name:hover { color: var(--obi-accent); }
```

The name is a `<button>` painted to be indistinguishable from the word "Manage" beside it.
Its only two affordances are a hover colour change and a `title` tooltip. It renders as
"Manage Team 6" — one continuous heading, with no seam where the label ends and the
editable value begins.

Clicking it swaps in `.gm-team-name-input`, which *is* clearly styled as a field. The edit
state is fine; only the resting state needs designing.

## Where it appears — one component, two routes

`GMTeam` is rendered in both places, so design it once:

- **`/dashboard`** → `frontend/src/components/user/Dashboard.jsx`, `<section id="team">`
  inside `.dash-team-editor`, reached by the "Team Management" sub-nav link. **This is the
  one GMs actually use** — both successful renames in the log came from here.
- **`/gm/team`** → the GM portal (`App.jsx`), standalone page.

## Piece 1 — the affordance

Make the team name read as an editable value at rest. It needs to survive the constraints
below and work with no hover available. Direction is Design's call; the requirement is that
a GM who has never been told about the feature can tell the name is editable.

## Piece 2 — the info bubble

A small `ⓘ` affordance in the section header opening a short "what you can do here" summary.
For Team Management the content is roughly: rename your team, set jersey numbers, set skill
ratings, copy your roster's emails. (Read the component for the current, exact capability
list before writing final copy — it has changed more than once.)

Worth designing as a **reusable component**, not a one-off: `/dashboard` has four other
sections with the same "what am I looking at" problem, and the same bubble would serve them
— My Week, Signups, Goalie Stats, Chicken Licks (`Dashboard.jsx`, `.dash-subnav-link` list).
Design it so it can carry different copy per section.

## Constraints Design needs to know

- **A global `button` baseline bleeds into everything.** `frontend/src/index.css` has *two*
  competing bare `button { }` rules, and the second sets `height: 36px`,
  `display: inline-flex`, `font-size: 0.875rem`, `color: white` and
  `border-radius: 4px !important`. Any button-shaped affordance inherits these unless
  overridden, and the `!important` on the radius cannot be beaten by a plain class. This is
  a known debt, documented in the comment block in `index.css` — do not assume a clean slate
  for a `<button>`.
- **There is no CSS scoping in this codebase.** Every class is global and collisions have
  bitten this project repeatedly. Any new classnames must be distinctive and prefixed.
- **No hover on mobile, and the `title` tooltip never appears there.** Most GMs are on
  phones. The affordance has to be visible at rest, without interaction.
- The heading currently concatenates a fixed label and a variable value ("Manage " + name).
  Design is free to restructure that — the label/value split is not load-bearing.

## Design tokens

No new tokens expected — `frontend/src/styles/theme.css` covers it (`--obi-accent`,
`--obi-icy`, `--obi-text`, `--obi-card-border`, `--obi-font-display` / `--obi-font-body`).
The existing edit-state input already uses the accent border and `--obi-font-display`.

## Explicitly out of scope

- **An FTUE / first-login wizard.** Considered and rejected for now: every current GM has
  long since had their first login, so a first-run flow would not reach any of the seven
  people who are stuck today, and a selector-anchored tour is a maintenance liability in a
  codebase with no CSS scoping. Revisit only if discoverability is still poor after this.
- **The save path itself.** Two real defects were found alongside this and are already
  fixed in the same branch: a duplicate team name returned a bare `404` (now a `400` with a
  readable reason, surfaced in the toast), and Enter double-submitted the rename. Design
  should assume the mechanics work.
- **Renaming from the admin Teams tab** (`/admin?tab=teams`) — a different surface, works
  fine, not part of this.
