# Handoff: League Draft Tool — full redesign

**Audience:** Claude Design. This is a **full redesign of one admin surface** — the League Draft
Tool at `/admin?tab=draft`. It is the last major admin screen still on the pre-redesign styling: dark
grey `#2a2a2a` cards, hardcoded hex everywhere, none of the `--obi-*` tokens.

**Scope fence, please read this first.** There are **two** draft tools in this app and they are
unrelated. This handoff is about the **League Draft Tool** only (`DraftDashboard.jsx`,
`?tab=draft`). The **Tournament Draft** (`?tab=tournament-draft`, `admin/tournament/TournamentDraft.jsx`)
is already on the design system, is not being touched, and is referenced below only as precedent to
rhyme with. Do not propose merging them.

**Who uses it.** One admin, once or twice a year, on draft night, on a laptop, in a room, with GMs
watching over their shoulder. That is the entire user base and the entire usage pattern. It runs for
about three hours and the result gets defended out loud to fourteen people. Optimize for *legible
under pressure*, not for discoverability or delight.

The six design problems, and they're mostly independent:

| # | Piece | Kind |
|---|---|---|
| 1 | Density model — replaces 3 view modes + a zoom slider | In-app |
| 2 | The control bar as a phase-aware surface (incl. save indicator) | In-app |
| 3 | Post-import as one flow | In-app |
| 4 | Balance at a glance | In-app |
| 5 | Selection mode coexisting with drag-and-drop | In-app |
| 6 | Global player search — "find them wherever they are" | In-app |

**4 and 6 are the ones that change the operator's day.** 1 and 2 are the ones that make the screen
stop looking like a prototype. If anything gets cut, 3 is the most droppable.

---

## Context: what exists today

`frontend/src/components/DraftDashboard.jsx` is a **2657-line single component** with 30 `useState`
calls and seven bespoke modals. `DraftDashboard.css` is 1077 lines and fully global. All of that is
being rebuilt on our side regardless — you are not constrained by the current structure. But **no
feature may be lost**, so here is the complete inventory.

### The layout, three zones
1. **Control bar** across the top — horizontal, `flex-wrap: nowrap; overflow-x: auto`, so it
   *scrolls sideways* when crowded, which it always is.
2. **Player pool** — a collapsible left rail. Search box, filter select, sort select + a ↑/↓
   direction toggle, then a vertical list of player cards. The whole rail is a drop target.
3. **Team board** — a horizontally-scrolling row of team columns. Each column: a colored header
   (click-to-edit name, a 12-color select, a per-team sort select), a stats block, then the roster.
   Each column is a drop target. The board sits inside a `transform: scale()` wrapper driven by the
   zoom control.

### Two phases
The tool has a **pre-live** and a **live** phase, flipped by a `Start Draft` button, and they show
different controls. Nothing is draggable until the draft is live.

| Phase | Controls present |
|---|---|
| **Setup** (pre-live) | Season picker · `+ New Season` · team count (1–14) · Upload File · Download Template · **Start Draft** · Reset Draft |
| **Live** | Assign GMs · Assign GM Buddies · Undo (n) · Export CSV · Save Draft · Finalize Draft · New Draft · Reset Draft |
| **Always** | View mode toggle (3-way) · Zoom (± and reset, 0.5–1.5) · a "✓ Ready to start draft!" indicator |

`Reset Draft`, `New Draft` and `Finalize Draft` are **destructive or irreversible** and currently sit
in the same undifferentiated row as everything else.

### The three current view modes
- **Detailed** — full name, clickable GM/REF badges that toggle the flag, and four inline editors:
  Position select, Skill 1–10 select, Status select, Buddies text input. **This is the only mode
  where a player can be edited.**
- **Balanced** — `J. Smith`, `F:7`, V/GM/REF badges, a 🤝 when the player has buddy picks.
- **Overview** — initials, F/D, rating, mini badges, everything else in a `title` tooltip.

### The seven modals
| Modal | Trigger | Job |
|---|---|---|
| Potential Matches | after import, if any | "This name matches an existing player with a different email — adopt their old rating?" per row |
| Unrated Veterans | after the above | Fill in a 1–10 rating for each veteran we couldn't find a rating for |
| Buddy Picks | on drop, **and** as a carousel from Assign GM Buddies | Pick which of this player's buddies come along |
| Duplicate Resolution | on Finalize, if unresolved matches remain | Update the existing profile vs. create a new one |
| Create New Season | `+ New Season` | name / start / end / status / isActive |
| Resume Draft | on mount, if a saved draft exists | "Resume *Season 14*, saved 2 hours ago?" |
| Confirmations | New Draft, Finalize, and leaving with unsaved changes | Yes/no |

