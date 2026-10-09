# Handoff: League Draft Tool — choosing how the team columns are ordered

**Audience:** Claude Design. One piece, small in function and awkward in placement. The
board is built and in use; this adds a control to it.

**Scope fence:** the League Draft Tool at `/admin?tab=draft` only. The Tournament Draft is
untouched.

---

## What happens today

The team columns are re-ordered by **average skill, lowest first**, and that is hardcoded.
It happens automatically after **every pick** and after **Assign GMs**, so the columns
visibly reshuffle as the draft proceeds. That behaviour is long-standing and deliberate —
it keeps the weakest team leftmost so the next pick is obvious — and the board announces it
now ("the columns moved on purpose").

There is no way to change it.

## What the operator asked for

> "Being able to switch team sorting by number of players on team, or by number of
> forwards, or number of defense would be helpful as well."

So: average skill (today's behaviour), roster size, forward count, defence count.

**The sorting itself is trivial** — a comparator over the same numbers the balance block
already computes, in `draftBalance.js`. Nothing here is an algorithm problem. What is
genuinely unclear is where the control goes and how it interacts with the automatic
re-ordering, which is why this is coming to you rather than being added directly.

---

## 1. There is no room in the control bar

Measured on the live board at 1440px, the width the draft actually runs at:

| Mode | Control bar | Slack |
|---|---|---|
| Rows | 2 rows, 101px tall | endgame group ends at 1383px, bar ends at 1399px — **16px** |
| Grid | **3 rows**, 141px tall | Across + Rosters already push it to a third row |

The bar carries five segmented groups already (Density, Card size, Layout, and in Grid
also Across and Rosters), plus Finalize and the ⋯ drawer. A sixth group takes Rows to three
rows and Grid to four, which walks back the "it wraps, it never scrolls, and it stays
compact" work from the original handoff.

So the first question is not what the control looks like but **where it can possibly live**.
Some possibilities, none of them obviously right:

- Inside the **board balance strip** rather than the control bar (see §3 — there is an
  argument this is where it belongs conceptually as well as spatially).
- Folded into the existing **Layout** group, since "how the board is arranged" is already
  that group's job.
- A small control on the board itself rather than in the chrome.
- Something else. The constraint is real; the placement is yours.

## 2. The automatic re-ordering is the hard part

Columns re-sort after every pick. That is fine when the sort is "weakest team first" — it is
the point. It is much less obviously fine for the others:

- Sorted by **roster size**, a column jumps position the moment you place a player in it —
  including the column you just dropped onto, which moves out from under the cursor.
- Sorted by **defence count**, the same.

So each sort axis needs an answer to: *does the board re-order live, or only when the sort
is chosen?* A board that reshuffles under the operator's hand during a three-hour draft is
worse than a slightly stale ordering — that judgement is already on the record in the
original handback, about a different feature.

Options worth weighing: re-sort live always (consistent, possibly maddening); re-sort only
on demand with a visible "re-order now" affordance; re-sort live only for average skill and
freeze for the others; or something that makes the movement legible rather than preventing
it.

**Do not treat this as a detail to settle in implementation.** It is the difference between
a useful control and one the operator turns on once and never touches again.

## 3. It overlaps something that already exists

The **board balance strip** above the columns already reports these same axes — roster size,
skill average, forward/defence split — and each chip **already jumps to the worst offending
column** when clicked.

So "sort by defence count" and "click the `F/D · 2 short on D` chip" are two answers to one
question: *which team needs a defenceman?* One reorders the whole board to surface it; the
other takes you to it and leaves the board alone.

That is worth resolving rather than shipping both and hoping. Either the sort belongs in the
strip as an extension of what the chips already do, or the two need to read as clearly
different tools. A third possibility: the sort makes the chips redundant, or vice versa.

## 4. Smaller questions

- **Direction.** Ascending skill is meaningful (weakest first, so the next pick is obvious).
  Is ascending meaningful for defence count, or does the operator want most-short-first,
  i.e. the inverse? If direction is needed, that is another control or a click-to-toggle.
- **Persistence.** View preferences — density, card size, layout, filters — are already
  remembered per browser between sessions. A team sort should presumably join them; confirm
  that is right.
- **Naming.** "Sort" collides with the per-column roster sort that already exists inside
  each team card ("Position + Rating" and so on). Two different sorts on one screen, one
  ordering columns and one ordering players inside a column, need to not be confusable.

---

## Constraints

- Classname prefix `obi-draft-`, `--obi-*` tokens only, dark theme. Matches the existing
  board.
- The board runs at **1366–1440px** on a laptop, inside the admin shell. The shell's menu
  can now be collapsed to a 46px rail, which frees 190px — but do not assume it is
  collapsed.
- Whatever this is must survive **14 team columns** and all three densities, including
  Overview where a column is 92px wide.
- The existing segmented-control pattern (`.obi-draft-seg`) and the balance chip pattern
  (`.obi-draft-chip`) are the vocabulary to work in.

## Not in scope

The comparator, the reducer wiring, and persistence are implementation and will be handled
here. The automatic-re-order *behaviour* is not implementation — it is question 2, and it
needs an answer from you.

## Deliverable

Same as prior handoffs — a `.dc.html` prototype with a short README, into the
`Website theme integration` folder in Downloads. Show it at 14 columns, in both Rows and
Grid, and in Overview density where space is tightest. If the answer turns out to be "this
belongs in the balance strip and the chips change shape", show that.
