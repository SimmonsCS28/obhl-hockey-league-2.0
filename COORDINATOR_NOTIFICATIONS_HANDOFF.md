# Handoff: Coordinator notification preferences

**Audience:** Claude Design. One new settings surface in the Coordinator Console, letting each
coordinator choose **which notifications they receive** and **where those emails go**. The backend is
straightforward and described at the end; what's needed is the interface.

Built ahead of need, deliberately. Today the league has exactly one coordinator (referee), and the
goalie and scorekeeper roles are unfilled and managed from the admin console. This exists so the
controls are already in place when those roles are filled, rather than being retrofitted onto people
who are already receiving mail they didn't ask for.

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

## What to design

### The three notification types

| Type | Exists today? | Sensible default | Why |
|---|---|---|---|
| **Someone declines a shift** | Yes, shipped | **On** | The one message that needs action — a slot now has nobody in it. |
| **Someone confirms a shift** | **No — new** | **Off** | Happy path. A 5-game week means ~10 of these per role; on by default would train people to filter the sender and lose the declines with it. |
| **A confirm link expires unanswered** | **No — new** | **Off** | Optional third. Include only if it reads as useful rather than as a third switch nobody touches — your call, and "cut it" is a fine answer. |

The defaults matter more than the switches. Design should make it obvious that declines are the
important one and confirmations are opt-in noise, rather than presenting three equal toggles.

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

## Out of scope

- The shipped console work in `COORDINATOR_CONSOLE_HANDOFF.md` and `COORDINATOR_RINK_VIEW_HANDOFF.md`.
- Notification preferences for non-coordinators (goalies, refs, scorekeepers receiving their own
  shift mail). Same idea, different audience, worth its own pass.
- SMS or push. Email only.

## Deliverable

Markup/JSX structure and styles using existing tokens and the `cc-` prefix, every state listed above,
and an explicit note on which existing classes you reuse versus introduce. Show the multi-role case —
someone holding two coordinator roles with different settings on each — since that's the case that
decides the layout.