### Everything else that must survive
Assign GMs (shuffles, drops one GM on each GM-less team, then re-sorts the whole board by ascending
average skill — **the columns visibly reshuffle**, and that is intentional) · Assign GM Buddies (walks
the buddy graph and steps through a queue of GMs) · buddy prompt on drop, showing an "↔️ Reciprocal"
badge when the pick is mutual · pool filter (All / Forwards / Defense / Refs / GMs / Has Buddy) ·
pool sort (Name / Position / Skill / Veteran) + direction · per-team sort select · per-team stats
(Players, Skill total, F/D counts, Avg, Avg F, Avg D) · Undo, 20 deep, with the depth on the button ·
Export CSV · Download Template · Save · Resume · Finalize (validates every team has a GM first) · a
dismissible warning banner · an unsaved-changes guard when navigating away.

---

## Decisions already made — please don't redesign these

These are engineering calls, settled. Several of them dissolve problems you'd otherwise have to
solve, so they're worth reading before you start.

- **One buddy algorithm.** There are currently three inconsistent ones. It becomes transitive closure
  everywhere. What's left for you is **one** buddy modal with an *optional* queue/progress state for
  the GM-by-GM carousel — one component, two states.
- **One modal shell.** Escape to close, focus trap, focus restore, scroll lock, overlay click to
  dismiss for non-destructive modals only. **Style one shell, not seven.**
- **Three message severities** replace today's single yellow banner that serves errors, info and
  success alike: error (sticky, dismissible), success (auto-dismisses), info. Map to `--obi-error`,
  `--obi-success`, `--obi-warning`. The taxonomy is fixed; the treatment is yours.
- **Auto-save is being added.** 1200ms debounce, 5s max wait. States: `idle → dirty → saving → saved
  → error`. Error is sticky and offers Retry. Copy: *"Saving…"*, *"All changes saved"*,
  *"Saved 2 min ago"*, *"Couldn't save — Retry"*. You decide visual weight and placement (see
  problem 2).
- **Start Draft now requires a season to be selected**, because auto-save needs a row to write to.
  Today you can start without one and only get blocked later at Save. This is a UX improvement but it
  means the Setup phase has a hard prerequisite worth expressing.
- **Click-to-assign key map:** click a card to select, click again or Escape to deselect, arrow keys
  move within a list, Enter assigns.
- **Search matching:** case-insensitive substring on first name, last name, **full "first last"**,
  and email. 150ms debounce. Enter jumps to the next match, Escape clears.
- **Classname prefix `obi-draft-`.** Dark theme, `--obi-*` tokens only.

---

## 1. Density model — replacing three view modes *and* a zoom slider

**The problem.** Fourteen team columns and up to ~200 players have to be workable on a 1080p laptop.
The current answer is *two* independent density controls that don't know about each other: a 3-way
view-mode toggle and a 0.5×–1.5× zoom slider. So there are effectively fifteen states, most of them
useless, and the operator fiddles instead of drafting. The zoom is a raw CSS `transform: scale()`,
so at 0.6× the text is genuinely unreadable and at 1.4× only four teams fit.

**What to design.** One coherent density model. The hard constraint that makes this interesting:
**Detailed is the only mode with inline editing** (position, skill, status, buddies, GM/REF toggles).
So collapsing modes means answering *where does editing live* — a per-card expand, a detail panel, a
modal, or a mode that survives. That's the real question, not the number of steps.

Kill the free-floating zoom slider, or replace it with something with detents that reads as part of
the density model rather than a second, competing one. If you conclude two modes are genuinely
needed, keep two — but argue it.

**Show us:** the board at 14 teams in each density you propose, and a full roster column, so we can
see where the text gives out.

## 2. The control bar as a phase-aware surface

**The problem.** Roughly ten buttons across two conditional sets in a bar that is
`flex-wrap: nowrap; overflow-x: auto` — so when it overflows, controls silently scroll off the right
edge. Three of those buttons are destructive or irreversible (`Reset Draft`, `New Draft`,
`Finalize Draft`) and look exactly like `Export CSV`. The full inventory and its phase split is in
the Context table above.

**What to design.** A control surface that expresses the Setup → Live progression, separates
destructive actions from routine ones, and doesn't overflow at 14 teams. Some of this is grouping,
some is probably demotion — not every control deserves to be a top-level button, and `Finalize
Draft` in particular is a once-per-season action currently sitting next to Undo.

