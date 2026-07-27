# Handback: Penalty Alert modal + Unsaved Changes modal — full functional surface

## Purpose
The last two legacy-styled modals in the scorekeeper's Live Score Entry screen
(`frontend/src/components/LiveScoreEntry.jsx`, styles in `LiveScoreEntry.css`).
Both are unrelated to each other in purpose — one is a rules-engine warning, the
other is a navigation-safety guard — but both still use the same old, pre-redesign
markup that the Finalize and Unfinalize modals used to have.

**Context on current state:** both use `.modal-overlay` / `.modal-content` /
`.btn-confirm` / `.btn-cancel-modal`. These are generic classnames also defined —
with completely different, conflicting styles — in `GameEditModal.css`,
`TeamManagement.css`, `UserManagement.css`, `DraftDashboard.css`, and
`user/ShiftSignup.css`. Since this codebase has no CSS scoping, whichever
stylesheet happens to load last in the bundle wins the cascade, so today's actual
rendered appearance is unpredictable. **Treat both as from-scratch design briefs**
— this is the last pair in this file still on the old shell (Goal, Penalty,
Finalize, Unfinalize, and Edit Event have all already been redesigned to
`sk-`-prefixed classes).

**Implementation note (not a design concern, just flagging for whoever builds the
mockup):** the eventual React implementation must give each of these its own
uniquely-scoped classnames (e.g. `sk-penalty-alert-*` and `sk-unsaved-modal-*`,
matching the pattern already used by every other modal in this file) rather than
reusing `.modal-overlay` / `.modal-content` / `.btn-confirm` / `.btn-cancel-modal`.

---

## Part 1 — Penalty Alert modal

### Purpose
A rules-engine warning that fires automatically when a scorekeeper logs a penalty
that triggers an ejection (and possibly a suspension), per the league's penalty
rules:
- **3 penalties in the current game** → ejection.
- **4+ penalties combined across this game and the player's previous game** →
  ejection *and* a suspension for the player's next game.

This is **not** a confirmation the scorekeeper is asked to approve or deny — the
penalty has already been recorded by the time this appears. It's purely
informational: "here's what just happened as a consequence of that penalty," with
a single acknowledgment button. Opened automatically from inside the Add Penalty
flow (`handleAddPenalty`), immediately after the penalty save succeeds, whenever
the backend's validation response says `shouldEject: true`.

### Shell
- Standard modal overlay (dark scrim) + centered card.
- Header: **"🚨 EJECTION + SUSPENSION"** or **"⚠️ EJECTION"** depending on which
  rule fired (see below).
- Footer: single **"Acknowledged"** button — no Cancel, no secondary action.
- Clicking the dark scrim background *does* close this one (unlike the Unfinalize
  modal) — same effect as clicking Acknowledged. Worth preserving: this appears to
  be a deliberate pattern in this file — modals that are purely informational
  (nothing to lose by dismissing) allow backdrop-click-to-close, while modals
  guarding a consequential decision (Unfinalize, Unsaved Changes below) don't.

### Content
1. **Title** — one of two variants, driven by which rule fired:
   - `🚨 EJECTION + SUSPENSION` (3+ penalty case escalated by prior-game history)
   - `⚠️ EJECTION` (the straightforward 3-penalties-this-game case)
2. **Player line**: *"Player: {player name}"* in a boxed/highlighted row.
3. **Warning message** — a full sentence from the backend, in an
   error-toned message box. **Content quirk worth knowing**: this message string
   already starts with its own emoji + "EJECTION:" / "EJECTION + SUSPENSION:"
   prefix baked in from the backend (e.g. *"⚠️ EJECTION: Player has received 3
   penalties in this game and must be ejected immediately."* or *"🚨 EJECTION +
   SUSPENSION: Player has 3 penalties in this game and 1 in the previous game
   (total: 4). Player must be ejected from this game AND is suspended for the next
   game."*) — so the header and the message body will visually repeat the same
   "EJECTION" wording. Not something to fix in this pass, just something the
   layout should tolerate gracefully (the message is a full paragraph, not a short
   tag).

### Design system to build within
`--obi-error` for the title color and the warning-message box (background/border
tint of error, text in error color) — this is the one modal on this screen that's
allowed to lean fully into the error palette rather than warning/accent, since it's
reporting a real disciplinary consequence, not a routine confirmation.

---

## Part 2 — Unsaved Changes modal

### Purpose
A navigation-safety guard: fires when a scorekeeper tries to leave the page (back
button, browser navigation, or a parent-controlled navigation in the admin's
embedded view) while there are unsaved score changes and the game isn't finalized.
Gives the scorekeeper a chance to save their progress before losing it. Opened from
three places, all funneling into the same modal: React Router's navigation blocker
firing, a parent component requesting navigation while dirty (admin's embedded
chip-picker view), and the in-page **← Signups · Dashboard** back link.

### Shell
- Standard modal overlay (dark scrim) + centered card.
- Header: **"⚠️ Unsaved Changes"**.
- Footer: **three** actions in a row (not the usual two) — **"💾 Save & Leave"**
  (primary), **"🗑️ Discard Changes"** (danger-styled), **"Cancel"** (neutral).
- Clicking the dark scrim background does **not** close this one — same
  intentional pattern as the Unfinalize modal (a consequential decision, not just
  information to dismiss).

### Content
1. **Explanation line**: *"You have unsaved changes to this game. Would you like
   to save your progress before leaving?"*
2. **Current score readout** (dynamic, boxed/highlighted): *"Current score:
   {Home Team} {homeScore} - {awayScore} {Away Team}"*.
3. **Reassurance note**: *"Saving will preserve the current score so you can
   return and continue scoring this game later."*

### Behavior notes worth designing around
- **A loading/pending state already exists** on **Save & Leave** only: it shows
  "Saving..." and disables while the score-save API call is in flight. **Worth
  flagging**: today, *only* the Save & Leave button disables during that save —
  Discard Changes and Cancel remain clickable the whole time, so a scorekeeper
  could in theory tap Discard or Cancel mid-save. Decide whether the redesign
  should disable all three buttons during the save (safer) or preserve today's
  behavior (simpler).
- **Three-button footer**: unlike every other modal on this screen (which are all
  two-button Confirm/Cancel layouts), this one needs to accommodate three actions
  of differing visual weight (primary save, destructive discard, neutral cancel)
  without feeling cluttered — worth explicit attention in the layout, not just a
  straight reuse of the two-button shell.

### Design system to build within
`--obi-success` or `--obi-accent` for Save & Leave (primary action), `--obi-error`
for Discard Changes (destructive, matches `.btn-danger`'s current error-toned
styling), neutral/ghost treatment for Cancel — same token set as every other modal
on this screen.

---

## Design system to build within (both modals)
Same as every other post-redesign screen: `frontend/src/styles/theme.css` tokens
(`--obi-bg-deep-card`, `--obi-card-border`, `--obi-warning`, `--obi-success`,
`--obi-error`, `--obi-font-display`/`--obi-font-body`). The already-redesigned
Finalize/Unfinalize/Goal/Penalty/Edit-Event modals in this same file
(`sk-modal-overlay`, `sk-modal`, `sk-modal-title`, etc.) are the closest visual
siblings — reuse that shell language so these two don't feel like a different app
from the rest of the score-entry flow they live in.

## Deliverable format
Same as prior handoffs — a `.dc.html` prototype covering: the Penalty Alert
modal's two title variants (EJECTION / EJECTION + SUSPENSION), and the Unsaved
Changes modal's default state plus its Save & Leave pending/loading state —
dropped into a new `Website theme integration` folder in Downloads, with a short
README.
