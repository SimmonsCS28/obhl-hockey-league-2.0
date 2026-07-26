# Handoff: Weekly Goalie Assignment (auto-proposer) — UI + email flow

**Audience:** Claude Design. This describes a NEW feature and the UI/UX + emails to design.
The assignment *algorithm* itself is being built separately on the backend; you do **not**
need to design its internals — treat it as a button that returns a proposed set of matchups.

---

## What it is

Each week, a Goalie Coordinator (and Admin) has to put two goalies in every game. Today that's
manual. This feature adds a **"Generate proposed goalie assignments"** action that, for a single
week, auto-proposes which two goalies play each game — balanced, skill-appropriate, and rotated
so goalies don't keep getting the same time slot or the same teams. The human then reviews,
optionally emails goalies to confirm their game time, and later publishes final assignments.

The output is always a **proposal for review** — never an auto-commit.

---

## Where it lives & when it's available

Surface the feature in **both** places (same component, two entry points):
1. **Goalie Coordinator** page
2. **Admin → Assignments** page

**Access rules (important):**
- Only available when the user is viewing a **single week** (not a season/all-weeks view).
- **Not** available for a week in the **past** — hide/disable the action entirely for past weeks.
  (Current and future weeks only.)

---

## The end-to-end flow (design all states)

1. **Generate.** User viewing week N clicks "Generate proposed assignments." Backend returns a
   proposal: 2 goalies per game, each tagged with rating/tier and any rotation flags.
2. **Review & edit.** Show the proposal as an editable week grid (see sample below). The user can
   swap/override any goalie before doing anything else. Show *why* the algorithm made choices
   (tier match, who's sitting and why, any soft-rule conflicts) so the human trusts it.
3. **Send "proposed schedule" email.** Action to email each assigned goalie asking them to confirm
   **they're good for the GAME TIME only** — NOT the team. At this stage team assignment is not yet
   decided; we only want to lock each goalie to a time slot. (We've already tried to avoid giving a
   goalie a game involving a team they played for/against last week, but that's best-effort, not a
   promise to the goalie.)
4. **Goalies confirm.** Goalie clicks the email link and confirms the time works. Confirmation is
   reflected in the assignment UI (same confirmed/pending/declined states the current shift-
   assignment workflow already shows).
5. **Publish (final).** Later, after GMs have submitted their goalie picks and the coordinator/admin
   has placed goalies into the exact team slots, the user publishes. Publishing sends a **second
   email**: "your final assignment for the game has been made," with the goalie's exact game + team.

So there are **two distinct emails**, with different copy and different moments:
- **Email A — "Confirm your time"** (post-proposal): confirm availability for the game *time*.
- **Email B — "Final assignment"** (post-publish): here is your exact game and team.

Design both email templates and the two link/confirmation landing states.

---

## What a proposal looks like (real sample — Summer 2026, Week 8)

Five games, two goalies each. Each night has an **Early** game, a **Late** game, and the rest are
**Mid**. Ratings shown for context; the two goalies in a game are always close in skill.

| Slot | Game | Goalie 1 (rating) | Goalie 2 (rating) |
|------|------|-------------------|-------------------|
| Early | Red Riot vs Blue | Luke Frelke (6) | Patrick Martin (5) |
| Mid | Orange Dreamsicle vs BS & Beers | Cole Mitchell (7) | Mason LeFebvre (7) |
| Mid | The Bruce Banners vs Grey Ghosts | Chris Erickson (4) | Rhiannon Lucente (3) |
| Mid | White vs Tan Boy Summer | Amy Vincent (2) | Tyler Madro (0) |
| Late | Blueberry Bullfrogs vs Clusterpucks | Todd Borchert (7) | Erich Manthey (6) |

**Sat out this week:** Steve Braun, Randy Coleman (they'd played the most, so they rotate out).

Design should also show, per proposal:
- **Who is sitting** this week and a short reason ("most games played — rotating out").
- **Soft-rule flags** where the algorithm couldn't fully avoid a repeat, e.g. "⚠ plays a team from
  last week" or "⚠ same time slot as last week" — so the human can choose to override.

---

## Concepts the design should reflect (context, not to build)

- **Full-time vs substitute goalies.** Only *full-time* goalies are auto-assigned. Subs fill in ad
  hoc. There may be a need to manually pull in a sub when not enough full-timers are available —
  design an "add a substitute to a slot" affordance.
- **Skill tiers.** Goalies have a 0–10 rating grouped into three (overlapping) tiers; matchups stay
  within/near a tier. A small tier badge next to each goalie is helpful.
- **Availability.** Goalies mark weekly availability elsewhere; the proposal already excludes anyone
  marked unavailable. Showing an availability indicator per goalie is a nice-to-have.
- **Rotation.** Time slot (early/mid/late) and opponent teams are rotated week-to-week. The "why"
  panel can reference this.

---

## Out of scope for this handoff
- The assignment algorithm's internal logic/weights (backend).
- The email-sending infrastructure (already exists — Resend).
- The existing goalie confirm/decline shift-assignment mechanics (reuse as-is for Email A).
