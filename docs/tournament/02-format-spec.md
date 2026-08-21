# Tournament format and schedule generation

The authoritative statement of what each format produces. `TournamentScheduleGeneratorTest`
implements the tables below row for row, so a disagreement between this document and the code is a
failing test rather than a judgement call.

Implemented by `TournamentScheduleGenerator` (pure — no Spring, no database). The admin's live
preview computes the same numbers in `tournamentFormat.js`; the two must agree.

## The stage model

Format is **three independent stages**, not one enum. The shape wanted for eight teams — two
divisions, a bracket for the top two of each, a placement game, and consolation games for the bottom
four — is not one of the design handoff's three presets, and next year would want another. Composing
stages covers all of them without new generator code each time.

| Stage | Values |
|---|---|
| Group | `NONE` · `ROUND_ROBIN` · `DIVISIONS` (with `poolCount`, `advancePerPool`) |
| Championship | `NONE` · `SINGLE_ELIM` (with optional `placementGame`) |
| Consolation | `NONE` · `SINGLE_ROUND` · `BRACKET` (with `consolationTeamCount`) |

## Seeding

Teams carry seeds 1..N. Everything below is expressed in seeds; mapping seed → team id is the
caller's job, which is what keeps the generator pure.

**Divisions are snake-assigned** so strength is spread evenly: seed 1 → A, 2 → B, 3 → B, 4 → A,
5 → A, 6 → B, 7 → B, 8 → A. For 8 teams in 2 divisions that gives A = {1,4,5,8}, B = {2,3,6,7}.

**Bracket qualifiers are ordered by rank-within-division first, then by division**: A1, B1, A2, B2,
A3, B3… Combined with standard bracket pairing this produces cross-division seeding for free —
`seedOrder(4)` pairs (1,4) and (2,3), which with that ordering is **A1 v B2** and **B1 v A2**.

**Standard bracket pairing** is the usual recursive order: `seedOrder(1) = [1]`, and
`seedOrder(2n)` interleaves each `s` from `seedOrder(n)` with `2n+1-s`. So
`seedOrder(4) = [1,4,2,3]` and `seedOrder(8) = [1,8,4,5,2,7,3,6]`.

## Byes

A single-elimination bracket of `q` qualifiers uses a bracket of `nextPowerOfTwo(q)` slots; the
`bracketSize - q` highest slot numbers are byes and go to the **top seeds**.

**A bye creates no game.** The seed advances directly into its second-round slot, and the second
round game is generated with that seed already filled in. The alternative — a phantom completed game
— would pollute the schedule page and player stats.

A single-elimination bracket always plays exactly **`q - 1` games** regardless of byes: every game
eliminates one team and all but one must be eliminated.

## Game counts

| Config | Games | Breakdown |
|---|---|---|
| 8 teams, round robin only | **28** | 28 group |
| 8 teams, single elim only | **7** | 7 bracket |
| 16 teams, single elim only | **15** | 15 bracket |
| 5 teams, single elim only | **4** | 4 bracket (3 byes, 1 first-round game) |
| 12 teams, single elim only | **11** | 11 bracket (4 byes, 4 first-round games) |
| 6 teams, 2 divisions, top 2, no extras | **9** | 6 group + 3 bracket (2 semifinals + 1 final) |
| **8 teams, 2 divisions, top 2, placement, consolation 4** | **18** | 12 group · 2 semifinal · 1 final · 1 placement · 2 consolation |

The last row is the C League Classic's intended shape: every team plays 3 division games plus exactly
one game on day two, so nobody drives to the rink to watch.

## Stage rules

**Group / `ROUND_ROBIN`** — everyone plays everyone once: `n(n-1)/2` games, via the circle
algorithm. Odd counts give one team a bye each round.

**Group / `DIVISIONS`** — snake-partition into `poolCount` divisions, then round robin within each.
Uneven divisions are allowed but warned about, since teams then play different numbers of games.

**Championship / `SINGLE_ELIM`** — as above. Round names derive from distance to the final:
`FINAL`, `SEMIFINAL`, `QUARTERFINAL`, `ROUND_OF_16`. `bracketPosition` is 1-indexed within a round,
and a game at position `p` feeds position `ceil(p/2)` of the next round — the same arithmetic the
existing playoff advancement already uses.

**Championship / placement** — one game between the two **semifinal losers**. Requires a bracket of
at least four; otherwise there are no semifinals and the game is not generated.

**Consolation / `SINGLE_ROUND`** — every non-qualifier plays exactly one game, so `n` teams produce
`n/2` games — not one game total. Pairing is **crossed**: the best remaining plays the worst, which
for the 8-team shape is **A3 v B4** and **A4 v B3**, so nobody replays a division opponent they just
faced. An odd count leaves one team out, which is reported rather than hidden.

**Consolation / `BRACKET`** — elimination among the non-qualifiers: `n - 1` games.

## Days and slots

Group games are day 1; bracket, placement and consolation are day 2. Games are assigned to uploaded
ice slots in order.

**Slot count is validated up front.** If the format needs 18 games and the CSV supplies 14, that is
reported as an error before anything is written. The existing league generator silently cycles or
truncates instead, which would quietly drop the consolation games.

## What is known at generation time

Group-stage games are **fully determined** — the matchups follow from the seeds. Bracket, placement
and consolation games are **placeholders** with null team ids until the stage feeding them finishes.
`games` has allowed null team ids since migration 029 for exactly this, and `chk_different_teams`
already tolerates them.