**Fold the auto-save indicator in here.** It's not a separate question — where the save state lives
is a consequence of the bar's shape. The five states and their copy are listed under *Decisions*
above. And decide whether `Save Draft` survives as a button at all once saving is automatic; there's
a real argument that a manual save button next to an auto-save indicator is just anxiety-inducing
noise, and a real argument that draft night is exactly when someone wants an explicit commit.

## 3. Post-import as one flow

**The problem.** Importing the registration file kicks off a chain: upload → **Potential Matches**
modal → **Unrated Veterans** modal → the board is populated. It reads as three unrelated interruptions
rather than one job. Worse: **cancelling either modal silently wipes the entire imported pool**, with
no warning, and the operator has to re-upload.

**What to design.** One stepped experience with a visible position ("Step 2 of 2"), a per-step
summary of what was just decided, and a back path. Both steps are lists of rows with a per-row
decision, so the shape is similar — but the questions are different (*adopt this old rating?* vs.
*type a rating*) and either list can be one row or forty.

Answer specifically: **what should "cancel" mean at step 2 when step 1 has already been answered?**
Losing everything is clearly wrong; silently keeping half-resolved data may also be wrong.

## 4. Balance at a glance

**The problem.** Each team column shows six bare numbers — Players, Skill total, F, D, Avg, Avg F,
Avg D — in a small grey block. To find the over-stacked team the operator reads 14 columns of digits
and compares in their head, repeatedly, all night. This is the single biggest quality-of-life gap in
the tool.

**What to design.** A treatment that makes an out-of-balance team **obvious across 14 columns without
reading digits**, plus a board-level read of whether the draft as a whole is balanced. Balance has at
least three independent axes — roster size, skill average, and forward/defense split — and a team can
be fine on two and badly off on the third, so a single composite score would hide the thing the
operator needs.

**Constraint: the numbers must stay legible.** The operator defends the result out loud to GMs, and
"the bar looked about even" is not an argument. Whatever the visual layer is, the digits stay
readable underneath it.

Note the board already re-sorts columns by ascending average skill after every pick — so relative
skill position is *somewhat* encoded in the layout already. Consider whether that's worth surfacing
or whether it just makes the board feel unstable.

## 5. Selection mode coexisting with drag-and-drop

**The problem.** Drag-and-drop is the only way to move a player today. That's fine on a good night
and miserable when a drag misfires into the wrong column with GMs watching, and it's impossible with
a keyboard. We're adding a select-then-assign path. Drag stays primary.

**What to design.**
- A **selected** state on a player card that is unmistakable and doesn't fight the other card states.
- An **"Assign here"** affordance on every team column that appears meaningful when something is
  selected and isn't permanent visual noise when nothing is. Fourteen dormant buttons is noise.
- The two modes must not read as two different products.

`TournamentDraft.jsx:227,268-271` is the working precedent — `obi-tdraft-entrant.is-selected`, and a
team button that reads *"Assign here"* / *"Select a player"*. **Rhyme with it, don't copy it:** that
board has no pool filters, no team stats block, and no drag-and-drop to coexist with.

## 6. Global player search — "find them wherever they are"

**The problem, and it's new.** The pool search filters the pool. Once a player has been dragged onto
a team they become **unfindable** — the operator scans fourteen columns by eye. This happens
constantly: "wait, did we already take Simmons?"

**What to design.** A board-level search spanning the pool *and* every team roster. When the match is
on a team, the board scrolls to it on **both axes** — horizontally to bring the team column into
view, vertically within that column's roster — and the card is marked as the match.

Five things to resolve:

- **One search box or two?** The pool search is a **filter** (narrows a list, many results persist).
  This is **find-and-reveal** (jumps to one thing). Different verbs. Cramming both into one box is a
  trap; two search boxes on one screen is also bad. Your call, but argue it.
- **The match indicator.** The owner's instinct is a yellow border. That has three collisions to
  survive: the **selected** state from problem 5, the **12 user-chosen team header colors** (a match
  on the white team, on the black team — see the palette below), and **`--obi-accent` is already
  amber** (`#F6A91C`), close enough to the Orange team color to matter. Solve match / selected /
  team-color as one set, not three separate decisions.
- **Multiple matches.** "Smith" hits four people on three teams. Needs a result count and
  next/previous navigation, because the board can only jump to one at a time.
- **Off-screen matches.** A team column holding a match the operator can't see should say so — both
  so they understand why the board jumped, and so they know there's more.
- **The resting state.** What Escape/clear does to the highlight *and* to the scroll position. Don't
  leave them staring at column 12 with no idea how they got there.

---

## Design system to build within

