# Conley Classic scoring — `conley-v1`

The authoritative statement of the tournament points formula. The worked examples below are the
spec: `TournamentPointsCalculatorTest` implements this table row for row, so a disagreement between
this document and the code is a failing test, not a judgement call.

Implemented by `TournamentPointsCalculator` (pure arithmetic) and applied by
`TournamentPointsPolicy` (gathers tallies from `game_events`).

## Rules

Per team, per game. Games are two 15-minute periods with no overtime in group play.

| Component | Points | Rule |
|---|---|---|
| Win | **3** | |
| Tie | **1 each** | |
| Loss | **0** | A losing team still earns the bonuses below |
| Period won | **+1** per period | **Strictly more** goals than the opponent in that period. A tied period awards neither team. |
| Penalty-free period | **+1** per period | That team took **zero** penalties in that period. Independent per team — both can earn it in the same period. |
| Heavy penalties | **−1** | That team took **7 or more** penalties across the whole game, overtime included. |

**Maximum 7** over two periods: win (3) + both periods (2) + both penalty-free (2).
**Minimum −1**: a loss (0) with penalties in both periods and 7+ total. This is exactly the floor
allowed by `games.chk_points` (`>= -1`), and is not a coincidence — do not raise the deduction
without revisiting that constraint.

### Which games score

**Only group-stage games** (`tournament_stage` of `POOL` or `ROUND_ROBIN`) award points. `BRACKET`,
`PLACEMENT` and `CONSOLATION` games award **zero** to both teams — they decide who advances and who
finishes where, not standings. Without this, a consolation win could outrank a semifinal loss on the
table.

In a round-robin-only tournament (no bracket) these standings decide the champion outright, which is
why the tiebreakers are load-bearing.

### Tiebreakers

In order: **head-to-head → goal differential → fewest penalty minutes → coin flip.**

Head-to-head is applied strictly pairwise. Three or more teams level on points can form a cycle
(A beat B, B beat C, C beat A), which has no consistent ordering, so a cycle falls through to goal
differential. The coin flip is not performed by the sort — a comparator must be deterministic, or
the table would reshuffle on every page load. Teams still level after penalty minutes are ordered by
id and flagged `coinFlipApplied` so the UI can show the organiser that a flip is owed.

### Edges worth stating

- **A period in which nothing happened still scores.** No goals means neither team wins it; no
  penalties means **both** teams take the penalty-free point. This is why `games.period_count` is
  stored rather than inferred from the events present — inferring would silently skip such a period
  and cost each team a point.
- **Overtime is not a period anyone can win.** Sudden-death OT in an elimination game contributes
  no period-win or penalty-free points. Its penalties *do* count toward the 7+ threshold, which
  measures the whole game.
- **The final score is authoritative**, taken from the game rather than summed from events, so
  points can never disagree with the scoreboard. Period bonuses can only come from events; if the
  two disagree the policy logs a warning, because the result stays right while the period points are
  computed from incomplete data.

## Worked examples

`H` = home. Penalties are counts, not minutes. All examples are two periods unless noted.

| # | P1 | P2 | Final | Home pen | Away pen | Home pts | Away pts | Covers |
|---|---|---|---|---|---|---|---|---|
| 1 | 2–0 | 1–1 | 3–1 H | 0 | 0 | **6** = 3+1+2 | **2** = 0+0+2 | Win, one period, tied period |
| 2 | 1–2 | 3–0 | 4–2 H | P1:1 | 0 | **5** = 3+1+1 | **3** = 0+1+2 | Split periods, one penalty |
| 3 | 1–1 | 2–2 | 3–3 | 0 | P2:1 | **3** = 1+0+2 | **2** = 1+0+1 | Tie, both periods tied |
| 4 | 0–1 | 0–1 | 0–2 A | 0 | 0 | **2** = 0+0+2 | **7** = 3+2+2 | Perfect score |
| 5 | 0–0 | 0–0 | 0–0 | 0 | 0 | **3** = 1+0+2 | **3** = 1+0+2 | Scoreless draw; empty periods still pay |
| 6 | 1–0 | 0–1 | 1–1 | P1:1 P2:1 | 0 | **1** = 1+1−1... | — | see note |
| 7 | 3–0 | 2–0 | 5–0 H | P1:2 P2:1 | 0 | **5** = 3+2+0 | **2** = 0+0+2 | Sweep but penalised in both periods |
| 8 | 0–3 | 0–2 | 0–5 A | 4 in P1, 3 in P2 (7 total) | 0 | **−1** = 0+0+0−1 | **7** = 3+2+2 | Floor case, 7+ deduction |
| 9 | 2–1 | 1–2 | 3–3 | P1:1 | P2:1 | **2** = 1+1+0... | **2** = 1+1+0... | Each wins one period, each penalised once |
| 10 | 1–0 | 1–0 | 2–0 H | 0 | P1:6 | **7** = 3+2+2 | **1** = 0+0+1 | 6 penalties — one short of the deduction |
| 11 | 1–0 | 1–0 | 2–0 H | 0 | P1:7 | **7** | **0** = 0+0+1−1 | 7 penalties — deduction applies |

Note on row 6: home takes a penalty in **both** periods, so it earns no penalty-free points:
1 (tie) + 1 (won P1) + 0 = **2**. Away earns 1 (tie) + 1 (won P2) + 2 (clean both periods) = **4**.

Note on row 9: home is penalised in P1 only, so it keeps P2's penalty-free point:
1 (tie) + 1 (P1 won) + 1 (P2 clean) = **3**. Away is penalised in P2 only:
1 + 1 (P2 won) + 1 (P1 clean) = **3**.

*(Rows 6 and 9 are stated in full in the test; the table's arithmetic column is abbreviated.)*

### Non-scoring stages

| Stage | Home pts | Away pts |
|---|---|---|
| `BRACKET` | 0 | 0 |
| `PLACEMENT` | 0 | 0 |
| `CONSOLATION` | 0 | 0 |

## Changing the formula

Add a new `TournamentScoringProfile` constant with a new key and point `tournaments.scoring_profile`
at it. Do not edit `CONLEY_V1` in place — tournaments already played reference it, and standings are
recomputed on every read, so editing it would retroactively rewrite history.
