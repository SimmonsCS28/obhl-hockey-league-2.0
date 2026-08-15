# Handoff: Coordinator notification preferences, and letting officials drop a confirmed shift

**Audience:** Claude Design. **Two related pieces**, on two different surfaces:

| # | Piece | Surface |
|---|---|---|
| 1 | Coordinator notification preferences — which notices, and where they're sent | Coordinator Console |
| 2 | Letting an official drop a shift they already confirmed | User dashboard |

They're in one brief because piece 2 is what *generates* one of the notifications in piece 1. The
backend for both is straightforward and described at the end; what's needed is the interface.

Piece 1 is built ahead of need, deliberately: today the league has exactly one coordinator (referee),
and the goalie and scorekeeper roles are unfilled and managed from the admin console. The controls
should be in place when those roles are filled, rather than retrofitted onto people already receiving
mail they didn't ask for.

Piece 2 closes a real hole. There is currently **no way for an official to drop a shift once they
confirm it** — the API refuses it explicitly (*"confirmed = coordinator's call"*), so a ref whose
plans change has to phone the coordinator and hope. That still happens for genuine last-minute
changes and always will, but it shouldn't be the only route.

---

## Context

The console (`frontend/src/components/coordinator/CoordinatorDashboard.jsx`) has a banner, a
**Scheduling / Goalie Management** sub-nav, and then three role tabs: **Goalie Coordinator**,
**Referee Coordinator**, **Scorekeeper Coordinator**. A user sees only the tabs they're cleared for —
`isAdmin || hasRole('X_COORDINATOR')`.

**Preferences are per user, per role**, because one person can hold more than one coordinator role and
may want different answers for each. Someone who runs referees and also covers scorekeepers might want
decline notices for refs and nothing at all for scorekeepers.

Existing vocabulary: `cc-tabs-bar`, `cc-role-tab`, `cc-content`, `cc-banner-title`, `cc-banner-sub`,
`cc-publish-result` (used for dismissible banners), `cc-action-btn`.

> ⚠️ **No CSS scoping exists in this codebase** — every class is global and there have been three real
> collisions. Keep the `cc-` prefix and grep `frontend/src` before using any new name.

---

## Piece 1 — Coordinator notification preferences

### The notification types

| Type | Exists today? | Sensible default | Why |
|---|---|---|---|
| **Someone drops a confirmed shift** (piece 2) | **No — new** | **On, and not optional** | The most urgent of the four. They had agreed, the schedule may already be published, and the game may be days away. See the note below on whether this one can be switched off at all. |
| **Someone declines a shift** | Yes, shipped | **On** | Needs action — a slot has nobody in it — but nothing was ever promised to the league. |
| **Someone confirms a shift** | **No — new** | **Off** | Happy path. A 5-game week means ~10 of these per role; on by default would train people to filter the sender and lose the other three with it. |
| **A confirm link expires unanswered** | **No — new** | **Off** | Optional fourth. Include only if it reads as useful rather than as a switch nobody touches — your call, and "cut it" is a fine answer. |

**Decline and drop are different events and need different copy.** A decline means "I never agreed to
this." A drop means "I agreed, and now I can't" — the slot may be live on the public schedule with
that person's name on it, so the coordinator has to both find a replacement *and* republish. The drop
notice should read as the more urgent of the two.

The defaults matter more than the switches. Make it obvious that drops and declines are the point and
confirmations are opt-in noise, rather than presenting four equal toggles.

**Worth deciding:** whether the drop notice can be switched off at all. Everything else here is
preference; a silent drop means someone simply doesn't turn up. A reasonable answer is that it's shown
as always-on and not togglable.

### The delivery address

A field per role for **where these emails go**, defaulting to the user's account email. Two reasons it
exists: routing to a shared inbox that outlives any one coordinator, and letting someone receive
league mail somewhere other than their login address.

Needs: a clear indication of what it falls back to when empty (**not** a placeholder that looks like a
value), validation feedback for a malformed address, and a saved/unsaved state. Consider whether an
unverified address deserves a warning — mail sent to a typo'd address fails silently, and the
coordinator's first clue would be a decline they never heard about.

### Where it lives

Yours to decide. The constraint is that preferences are **per role**, and the console's existing
per-role surface is the tab. Options worth weighing:

- A settings affordance within each role tab, so it inherits the tab's role context.
- One consolidated panel listing every role the user holds, so multi-role coordinators see all their
  settings at once instead of hunting across tabs.

The second reads better for the multi-role case but breaks the "tab = role" model the console
currently uses. Pick one and say why.

### States to cover

Loading, saving, saved, validation error, and save failure. Also the case that matters most here:
**an admin who holds no coordinator role at all.** Admins can see the console but are not
coordinators, and they only receive notifications as a last-resort fallback when a role has no holder
(see below). Whatever you design must not imply they're subscribed to something they aren't — that
confusion is the whole reason this feature was requested.

---

---

## Piece 2 — Dropping a confirmed shift