Everything needed is in `frontend/src/styles/theme.css`: `--obi-bg` (`#0b0c0f`), `--obi-bg-card`
(`#13171d`), `--obi-bg-deep-card`, `--obi-accent` (`#F6A91C`), `--obi-icy` (`#9DB9CD`), `--obi-text` /
`--obi-text-secondary` / `--obi-text-muted`, `--obi-success` (`#7FB59A`) / `--obi-error` (`#E08A8A`) /
`--obi-warning` (`#E8C26A`), `--obi-card-border`, `--obi-divider`, `--obi-font-display`
(Saira Condensed) / `--obi-font-body` (Saira).

Match the patterns already in `admin/tournament/TournamentDraft.css` (the closest cousin — pool list,
selectable rows, team roster columns) and `AdminAssignments.css` (chips, table cards, select styling).
Don't introduce a new visual language.

**One palette caveat.** Teams carry **12 user-chosen colors** applied to their column headers, and
they are raw saturated hex, not tokens (`DraftDashboard.jsx:122-135`):

| | | | |
|---|---|---|---|
| White `#f0f0f0` | Teal `#007a7a` | Blue `#0100fe` | Red `#fb0102` |
| Lt. Blue `#5e9ed6` | Tan `#b8956f` | Purple `#9a00ff` | Orange `#fd9a01` |
| Black `#000000` | Gray `#666666` | Maroon `#a64d79` | Green `#39751f` |

These name real jersey colors, so they **can't be re-mapped to a tasteful token set** — the operator
picks "Red" because that team wears red. The design has to survive a `#f0f0f0` white column next to a
`#000000` black one, and note that **Orange `#fd9a01` sits very close to `--obi-accent` `#F6A91C`** —
which matters directly for problem 6's match indicator. This is the constraint most likely to break a
proposal late, so please address it early. Proposing a more disciplined *rendering* of these colors
(a swatch or edge treatment rather than a full color-filled header) is in scope and probably welcome;
changing which colors exist is not.

---

## Out of scope

- Anything backend: import parsing, finalize validation, the API shape.
- The registration file format itself.
- `?tab=tournament-draft` — the Tournament Draft board, untouched.
- The **Create New Season** modal. It duplicates `SeasonManagement` and should eventually become a
  shared component; that's a deferred engineering job, not a design one. Leave it as-is and assume it
  inherits the shared modal shell.
- Mobile. This is a laptop-at-a-table tool. Tablet-tolerant is a bonus, not a requirement, and a
  design that compromises the 14-column desktop board to earn a phone layout is the wrong trade.

## Gotcha for whoever implements it (not for Design)

- `DraftDashboard.css:85` declares `.btn-draft, button { … border-radius: 4px !important; height:
  36px; color: white; display: inline-flex; }` — a **bare tag selector that restyles every button in
  the entire app** whenever the admin bundle loads. At least nine other stylesheets carry defensive
  overrides against it. It gets scoped to `.obi-draft-root button` in its own isolated commit
  **before** any of this markup lands.
- No CSS scoping exists in this codebase and we've had three real collisions. `DraftDashboard.css`
  currently owns generic names that are also declared elsewhere: `.modal-overlay`, `.modal-content`,
  `.btn-primary`, `.btn-secondary`, `.filter-btn`, `.team-header`, `.team-stats`, `.badge`,
  `.player-card`. Every new name takes the `obi-draft-` prefix and gets grepped against
  `frontend/src` before adoption.
- The board's scroll structure is `.teams-area` (`overflow-x`) → a `transform: scale()` wrapper →
  `.team-roster` (`overflow-y`). Two nested scrollers with a transform between them, which is why
  problem 6's scroll-to-match needs problem 1 settled first: `getBoundingClientRect()` returns
  transformed pixels while `scrollLeft` doesn't. If the zoom transform dies, the math gets simple.
- `player.email` is the identity key everywhere *and* the React `key`. Blank or duplicate emails
  break the board silently. Being fixed at the parser.

## Deliverable

Same as prior handoffs — `.dc.html` prototypes with a short README, dropped into a new
`Website theme integration` folder in Downloads.

Per piece: markup/JSX structure and styles using the tokens and the `obi-draft-` prefix, plus the
states each piece needs — empty, loading, error, disabled, and for the board specifically: **the
14-team case**. Most proposals for this screen look fine at 4 teams and fall apart at 14, so please
show 14 at least once.

Worth stating plainly: **this screen is used one night a year, and that night is high-stakes and
public.** Nothing here should reward familiarity or reveal itself on hover. If a control's purpose
isn't obvious to someone who last used the tool eleven months ago, it isn't finished.
