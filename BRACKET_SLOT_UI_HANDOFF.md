# Handoff: Playoff Bracket Slot Designation — UI

**Audience:** Claude Design. This describes a NEW piece of UI to design. The backend already
exists and is working; nothing here needs an algorithm designed. What's missing is the interface
for one specific decision: **which time slot hosts which playoff game.**

---

## What it is

Each playoff week has a fixed set of game slots (a time + a rink, already scheduled months in
advance). But only some of those slots host actual bracket games — the rest are consolation games
for teams that are out.

With 10 teams and 5 slots per week:

| Playoff week | Round | Bracket games | Consolation games |
|---|---|---|---|
| 1 | Quarterfinals | 4 | 1 |
| 2 | Semifinals | 2 | 3 |
| 3 | Final | 1 | 4 |

The coordinator needs to say *"the semifinal is the 8:30 game on Cardinal, not the 7:00 one."*
That's the whole feature. Today there is no way to express it.

**Why it matters:** playoff games get deliberately placed at the best times — sometimes a time that
suits the players on the two teams involved, sometimes just "put it in the middle slot so nobody
plays at 10:15pm." This is a real weekly decision the coordinator makes by hand.

It also has a downstream consequence: the goalie auto-proposer assigns the **best available
goalies** to bracket games and fills consolation games from whoever's left. If the wrong slot is
marked as the semifinal, the wrong game gets the good goalies.

---

## Where it lives

**Schedule Manager page** (`ScheduleManager.jsx`), in the existing generated/saved schedule list,
on weeks tagged `Playoff`.

What's already on that screen today:
- Weeks render as cards with a `Playoff` / `Regular` tag in the header.
- Each game renders as a row (`.sched-game-row`) with an inline editable **time** input, rink, and
  the two team names/colors.
- A `🏆 Initialize Playoff Bracket` button appears once a saved schedule has TBD playoff games. It
  seeds the bracket from current standings.

The new designation control belongs **on the playoff-week game rows**, alongside the existing time
editing. Designing it as part of that row (rather than a separate screen) matters, because the
coordinator is usually adjusting the time and the role in the same sitting.

---

## The core mental model (please lean on this)

The bracket positions are **fixtures** — they exist independently of when they're played, and they
define the tournament tree:

```
QF #1  (Seed 1 vs Seed 8) ─┐
                           ├─ SF #1 ─┐
QF #2  (Seed 2 vs Seed 7) ─┘         │
                                     ├─ FINAL
QF #3  (Seed 3 vs Seed 6) ─┐         │
                           ├─ SF #2 ─┘
QF #4  (Seed 4 vs Seed 5) ─┘
```

The slots are **times**. The coordinator's job is assigning fixtures → slots.

So the interaction is closer to "which of these 5 times does QF #2 get?" than to "what kind of game
is this?" Either framing can work visually, but the fixture identity (`QF #2`, `SF #1`, `FINAL`)
should read as a stable thing being placed, not a free-form label being typed.

**Important:** re-designating a slot changes *when a fixture is played*. It does **not** rewire the
bracket tree — QF #1's winner always advances to SF #1's home side regardless of what time QF #1 is
played at. The design should not imply that moving a game changes who plays whom.

---

## States to design

### 1. Playoff week, not yet seeded
Before the regular season ends there are no standings, so every game is TBD. Bracket roles are
already designated (defaults: earliest slots get the bracket games) but no teams are known.
Show the role, show TBD teams, allow re-designating.

### 2. Quarterfinal week, seeded
Teams are known. This is the richest state:
```
Thu Aug 20  7:00 PM  Cardinal   QF #1   Team 6 vs Team 4
Thu Aug 20  7:15 PM  Tubbs      QF #2   Green Machine vs Team 5
Thu Aug 20  8:30 PM  Cardinal   QF #3   Tan vs Team 3
Thu Aug 20  8:45 PM  Tubbs      QF #4   Team 10 vs Team 1
Thu Aug 20 10:15 PM  Tubbs      —       Team 9 vs Blue        (consolation)
```
(Real slot data from Summer 2026 week 12. Note two rinks running near-simultaneously, and one
late slot — that 10:15 PM game is exactly the one nobody wants, which is why this feature exists.)

### 3. Semifinal / Final week, awaiting advancement
Bracket roles designated, teams still TBD because the previous round hasn't been played. Consolation
games in these weeks also have TBD teams (they depend on who lost). 3 of 5 slots are consolation in
the SF week, 4 of 5 in the final week — so **most rows are consolation** here. Design shouldn't make
consolation feel like an error state; it's the common case in later rounds.

### 4. Mid-change / conflict
Each role can only be held by one slot. Assigning `SF #1` to a slot that isn't currently `SF #1`
means another slot has to give it up. **Recommended behavior: swap the two slots' roles** — it keeps
the correct number of bracket games automatically and matches the "moving a fixture to a different
time" mental model. Please design what that swap looks like/communicates.

### 5. Past / locked
Once a playoff game is Final, its designation shouldn't be editable. Show the role, no control.

---

## Constraints the UI must respect

- **Exact counts per week.** A quarterfinal week has exactly 4 bracket games, a semifinal week
  exactly 2, a final week exactly 1. The UI should make it impossible to end up with 3 semifinals
  or zero. (This is why swap is recommended over free assignment.)
- **Positions are unique within a round.** No two slots can both be `SF #1`.
- **Round is implied by the week**, not chosen freely — you can't put a `FINAL` in the
  quarterfinal week. The available roles for a week are: its round's positions, plus "Consolation".
- **Consolation is the absence of a bracket role**, not a separate kind of thing. Any number of
  slots can be consolation.

---

## Data / API (already built — context only)

Each game carries:
- `gameType`: `REGULAR_SEASON` | `PLAYOFF`
- `playoffRound`: `QUARTERFINAL` | `SEMIFINAL` | `FINAL`, or **null = consolation game**
- `bracketPosition`: 1-indexed within the round, or null for consolation

The designation call:
```
PATCH /api/v1/games/{gameId}/bracket-slot
{ "round": "SEMIFINAL", "position": 1 }     → make this slot SF #1
{ "round": null }                            → make this slot a consolation game
```

A swap is therefore two calls. Worth knowing for designing intermediate/optimistic states.

---

## Out of scope

- The bracket seeding logic and advancement (built and working — top 8 seeded 1v8/2v7/3v6/4v5,
  winners advance automatically).
- The goalie auto-proposer (built; it consumes these designations).
- The existing `PlayoffBracket.jsx` bracket display — it reads the same fields and will reflect
  these designations correctly without changes. **However**, if you see an opportunity to link the
  two screens (e.g. "view bracket" from here), flag it rather than designing it.
- Routing this endpoint through the API gateway — it currently lives on game-service only. That's
  an engineering task, already noted.

---

## Open question for the designer

The coordinator can already edit a game's **time** inline on this screen. So there are two ways to
get a semifinal to 8:30 PM: change the semifinal's time, or designate the 8:30 slot as the
semifinal. These overlap, and having both could be confusing.

Is the row-level role control the right model, or would a week-level "assign fixtures to slots"
arrangement (fixtures on one side, time slots on the other) be clearer? Either is buildable —
please make a recommendation.