**Surface:** the user's own dashboard, `frontend/src/components/user/Dashboard.jsx`, section
**My {Role} Schedule** (line ~314).

**The good news: the card already exists.** Each commitment renders as a `dash-commit-card` with a
status chip (`Needs Confirmation` / `Awaiting Coordinator` / **`Confirmed · Set`** / `Declined`) and an
action-button row that already varies by state — pending rows get Confirm/Decline, a confirmed
scorekeeper row gets "Score Game →". A **Drop** action on the confirmed state fits the existing
pattern. This is a small piece, not a new screen.

**Product decisions already made — don't re-open them:**

- **No reason field.** Dropping is a fact, not a negotiation.
- **No time cutoff.** Someone can drop at any point, right up to game time. Repeat last-minute
  droppers are handled by the coordinator not scheduling them again, which is a people problem rather
  than a software one.

**What to design:**

- The **Drop** action on confirmed cards, and its confirm step. It is destructive and it emails the
  coordinator, so it belongs in the same family as the coordinator console's Remove — but this is a
  member acting on their own commitment, not a coordinator acting on someone else's, so it should not
  feel as heavy.
- The confirm should be honest about consequence. If the shift is **already published**, they are
  currently on the public schedule and someone has to replace them; if it is confirmed but not yet
  published, nothing public changes. The published flag is available per row.
- What the card becomes afterwards. It should not silently vanish with no acknowledgement that the
  coordinator has been told.

### The goalie gap — fix this as part of the piece

**Goalies cannot see their confirmed assignments at all today.** `myCommitments` is built as:

```
GOALIE  → pending only (PROPOSED)
REF/SK  → pending + open slots where state === 'MINE'
```

The `MINE` slots are what carry confirmed shifts, and open slots only exist for `REF` and
`SCOREKEEPER` — goalies are assigned by a coordinator and never self-sign. So the moment a goalie
confirms, the shift **disappears from their dashboard**. They have no view of what they're committed
to and, without this fix, nowhere to drop from either.

The backend is being changed to serve every role's commitments from one source, so design the section
as though goalies have always had commitments in it. Their cards differ in one way worth noting: a
goalie slot carries a **team** (they're in a specific net), where a ref or scorekeeper works the game.

## Backend notes (not design work)

- New table, per user per role: `user_id`, `role`, `notify_on_decline` (default true),
  `notify_on_confirm` (default false), `email_override` (nullable). Needs a numbered migration in
  `database/migrations/`, following the existing `NNN_description.sql` convention.
- **Migrations are applied by hand in production.** They do not auto-run on the live database.
- Recipient resolution lives in `ShiftConfirmationService.coordinatorsFor()`. It currently returns the
  coordinator who proposed the shift, else everyone holding the matching coordinator role, else — as
  of this change — admins, so a decline can never be sent to nobody. Preferences filter that list;
  the admin fallback should stay unconditional, because it exists to prevent silence.
- **Nobody turning everything off must not mean nobody is told.** Decide whether the last remaining
  recipient can opt out, or whether it degrades to the admin fallback. Worth a deliberate answer.
- The confirm notification does not exist yet and needs building alongside this.

**Piece 2 backend (in progress alongside this handoff):**

- A self-service drop reusing the coordinator's existing unpublish path, so dropping clears the game's
  staff column and the person comes off the public schedule, game preview, score entry and their own
  dashboard in one write — the same guarantee the coordinator's Remove gives.
- The official is **not** sent a cancellation email when they drop themselves; they just did it. The
  coordinator gets the notice instead.
- One endpoint returning every role's own commitments (`PROPOSED`, `SIGNED_UP`, `CONFIRMED`), which is
  what closes the goalie gap and gives the card a single data source.
- Separately: the confirm-link token is currently **not cleared when it's used**, so for its 7-day
  life the original email can be reopened and used to decline a shift that was already confirmed and
  published — flipping the row without unpublishing anyone. Being fixed; it also means the emailed
  link stops being an accidental second drop path once this piece ships.

## Out of scope

- The shipped console work in `COORDINATOR_CONSOLE_HANDOFF.md` and `COORDINATOR_RINK_VIEW_HANDOFF.md`.
- Notification preferences for non-coordinators (goalies, refs, scorekeepers receiving their own
  shift mail). Same idea, different audience, worth its own pass.
- SMS or push. Email only.

## Deliverable

Markup/JSX structure and styles, every state listed above, and an explicit note on which existing
classes you reuse versus introduce.

**Note the two surfaces use different vocabularies.** Piece 1 lives in the Coordinator Console
(`cc-` prefix, `Coordinator.css`). Piece 2 lives on the user dashboard (`dash-` prefix,
`Dashboard.css`) — reuse `dash-commit-card`, `dash-commit-status`, `dash-action-btns`, `dash-btn`
rather than importing console styling into it.

For piece 1, show the multi-role case — someone holding two coordinator roles with different settings
on each — since that's what decides the layout. For piece 2, show a goalie card alongside a referee
one, since goalies carry a team and have never appeared in that list before.
