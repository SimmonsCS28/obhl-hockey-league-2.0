# Handoff: Coordinator Console — publish controls, draft flow, last-minute changes, and ref/scorekeeper emails

**Audience:** Claude Design. This describes **seven pieces of UI/email design** for the existing
Coordinator Console. The backend behavior for all of it is already specced in
`COORDINATOR_CONSOLE_GAPS_SPEC.md` — you do **not** need to design any workflow logic, algorithms,
or API shapes. What's missing is the interface.

Driven by real questions from the league's **referee coordinator** after using the console. Her
mental model is the thing to design for: *"I send version 1, then things always change. If I fix one
assignment, does everyone get emailed again?"*

The seven pieces, and they're independent — each can be designed and shipped on its own:

| # | Piece | Kind |
|---|---|---|
| 1 | Per-matchup publish + the crowded game-card header | In-app |
| 2 | Publish preview / confirm panel | In-app |
| 3 | Draft mode + draft bar (ref / scorekeeper) | In-app |
| 4 | Slot-row response detail (decline reason, staleness) | In-app |
| 5 | Removing a confirmed person | In-app |
| 6 | Referee + scorekeeper emails (final assignment, cancellation) | Email |
| 7 | Week-schedule block for refs and scorekeepers | Email |

Pieces 1, 2 and 5 are the ones the coordinator actually asked for; 3 is the biggest quality-of-life
win she didn't ask for. If any of it has to be cut, 4 is the most droppable.

---

## Context: what exists today

The console (`frontend/src/components/coordinator/CoordinatorBoard.jsx`, styles in `Coordinator.css`)
is one board reused for three roles — **Goalie**, **Referee**, **Scorekeeper** — switched by tabs.
Structure, top to bottom:

- **Week chips** — All Weeks / Week 1..N with date ranges.
- **Summary cards** — Open · Signups to Confirm · Awaiting Player · Set.
- **Goalie-only: auto-proposer bar** (`GoalieProposerBar`) — Generate → Send Confirmations → Publish,
  with a collapsible "Why these assignments?" panel.
- **Month → Week → Game cards.** Each week header has a `Publish Week N` button. Each game card has a
  header (date block · team pills · optional "⇄ Swap Goalies" · fill badge) and one **slot row** per
  staff slot.
- **Slot row** — single line: team/slot label · person · status chip · action buttons.

Statuses a slot can be in: `OPEN`, `SIGNED_UP`, `AUTO_PROPOSED` (filled, email not yet sent),
`PROPOSED` ("Awaiting Dave"), `CONFIRMED` ("Set · Confirmed"), `DECLINED`.

Existing class vocabulary worth matching: `cc-game-hd`, `cc-fill-badge`, `cc-swap-btn`,
`cc-publish-btn`, `cc-publish-result`, `cc-week-hd-actions`, `cc-slot-row`, `cc-status-chip`,
`cc-slot-actions`.

> ⚠️ **No CSS scoping exists in this codebase** — every class is global and we've had three real
> collisions. Any new classname must keep the `cc-` prefix (or a new component-specific prefix) and be
> grepped against `frontend/src` before use.

---

## 1. Per-matchup publish — and the crowded game-card header

**The problem.** Publishing is week-wide today. The coordinator wants to republish **one matchup**
after a late change, without it feeling like she's re-blasting the league.

**What to design.** A per-matchup publish control on the game card, showing how many people it will
notify (e.g. *"Publish Matchup · 1 to notify"*). It's disabled when the card has nothing new to
publish, and that disabled state needs to explain itself — "both slots are already live" is a
different thing from "nobody has confirmed yet."

**The real design problem is layout, not the button.** The game-card header already carries a date
block, two team pills, a conditional "⇄ Swap Goalies" button, and a fill badge. A third control makes
it cramped, and the swap button only appears for goalies, so the header's shape already changes
per role. Please solve the header as a whole rather than finding a gap to wedge a button into —
including how it behaves at the mobile breakpoint, where `cc-slot-actions` already restacks.

## 2. Publish preview / confirm panel

**The problem.** This is the anxiety at the center of the coordinator's questions, and it's a
**communication** problem rather than a behavioral one. Publishing is *already* incremental — it only
touches slots that are confirmed and not yet published, so re-publishing never re-emails anyone. The
UI just never says so, so she assumes the worst and hesitates to use it.

