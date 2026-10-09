# Handback: Finalize Game modal — full functional surface

## Purpose
A confirmation modal in the scorekeeper's Live Score Entry screen
(`frontend/src/components/LiveScoreEntry.jsx`, styles in `LiveScoreEntry.css`) that
locks in a game's final result. It's the last step before a game's score becomes
permanent and counts toward standings/stats. This doc gives Claude Design the
complete field list, conditional logic, and business rules so the mockup covers the
real surface — this is the one remaining unstyled modal in an otherwise fully
redesigned score-entry page.

**Context on current state:** everything else on this page (the score board, the
Goal modal, the Penalty modal, the finalized banner) has already been through the
dark "OBI" redesign and uses `sk-`-prefixed classes. This one modal was missed and
still uses old, pre-redesign markup — worse, it actively collides with unrelated
legacy modals: `.modal-overlay` / `.modal-content` / `.btn-confirm` /
`.btn-cancel-modal` are generic classnames also defined (with completely different,
conflicting styles — e.g. a plain white card) in `GameEditModal.css`,
`TeamManagement.css`, `UserManagement.css`, `DraftDashboard.css`, and
`user/ShiftSignup.css`. Since this codebase has no CSS scoping, whichever
stylesheet happens to load last wins — which is why the modal currently renders as
a plain white card with browser-default-ish radios instead of the dark theme, even
though *some* of its rules (the OT section) already reference OBI CSS variables.
The forfeit section, by contrast, has its own hardcoded light/cream palette
(`#fffbeb` background, `#92400e` text) that was never touched at all. **Treat this
as a from-scratch design brief** — none of the current visual treatment should be
treated as intentional or preserved.

**Implementation note (not a design concern, just flagging for whoever builds the
mockup):** the eventual React implementation must give this modal its own uniquely-
scoped classnames (e.g. an `sk-finalize-modal-*` prefix, matching the pattern
already used by the Goal/Penalty modals in this same file) rather than reusing
`.modal-overlay` / `.modal-content` / `.btn-confirm` / `.btn-cancel-modal`, or it
will just collide with a *different* legacy modal instead of fixing the problem.

Opened from: the **Finalize Game** button in the "Scoring & Penalties" panel footer,
on `/scorekeeper/game/:gameId` (scorekeeper's own view) or the admin's **Live Score
Entry** tab (same component, admin can finalize any game too). The button only
appears while the game is not yet finalized.

## Shell
- Standard modal overlay (dark scrim) + centered card.
- Header: **"⚠️ Finalize Game"**.
- Footer action row: primary **"Yes, Finalize Game"** button + **Cancel**.
- Clicking the overlay background, or Cancel, closes the modal without saving
  (selections made inside are *not* discarded — see note below).

## Section 1 — Forfeit selection
Always visible. A 3-way radio choice:
1. **No forfeit** (default/pre-selected every time the modal opens for a fresh game)
2. **{Home Team Name} forfeits**
3. **{Away Team Name} forfeits**

Team names are dynamic (pulled from the actual matchup). This selection drives two
other sections below.

## Section 2 — Final Score (read-only display, not an input)
A boxed score readout. Two different presentations depending on Section 1:
- **No forfeit selected:** shows the actual score entered during the game —
  `{Home Team} {homeScore} - {awayScore} {Away Team}`.
- **A team forfeits:** the score is overridden to a fixed **1–0** in favor of the
  non-forfeiting team, regardless of whatever was actually on the board, with a
  small **"(forfeit)"** tag next to it. (E.g. if Away forfeits, it always shows
  Home 1 – 0 Away, never the live in-progress score.)

## Section 3 — Overtime (conditional — hidden entirely if a forfeit is selected)
Only rendered when **no forfeit** is selected. Two possible states:
- **Auto-detected:** if any goal already logged this game has period = "OT", this
  section shows a **static confirmation line** — *"✓ OT goal detected - Game ended
  in overtime"* — with no radio choice at all (it's already decided by the data).
- **Manual choice:** if there's no OT goal on record, shows a 2-way radio —
  **"Ended in Regulation"** (default when the score is tied) / **"Ended in
  Overtime"**. Note this is a real edge case a scorekeeper does need: a game can
  end in an OT tie-breaker without an OT *goal* being individually logged (e.g. a
  shootout-style resolution), so this manual toggle matters.

## Section 4 — "This will:" consequence list
A static bullet list, always shown, that changes based on the forfeit selection:
- Always: *"Lock the game and prevent any further edits"*
- Always: *"Save the final score to the database"*
- Always: *"Mark the game as completed"*
- **Only if a forfeit is selected**, one more bullet: *"Award the win and 2 points
  to {the non-forfeiting team}"* — and if any goals/penalties were already logged
  before the forfeit was chosen, an additional clause is appended to that same
  bullet: *"(any goals/penalties already logged will not count toward player
  stats)"*.

## Section 5 — Confirmation line
Static text: **"Are you sure you want to finalize this game?"**

## Behavior notes worth designing around
- **Forfeit and OT selections persist across opens/closes within the same
  session** — if a scorekeeper opens the modal, picks a forfeit team, then hits
  Cancel, reopening the modal keeps that forfeit selection rather than resetting to
  "No forfeit." Design should support this (i.e. don't assume the modal always
  mounts in a pristine default state).
- Once **finalized, this modal never appears again for that game** — the trigger
  button itself disappears and is replaced by a "✓ Finalized" state elsewhere on
  the page (already redesigned, out of scope here). There's a separate, similarly
  unstyled **"Unfinalize Game"** confirmation modal admins can trigger to undo a
  finalize — same legacy-CSS problem, structurally simpler (just a warning list +
  confirm/cancel, no forfeit/score/OT sections) — flagging as a likely quick
  follow-up but **not** part of this handback's scope.
- No loading/pending state exists today on the "Yes, Finalize Game" button itself
  (the save is a single async call) — worth adding a disabled/spinner state in the
  new design since a slow network could let someone double-click.
- If the save fails, today it's a plain `alert()` — an in-modal error state would
  be a nice (optional) upgrade, but not required to match current functionality.

## Design system to build within
Same as every other post-redesign screen: `frontend/src/styles/theme.css` tokens
(`--obi-bg-deep-card` for the modal card, `--obi-card-border`, `--obi-accent`,
`--obi-warning`, `--obi-success`, `--obi-error`, `--obi-font-display`/
`--obi-font-body`). The already-redesigned Goal/Penalty modals in this same file
(`sk-modal-overlay`, `sk-modal`, `sk-modal-title`, etc.) are the closest visual
sibling — reuse that shell language where it makes sense so this modal doesn't feel
like a different app from the rest of the score-entry flow it lives in.

## Deliverable format
Same as prior handoffs — a `.dc.html` prototype covering: default (no forfeit, no
OT goal logged, tied score), OT-goal-auto-detected state, a forfeit selected
(showing the overridden 1–0 score + the extra consequence bullet, with and without
prior logged events), and the confirm-button pending/loading state — dropped into a
new `Website theme integration` folder in Downloads, with a short README.
