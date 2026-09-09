# GM team rename — affordance + section tip

**From:** Claude Design → **To:** the author of `GM_TEAM_RENAME_HANDOFF.md`
**Scope:** `GMTeam.jsx` section header (both routes) + a new reusable section-tip component.
**Date:** 9 Sep 2026

`GMTeamRename.dc.html` is the working reference — type in it, save, hit the duplicate, open the
tips. Built in an internal prototyping tool (custom template syntax, `class Component extends
DCLogic`); don't port it line-for-line. Rebuild in React with prefixed classnames and `--obi-*`
tokens. No new tokens, no new colours.

---

## Piece 1 — the affordance

**Recommendation: A, the captioned field.** Restructure the heading into three parts:

```
Team Management  ⓘ            ← h2, fixed section title, no variable value in it
YOUR TEAM NAME                ← caption, 11px condensed, letter-spacing 1.8px, --obi-icy dim
[ Team 6   ✎ Rename ]         ← the field: name at ~32px display italic + accent Rename chip
```

Why this and not the smaller change: the resting state has to work with **no hover, no `title`,
no prior knowledge**. A carries three independent signals — a caption that names the value, field
chrome around it, and a verb on a control — and any one of them read alone answers the question.
It also lets the edit state reuse the same box, so nothing jumps on click. Options B (dashed
underline + pencil) and C (separate Rename button) are drawn in section 02 of the reference with
the case for each; B is the fallback if the header must stay one line.

The label/value split is gone, as the handoff allows: the h2 is now the constant
"Team Management" and the team name only ever appears as a value inside the field.

### Behaviour

| Trigger | Result |
|---|---|
| Click / tap anywhere in the field | Edit state, focus in input, existing text selected |
| Tab to field, Enter or Space | Same |
| Enter in the input | Save (swallowed while a PUT is in flight) |
| Esc | Cancel, restore previous name |
| Blur | Cancel, not save — a rename is deliberate |
| Duplicate name | Field border red, the 400's readable reason on the hint line, input keeps focus |

Max 32 characters, enforced on the input. Minimum 2. Empty is rejected client-side.

### States

All eight are in section 04 of the reference: rest, hover, keyboard focus, saving, duplicate-name
400, long name at 360px, saved, and non-GM (plain text, no field, no control).

---

## Piece 2 — the section tip

One component, copy is the only prop. Anatomy is fixed:

- 26px circular ⓘ beside the section `h2`, `--obi-icy` at rest, accent fill when open, ≥44px hit area
- Popover: accent-bordered card, 320px, arrow to the ⓘ, `0 20px 44px rgba(0,0,0,.55)`
- "WHAT YOU CAN DO HERE" eyebrow in accent, ✕ at top right
- Up to **five** `›` lines, ≤14 words each
- One optional grey footnote for the "why is this greyed out" case

Popover, not modal: Esc closes, outside click closes, route change closes, only one open at a
time. No focus trap, no scroll lock. Under 480px render it full-width under the heading instead
of anchored.

Copy for all five sections is written and live in section 03 of the reference — My Week, Signups,
Team Management, Goalie Stats, Chicken Licks. **Team Management's list was read off the current
component**, not the handoff, and names the *mechanic* where it isn't obvious: rename team, click
into a jersey box and type (1–99), set skill ratings with the − / + buttons (1–10), fix a
teammate's email, copy roster emails — plus the footnote that G/A/PIM are read-only. Goalie Stats gets the footnote
that ratings belong to the Goalie Coordinator — that is where its "why can't I edit this" comes
from.

Store each section's copy next to that section's route, not in the tip component.

---

## Porting rules that are load-bearing

- **Not a `<button>`.** `index.css`'s second bare `button` rule forces `height:36px`,
  `inline-flex`, `0.875rem`, white text, and `border-radius:4px !important`. Build the field and
  the ⓘ as `<div role="button" tabindex="0">` with Enter/Space handlers — nothing inherits, and
  the `!important` radius never has to be fought. Save/Cancel inside the edit state are real
  buttons and *do* override all five properties explicitly.
- **Prefix everything:** `obi-gmname-*`, `obi-sectiontip-*`. No bare `.field`, `.tip`, `.info`.
- **The caption is not decoration.** Dropping "YOUR TEAM NAME" to save vertical space takes the
  affordance back to two signals and half-undoes the fix.
- **44px minimum** on the Rename chip, Save, Cancel and the ⓘ hit area.
- **`aria-live="polite"`** on the hint/status line so "Saved" and the 400 reason are announced.
  The old `title` tooltip announced nothing.
- **One component, both routes.** The affordance lives in `GMTeam`, so `/dashboard` and
  `/gm/team` both get it; `Dashboard.jsx`'s `<section id="team">` changes only by losing the old
  `"Manage " + name` h2.

## Decisions to push back on now if you're going to

1. **The h2 no longer contains the team name.** "Manage Team 6" was the section's personality.
   Traded for an unambiguous label/value seam — say so if that reads as a loss.
2. **Blur cancels rather than saves.** Safer, but it will surprise anyone used to the roster
   inputs, which save on blur. Consistency argument exists; deliberateness won.
3. **The tip ships on all five sections at once**, including read-only ones. Half a rollout
   teaches GMs the ⓘ is unreliable.
4. **The name is no longer a link to `/teams/40`.** It was, in the dashboard build. Option C
   preserves that if the link matters more than the affordance.

## Open questions

1. Is the 32-character cap right? The DB column and the standings-table layout both have opinions
   I can't see from here.
2. Does a rename need to notify the roster, or is silent fine? Seven GMs renaming at once after
   this ships is a lot of quiet changes to a public page.
3. Should the tip remember it's been seen (one-time accent pulse on first visit, plain after)? It
   is the nearest thing to an FTUE that survives the out-of-scope ruling — worth a yes/no.
