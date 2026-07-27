# Handback: Unfinalize Game modal — full functional surface

## Purpose
A confirmation modal in the scorekeeper's Live Score Entry screen
(`frontend/src/components/LiveScoreEntry.jsx`, styles in `LiveScoreEntry.css`) that
lets an admin reopen a game that's already been finalized, so its score/events can
be corrected. It's the inverse of the **Finalize Game** modal (already redesigned —
see `sk-finalize-*` classes in the same file for the closest visual sibling).

**Context on current state:** this modal still uses the same old, pre-redesign
markup the Finalize modal used to have before its redesign: `.modal-overlay` /
`.modal-content` / `.btn-confirm` / `.btn-cancel-modal` / `.warning-list` /
`.confirm-question`. These are generic classnames also defined — with completely
different, conflicting styles — in `GameEditModal.css`, `TeamManagement.css`,
`UserManagement.css`, `DraftDashboard.css`, and `user/ShiftSignup.css`. Since this
codebase has no CSS scoping, whichever stylesheet happens to load last in the bundle
wins the cascade, so this modal's actual rendered appearance today is unpredictable
— it may or may not pick up the OBI-themed rules `LiveScoreEntry.css` itself defines
for these classnames, depending on load order. **Treat this as a from-scratch design
brief** — don't assume today's rendering (whatever it happens to look like right
now) reflects intent.

**Implementation note (not a design concern, just flagging for whoever builds the
mockup):** the eventual React implementation must give this modal its own uniquely-
scoped classnames (e.g. an `sk-unfinalize-modal-*` prefix, matching the pattern
already used by the Goal/Penalty/Finalize/Edit-Event modals in this same file)
rather than reusing `.modal-overlay` / `.modal-content` / `.btn-confirm` /
`.btn-cancel-modal`, or it will just collide with a *different* legacy modal
instead of fixing the problem.

Opened from: the **Reopen Game** button in the finalized-game banner (already
redesigned, `sk-final-banner`/`sk-reopen-btn`), visible only to **admins** — a
regular scorekeeper who isn't also an admin never sees this button, only the
"Final — score submitted" banner text without the reopen action.

## Shell
- Standard modal overlay (dark scrim) + centered card — same treatment as this
  file's other modals (`sk-modal-overlay`/`sk-modal`).
- Header: **"⚠️ Unfinalize Game"**.
- Footer action row: primary **"Yes, Unfinalize Game"** button + **Cancel**.
- **Known gap in the current implementation, worth deciding on:** unlike this
  file's other modals, clicking the dark scrim background does **not** close this
  one today — only the Cancel button (or the confirm button) do. Decide whether
  the redesign should add click-outside-to-dismiss for consistency with its
  siblings, or intentionally leave it out (e.g. because unfinalizing is a
  higher-consequence action than most of this screen's other modals, and forcing
  an explicit button tap avoids an accidental dismiss/misclick reading as "I meant
  to cancel").

## Content — single section, no conditional branching
Much simpler than the Finalize modal: no forfeit/score/OT sections, just a
confirmation question and a static consequence list.
1. **Confirmation question** (static text): *"Are you sure you want to unfinalize
   this game?"*
2. **"This will:" consequence list** (static bullets, always the same, no
   conditional variants):
   - *"Revert all points awarded to the teams in the standings"*
   - *"Revert player games played statistics"*
   - *"Unlock the game for score editing"*
3. **Reminder line** (styled with emphasis — currently bold): *"You MUST re-finalize
   the game after making edits to ensure stats are accurate."*

## Behavior notes worth designing around
- **A loading/pending state already exists and should be preserved**: the confirm
  button shows "Unfinalizing..." and both buttons disable while the
  `unfinalizeGame` API call is in flight — unlike the Finalize modal (which needed
  this added), this one already has it. Just needs to look right in the new theme
  (e.g. a spinner treatment matching the Finalize modal's, for consistency).
- On success, a plain `alert()` currently fires: *"Game has been unfinalized. You
  may now edit the score."* On failure, also a plain `alert()`. An in-modal
  success/error state would be a nice (optional) upgrade, but not required to match
  current functionality — same caveat as the Finalize handback.
- This modal only ever appears for a game that's currently finalized, triggered by
  an admin. There's no equivalent for a non-admin scorekeeper to self-service
  unfinalize — that's existing/intentional access control, not something the
  design needs to account for with a different state.

## Design system to build within
Same as every other post-redesign screen: `frontend/src/styles/theme.css` tokens
(`--obi-bg-deep-card` for the modal card, `--obi-card-border`, `--obi-warning`
for the primary "Yes, Unfinalize Game" button — it's a *warning*-toned action, not
a success/accent one, since it undoes something rather than completing it —
`--obi-success`, `--obi-error`, `--obi-font-display`/`--obi-font-body`). The
already-redesigned Finalize modal (`sk-finalize-*`) and Goal/Penalty/Edit-Event
modals (`sk-modal-overlay`, `sk-modal`, `sk-modal-title`, etc.) in this same file
are the closest visual siblings — reuse that shell language so this modal doesn't
feel like a different app from the rest of the score-entry flow it lives in.

## Not included (flagged, out of scope)
Two other modals in this same file still use the same legacy
`.modal-overlay`/`.modal-content` classnames and have the identical collision risk
described above: the **Penalty Alert** modal (ejection/suspension warning) and the
**Unsaved Changes** modal (navigate-away guard). Both are likely quick follow-ups
in the same vein but are **not** part of this handback's scope.

## Deliverable format
Same as prior handoffs — a `.dc.html` prototype covering: default state and the
confirm-button pending/loading state ("Unfinalizing..."), dropped into a new
`Website theme integration` folder in Downloads, with a short README.