**What to design.** A confirm step that appears after clicking Publish (week or matchup) and before
anything sends, answering three questions at a glance:

- **Who will be emailed** — names and their games. This is the number she's afraid of.
- **Who won't** — a count of already-published assignments that will not be re-sent.
- **What's blocked** — slots still awaiting a response that won't publish at all.

Then confirm/cancel. `cc-publish-result` is the *after* state and shows a similar shape; treat it as
adjacent vocabulary, not a template to reuse — a "here's what's about to happen, approve it" panel has
different weight than a result summary. The three groups are not equal in importance: the first is the
decision, the other two are reassurance.

## 3. ~~Draft mode + draft bar (referee / scorekeeper)~~ — **CUT 2026-08-14, never built**

> Dropped before implementation: a mode that silently changes what "Assign" does was judged more
> confusing than the instant-email behavior it replaced. Design's `.cc-draft-*` treatment was not
> implemented. The section below is kept as the record of what was considered and why.

**The problem.** Goalies get a staged flow: fill silently (`AUTO_PROPOSED`) → review → **Send
Confirmations** → publish. Refs and scorekeepers don't — assigning a ref emails them *instantly*, on
the first click. The ref coordinator can't lay out a draft week and review it before people start
hearing about it. This is probably her biggest day-to-day friction.

**What to design.**

- **A draft-mode toggle** for the Referee and Scorekeeper tabs — *"assign without emailing."* It
  changes what a click on Assign *does*, so it needs to be visible and unambiguous while it's on;
  someone who forgets it's enabled will wonder why nobody responded. Where it lives in the board
  header is yours to decide.
- **A draft bar** that appears when unsent drafts exist for the visible week: a count and a
  "Send All Confirmations" action.

`GoalieProposerBar` is the closest precedent, but do **not** just restyle it — it carries optimizer
output, a sit-out list, and the why-panel, none of which exist for refs. This bar is much smaller. If
the two should visually rhyme as "the same kind of thing," that's a good outcome; sharing a component
is not.

> Note: `GoalieProposerBar.css` has outstanding `!important` cleanup owed once a button-scoping fix
> reaches main. Please don't extend that file.

## 4. Slot-row response detail

**The problem.** When a ref declines, they can leave a reason — from the email link or in-app — and it
**is** captured and returned by the API. It is rendered nowhere. She sees "Declined" and has no idea
why, so she has to text them to find out. Response timing is likewise invisible: a slot proposed an
hour ago and one that's been ignored for six days look identical.

**What to design.** A secondary line on the slot row carrying the decline reason (with an empty state
— reasons are optional) and relative response timing. Slot rows are strictly single-line today, so
this is new vocabulary: it must not make confirmed, uneventful rows noisier, since most rows are
fine and she's scanning for the two that aren't.

Consider whether `PROPOSED` rows should surface *staleness* here too ("awaiting 6 days") — the confirm
tokens expire after 7 days, and a silently-expired proposal is a real failure mode.

## 5. Removing a confirmed person — a destructive action that emails someone

**The problem.** A ref cancels the morning of a game. The coordinator needs to pull them out of that
slot, often before she has a replacement. Today a confirmed slot offers **Reassign only** — there is
no way to empty it. Her only move is to reassign to *someone*, which means naming a person she
doesn't have yet.

**What to design.** A **Remove** action on confirmed slot rows, plus the confirmation step it needs.
This is meaningfully different from the existing "Clear" on a pending row, which fires instantly and
harmlessly:

- It **unpublishes** — the person disappears from the public schedule, the game preview, live score
  entry, and their own dashboard.
- It **sends them a cancellation email.**
- It is the action taken under time pressure, on a phone, an hour before puck drop. It has to be fast
  to reach and hard to fire by accident, which pull against each other — that tension is the design
  problem.

The confirmation needs to say plainly what will happen: who is being removed, that they'll be emailed,
and that the slot returns to open. Worth considering whether "remove" and "swap in a replacement" are
one flow or two — she often has the replacement in hand, and making her do two separate operations
with an alarming confirm in between may be worse than one combined action.

