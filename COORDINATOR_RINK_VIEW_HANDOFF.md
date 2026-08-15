# Handoff: Coordinator Console — group a week by rink, and flag staff who are playing

**Audience:** Claude Design. Two related additions to the Coordinator Console's single-week view.
The backend work is small and described at the end; what's needed first is the interface. Both
changes serve one job: **help the ref coordinator reason about a single sheet of ice.**

Requested by the league after using the console. The reasoning, in their words: seeing which teams
play before or after each other on one sheet makes it easier to assign people who are also on a
team — so ordering by rink, and knowing who's playing, are two halves of the same problem.

---

## Context

The board (`frontend/src/components/coordinator/CoordinatorBoard.jsx`, styles `Coordinator.css`) is
one screen reused for Goalie / Referee / Scorekeeper. Games are grouped **month → week → game card**,
and within a week they're ordered by start time only. Selecting a single week is already a first-class
mode (the week chips at the top), and both features here apply **only** to that mode — in "All Weeks"
they're hidden.

Existing vocabulary to match: `cc-week-hd`, `cc-week-hd-actions`, `cc-game-card`, `cc-game-hd`,
`cc-card-actions`, `cc-picker`, `cc-candidate-btn`, `cc-candidate-name`, `cc-candidate-sub`.

> ⚠️ **No CSS scoping exists in this codebase** — every class is global, and there have been three
> real collisions. Keep the `cc-` prefix and grep `frontend/src` before using any new name.

**The league's real shape, which should drive the design rather than a generic case:** there are
exactly **two rinks — Tubbs and Cardinal**. A typical week is **5 games: 3 at Tubbs, 2 at Cardinal**.
So "group by rink" produces two short, readable columns or stacks, not a long list. Rink is a free-text
field, so treat two as the common case, not a guarantee.

---

## 1. Group a week by rink

**Scope: all three coordinator areas.** It's the same board and the same game list on every tab, so
the ordering control applies to Goalie, Referee and Scorekeeper alike. Nothing about it is role-specific.

**The problem.** Within a week the games are ordered by time across both rinks interleaved, so the
sequence *on one sheet* — who plays right before and right after whom — has to be reconstructed in
the coordinator's head. That sequence is exactly what she needs when assigning someone who also plays.

**What to design.** A way to switch the single-week view between **By Time** (today's behavior,
the default) and **By Rink** (games grouped per rink, each group in start-time order).

Decisions that are yours:

- **Where the control lives.** The week header (`.cc-week-hd-actions`) already holds an open-count note
  and the Publish button. This control belongs to the *view*, not to the week's data, so it may belong
  elsewhere entirely — near the week chips, for instance. Only one week is ever shown in this mode.
- **What a rink group looks like.** A header per rink? Two columns side by side? At 3 and 2 games the
  whole week could sit on one screen, which the current single stack doesn't achieve.
- **How adjacency is expressed.** This is the actual point of the feature. Within a rink group the
  games are consecutive on that sheet, and the value is seeing that Team A plays at 7:15 and Team B at
  7:45 on the same ice. Consider whether a connecting element, shared spine, or explicit gap/turnaround
  time earns its place — or whether plain ordering is enough. Don't add ornament that doesn't inform.
- **Mobile.** At ≤760px, columns aren't available; decide what the grouping degrades to.

The state must survive switching between weeks. It should not persist into "All Weeks", where it has
no meaning.

## 2. Team badge and playing-conflict flag in the assign picker

**Scope: all three coordinator areas — Goalie, Referee, and Scorekeeper.** The board is one component
reused per role, and the underlying question ("is this person playing in this game?") is the same for
all of them. Design one treatment that works on every tab; the two role-specific wrinkles below are
the only places they diverge.

**The problem.** When assigning anyone, the coordinator can't see whether that person is *playing* in
the game she's assigning them to — or in the game immediately before or after on the same sheet. She
currently carries that knowledge in her head.

**What to design.**

- **A team badge on each candidate** in the assign picker (`.cc-picker` / `.cc-candidate-btn`), showing
  the team they play for. Team colors already exist as a name→hex map and are used elsewhere in the
  console as dots and pills.
- **A conflict flag** when the candidate plays for **either team in the game being assigned**.

### ⚠️ The constraint that should shape this design

**There is no reliable link from a user account to a player record.** The `players` table has no
`user_id`; the join is `users.email` ↔ `players.email` scoped by `season_id`, and the existing code
that uses it already documents it as fragile. Measured against the current season:

| Role | Users | Resolve to a player row | Of those, have a team |
|---|---|---|---|
| Referee | 33 | 15 | 14 |
| Goalie | 28 | 24 | **3** |
| Scorekeeper | 10 | 4 | 2 |

**Fewer than half of referees resolve, and goalies almost never have a team** (they're not rostered to
one). So a naive design — badge when known, nothing when not — would leave most candidates blank, and
**blank would silently read as "no conflict."** That is the failure mode to design against: it would
hand the coordinator false confidence exactly where she's currently relying on her own memory.

**Design three states, not two:**

| State | Meaning |
|---|---|
| **Conflict** | Resolved, and they play for one of the two teams in this game |
| **Clear** | Resolved, and they don't |
| **Unknown** | We could not resolve them to a player this season |

**Unknown must be visibly distinct from Clear** and must not look like an error or a warning — it's
the normal case for most people today, so it can't be alarming or the picker becomes noise. Getting
this three-way distinction right is the core of this piece.

### Two role-specific wrinkles

**Goalies: the feature will be almost entirely "unknown" on that tab.** Only **3 of 28** goalies carry
a team at all — they aren't rostered to one. So on the Goalie tab nearly every candidate lands in the
Unknown state. That is not a reason to leave the tab out, but it *is* a reason the Unknown treatment
must be quiet enough to sit on 25 of 28 rows without turning the picker into a wall of warnings. If
your design only reads well when most rows are Clear, it will fail on the tab where it's used most.

**Goalies: the rule is settled, and it's the same rule as the other two roles.** A goalie who also
plays in the league **would never play goalie in a game their own team is in** — not in their own
team's net, not in the opponent's. So the own-net / opponent-net distinction is irrelevant: both are
conflicts. There is **one flat rule on every tab**:

> The candidate plays for the home team or the away team in this game → **conflict**.

Design one treatment; no per-role variation.

Also decide:

- **How hard should a conflict read?** This is a real league rule being broken, not a soft preference,
  so it should be the loudest thing in the picker row — closer to the disabled treatment than to a
  muted hint. But recommend **warn, don't hard-block**: the team data can be stale (someone changed
  teams, or the resolved row is from a prior season), and the coordinator is the authority on her own
  roster. A conflict is only ever shown when the person *did* resolve, so an unresolved candidate
  never blocks anything either way.
- **Adjacent-game conflicts.** Playing in the game immediately before or after on the same sheet is a
  real scheduling problem and is why feature 1 exists. Is that worth surfacing in the picker too, or
  does the rink view alone carry it? Your call — flag it if you think it earns the complexity.
- **Where the flag appears besides the picker.** Once a conflicted person is assigned, the picker is
  closed. Should the slot row show it? (`.cc-slot-meta` already exists for secondary row detail.)

---

## Backend notes (not design work — for the implementer)

- **Grouping by rink** is pure frontend. `game.rink` is already on every game object the board loads.
- **Team resolution** needs a new endpoint or an addition to the existing coordinator payload:
  `userId → { teamId, teamName, teamColor }` for a season, resolved by lowercased email against
  `players` for that `season_id`. It must return an explicit *unresolved* marker rather than omitting
  the entry, so the UI can tell Unknown from Clear.
- **Case matters.** Match on `lower(email)` — case-variant duplicate accounts have caused a real
  production incident here before.
- **`seasonId` is required** on any player lookup. There is one `players` row per person *per season*,
  so a team-only or email-only query can resolve a stale row from a prior season.

**Worth fixing separately, and out of scope here:** the missing `user_id` on `players`. Every feature
built on the email join inherits its ~50% miss rate. A proper foreign key would turn Unknown from the
common case into the exception — and would make this feature substantially more useful than it can be
today.

---

## Out of scope

- Anything in `COORDINATOR_CONSOLE_HANDOFF.md` (pieces 1–7), which is built and shipped on
  `coordinator-console-gaps`. Draft mode from that handoff was **cut** and should not be revived here.
- The goalie auto-proposer bar and its "why" panel.
- Changing assignment, publish, or email behavior in any way.
- The `players.user_id` data fix described above.

## Deliverable

Per piece: markup/JSX structure and styles using existing tokens and the `cc-` prefix, plus every
state — including the empty case (a rink with one game), the loading case, and all three
conflict states. Note explicitly which existing classes you're reusing versus introducing.

**Both pieces ship on all three tabs.** Show the conflict treatment at least once on a Goalie-tab
example, where nearly every row is Unknown and only one or two carry a team — that's the hardest case
for the design and the one most likely to expose a treatment that only works when data is complete.

**Design for two rinks and five games**, the league's actual shape, but don't let the layout break at
one rink or at eight games.