## 6. Referee + scorekeeper emails

**The problem.** A referee's **only** email today is the initial "please confirm" proposal. Publishing
a ref week sends them nothing — they're written onto the game and never told it's final. If they're
reassigned off a game, they're never told that either. The final-assignment email exists for goalies
only.

**What to design** — two new templates:

- **Final assignment** (post-publish): your shift is locked in, here's the game, no action needed.
  The goalie equivalent names the team they're in net for; **refs and scorekeepers don't have a
  side** — they work the game — so that line has no analogue and the email needs its own center of
  gravity.
- **Cancellation**: you were published to a game and have been taken off it. Short and unmistakable —
  this one has to survive being skimmed on a phone, because the failure mode is someone driving to a
  rink they're no longer working.

## 7. Week-schedule block for refs and scorekeepers — **confirmed in scope**

Goalie emails now end with a week-schedule card (shipped; see `GOALIE_WEEK_SCHEDULE_EMAIL_HANDOFF.md`
for the design that was built). **The league wants refs to get the same context.**

**The structural difference, which is the actual design problem.** The goalie block pairs each goalie
*with a team* — home net and away net, a natural two-column row. **Referees aren't attached to a
side.** Two refs work the whole game. So a ref row is "Team A vs Team B" as *context*, with "Ref 1 /
Ref 2" as the staffing — a different shape, not a relabeling of the goalie row. **Scorekeepers** are
one person per game, simpler again.

Decide whether these are one flexible row treatment across all three roles or genuinely separate
designs. Either answer is fine if it's deliberate.

**Carry over these already-settled rules from the goalie block:**

- Shows the **current state at send time**. Names appear regardless of confirmation status.
- **Do not** color or badge by confirmed/pending/declined — this block is "who's currently penciled
  in," not a status board.
- Empty slots render as "Unassigned."
- The recipient's own game is highlighted (gold accent + "Your Game" tag in the goalie version).

**Data available per game** (backend supplies all of it):
`date`, `time`, `rink`, `homeTeamName`, `homeTeamColor` (hex), `awayTeamName`, `awayTeamColor`,
`isRecipientGame`, plus `ref1Name` / `ref2Name` (either may be empty) or `scorekeeperName`.

**Email medium constraints — same as the goalie block:** table-based layout only, **every style an
inline `style="..."` attribute**, no JS/external images/fonts/CSS, web-safe font stack (`Arial,
Helvetica, sans-serif`), max-width ~600px, legible in both light and dark email themes. The emails
have no branded wrapper — they're bare `<p>` paragraphs, and this block is inserted between them.

**Already built server-side and reusable:** the `SCHED_WRAPPER` / `SCHED_ROW` / `SCHED_ROW_RECIPIENT`
templates, a `TEAM_HEX` name→hex color map mirrored from the frontend, and swatch/escape helpers — all
in `CoordinatorService.java` (lines 512–692). If your ref row can reuse the existing wrapper and only
vary the row, say so explicitly; that's meaningfully less work to implement.

---

## Out of scope

- Backend logic, endpoints, and data gathering — all specced in `COORDINATOR_CONSOLE_GAPS_SPEC.md`.
- The confirm/decline landing page (`ConfirmShift.jsx`) — already designed and working.
- The goalie auto-proposer bar and its why-panel — shipped, not being revisited.
- Surfacing ref availability in the assign picker — reuses the existing goalie-pool candidate
  treatment as-is; no new design needed.
- A full branded email wrapper. Worth doing eventually, but it would block all of the above.

## Deliverable

Per piece: the markup/JSX structure and styles, using existing tokens and the `cc-` prefix where it
fits, plus the states each piece needs (disabled, empty, loading, error). For the two email templates
and the schedule block: complete inline-styled HTML with an obvious repeat structure — one worked
example with 2–3 rows plus a note on which `<tr>` repeats and which fields substitute — so it can be
turned into a server-side template.

**Note the role asymmetry throughout.** This one board serves three roles with different slot counts
(goalie 2 per game and team-attached, ref 2 per game and side-agnostic, scorekeeper 1), and only
goalies have the proposer bar. Designs that quietly assume the goalie shape will break on the other
two tabs — which is exactly where the current gaps came from.
