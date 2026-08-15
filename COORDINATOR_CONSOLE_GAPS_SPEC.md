# Spec: Coordinator Console gaps (goalie / ref / scorekeeper)

Driven by questions from the ref coordinator about the new console. Seven gaps, grouped into four
shippable phases. **No database migration is required for any of this** — every column needed
(`published`, `responded_at`, `decline_reason`, `assigned_by`) already exists on `shift_assignments`.

Files referenced throughout:

| Area | File |
|---|---|
| Coordinator API | `backend/api-gateway/.../controller/CoordinatorController.java` |
| Coordinator logic | `backend/api-gateway/.../service/CoordinatorService.java` |
| Confirm/decline | `backend/api-gateway/.../service/ShiftConfirmationService.java` |
| Goalie proposer | `backend/api-gateway/.../service/GoalieProposerService.java` |
| Emails | `backend/api-gateway/.../service/EmailService.java` |
| DTOs | `backend/api-gateway/.../dto/CoordinatorDto.java` |
| Board UI | `frontend/src/components/coordinator/CoordinatorBoard.jsx` |
| API client | `frontend/src/services/api.js` |

---

## Already shipped — what this spec builds on (main @ `7d1db97`)

Verified against main on 2026-08-13. Recent goalie-email work landed machinery that Phase 3 should
**reuse rather than reinvent**:

- **`weekScheduleBlockHtml(seasonId, week, recipientGameId, recipientSlot)`** (`CoordinatorService.java:581`)
  — server-rendered, email-safe HTML card of the week's matchups and who's in each net, with the
  recipient's own game highlighted. Currently goalie-only.
- **Email-template constants** `SCHED_WRAPPER` / `SCHED_ROW` / `SCHED_ROW_RECIPIENT` (lines 526–572),
  built from the Claude Design template in `GOALIE_WEEK_SCHEDULE_EMAIL_HANDOFF.md`.
- **`TEAM_HEX`** (line 518) — the frontend's team-color name→hex map mirrored server-side, plus
  `teamSwatchHtml`, `goalieDivHtml`, `teamHex`, and `htmlEscape` helpers (lines 649–692).
- **Both goalie emails now take a `weekScheduleHtml` parameter**, so `sendShiftProposalEmail` and
  `sendGoalieFinalAssignmentEmail` are 7-arg and 6-arg respectively.

**Overlap this creates with Gap 2.** The new email work is explicitly goalie-only — the commit message
states *"ref/scorekeeper proposal emails, which share `sendShiftProposalEmail`, are unchanged."* Every
gap below still stands as written. But it raises a scope question worth deciding before Phase 3:

> ~~Should referees get a **week schedule block** in their emails too?~~ **Decided 2026-08-13: yes.**
> Refs (and scorekeepers) get a week-schedule block. The structural difference is that goalies are
> team-attached (home net / away net) while refs work the whole game, so the row is a different shape,
> not a relabel. Designed in `COORDINATOR_CONSOLE_HANDOFF.md` §7; `weekScheduleBlockHtml` will need a
> role parameter and a ref/scorekeeper row template alongside `SCHED_ROW`.

Nothing else in the coordinator flow changed: `propose()` (line 76), `withdraw()` (line 122), and
`publishWeek()` (line 321) are untouched, so Gaps 1, 3, 4, 5, 6, and 7 are unaffected.

---

## Design reconciliation (returned 2026-08-13)

Claude Design returned all seven pieces (`design_handoff_coordinator_console_gaps/`): two clickable
prototypes, a states sheet, and four email templates. **Three things in that return conflict with this
codebase and must be translated, not implemented literally.**

### R1. Status vocabulary is inverted — highest risk

The design's copy and state tables use `PENDING` and `PROPOSED` with **the opposite meanings** to this
codebase. `PENDING` is not a persisted status at all here; it exists only as a display bucket in
`AdminAssignments.jsx:68`.

| Design's word | Actual status constant | Meaning |
|---|---|---|
| `PENDING` | `ShiftAssignment.STATUS_PROPOSED` | emailed, awaiting their reply |
| `PROPOSED` | `ShiftAssignment.STATUS_AUTO_PROPOSED` | filled, **no email sent** (draft) |

`PROPOSED` exists in both vocabularies meaning opposite things, so a literal implementation will
render "Draft — nobody has been emailed" on rows whose email already went out. **Translate every
status reference in the design docs through this table.** The design's user-facing *copy* is correct
as written; only the status keys move.

### R2. Email failure must not roll back a publish

Two design error states imply transactional rollback — piece 1's *"He is not published"* and piece 2's
*"the whole send was rolled back."* That contradicts this codebase, where publish persists and every
email is best-effort inside a try/catch, specifically so a Resend outage cannot roll back a publish.

**Resolution: publish stays authoritative; the copy changes.** Gating publish on mail delivery would
let an email-provider outage block the schedule from going live. Error copy becomes *"Published, but
the cancellation/assignment email didn't send — retry the email"*, and any Retry re-sends **mail
only**, never re-publishes. This applies to piece 1's action-bar error, piece 2's panel error, and
piece 5's half-state error (which the design already gets right: *"was removed from the game, but the
cancellation email didn't send"*).

### R3. Piece 4 needs DTO fields nobody specced

The slot-meta line needs the **propose timestamp** ("Emailed 6 days ago") and **`tokenExpiresAt`**
(the `Link Expired` chip). Both are on the entity; neither is on `AssignmentView`. `respondedAt` alone
is null on exactly the rows piece 4 is about. See Gap 6 for the full field list.

### Accepted as designed

- **Piece 1 moves "⇄ Swap Goalies" out of the game-card header** into a new `.cc-card-actions` strip
  below the slot rows. This edits *shipped goalie UI*, not just new surface — expect goalie-tab
  regressions if the conditional render is dropped.
- **Piece 5 keeps remove and reassign as two actions**, with "Reassign Instead" inside the confirm.
  Resolves the open question in the handoff.
- **Piece 7 reuses `SCHED_WRAPPER` unchanged**, adding only `SCHED_ROW_REF` / `SCHED_ROW_SK` and their
  recipient variants. `TEAM_HEX` and the swatch/escape helpers are untouched.
- **Publish state is per-slot** (`gameId:role:slotIndex`), matching the per-row `published` column.

### Added by the design, not previously specced

- **"Discard Drafts"** (piece 3) — bulk-delete every `AUTO_PROPOSED` row for a role + week. Needs a new
  endpoint; only required if draft mode ships.

### Draft mode (piece 3) — **CUT 2026-08-14, not built**

Decision: **dropped before implementation.** Judged to add more complexity than it removes — a mode
that silently changes what "Assign" does is a second thing to remember, and forgetting it is on is
its own failure. Gap 4 below is retained as a record of the reasoning, not as work to do.

Nothing depends on it. The `AUTO_PROPOSED` status stays, because the goalie auto-proposer uses it
independently, and the per-slot **Send Confirmation** button already renders for it. If ref staging is
ever revisited, that button is the seam to build from.

---

## Phase 1 — Correctness (ship first, independently)

### Gap 1: Reassign / Clear leaves the old person on the published game

**Problem.** `propose()` sets `published = false` but never touches the game's staff column;
`withdraw()` deletes the row and never touches it either (the comment at `CoordinatorService.java:120`
acknowledges this). Consequences:

- Reassigning a published slot → the **old** ref still appears on the public schedule, live score
  entry, and game management until the replacement confirms *and* the week is re-published.
- Clearing a published slot → the old ref stays on the game **forever**. Nothing will ever clear it.

**Fix.** Extract the reconcile logic that `swapGoalieSlots` already uses
(`reconcileGoalieColumns`, `CoordinatorService.java:198`) into a role-agnostic helper and call it
from both paths. Clearing is done by PATCHing the sentinel `-1L`, which game-service maps to `null`
(`GameService.java:147-155`).

```java
/** Clear a game's staff column for a slot that is no longer published to that person. */
private void clearSlotColumn(Long gameId, String role, int slot) {
    gameProxyService.updateGameStaff(gameId, Map.of(slotColumn(role, slot), -1L));
}
```

In `propose()`, after loading the existing row and **before** overwriting it:

```java
Optional<ShiftAssignment> existingOpt = assignmentRepository.findByGameIdAndRoleAndSlot(...);
boolean wasPublished = existingOpt.map(x -> Boolean.TRUE.equals(x.getPublished())).orElse(false);
Long previousUserId = existingOpt.map(ShiftAssignment::getUserId).orElse(null);
boolean occupantChanged = previousUserId != null && !previousUserId.equals(req.getUserId());

// ... existing upsert ...

if (wasPublished && occupantChanged) {
    clearSlotColumn(req.getGameId(), role, slot);
    sendShiftCancelledEmail(previousUserId, role, game);   // see Gap 2
}
```

In `withdraw()`, load before deleting:

```java
@Transactional
public void withdraw(Long assignmentId) {
    ShiftAssignment a = assignmentRepository.findById(assignmentId).orElse(null);
    if (a == null) return;
    if (Boolean.TRUE.equals(a.getPublished())) {
        clearSlotColumn(a.getGameId(), a.getRole(), a.getSlot());
        sendShiftCancelledEmail(a.getUserId(), a.getRole(), gameProxyService.getGameById(a.getGameId()));
    }
    assignmentRepository.deleteById(assignmentId);
}
```

**Design decision — clear immediately vs. hold the old name until the replacement confirms.**
Recommend **clear immediately**. A blank ref slot on the public schedule for a day is a non-event;
a *wrong* name is how someone shows up to a game they aren't working, or doesn't show up to one they
are. If you'd rather hold the name, say so and this becomes a one-line change — but it should be a
deliberate call, not the current accidental behavior.

**Conditions that must NOT clear:**
- Re-proposing the **same** user to the same slot (a resend) — occupant unchanged.
- A slot that was never published (`published != true`) — nothing to clear.
- `adminDirectAssign` — it already writes the column itself in the same step.

**Testing.** Publish a week, reassign one slot, then load `/schedule` and the game-management page
for that game — the slot must read empty, not the old name. Repeat with **Clear**.

### Gap 8: No way to remove a confirmed, published person from a slot

**Problem.** A ref or scorekeeper cancels the day of a game. The coordinator needs to pull them out of
that slot — possibly before a replacement is lined up. **There is no action that does this.**

What actually exists on a `CONFIRMED` row is **Reassign** only (`CoordinatorBoard.jsx:657`). So:

- Reassigning a published slot *does* exist for all three roles — it just doesn't clear the game
  column, which is Gap 1. The replacement is emailed; the original person silently stays in the
  public UI.
- **Clear/Remove is offered on `PROPOSED` rows but not on `CONFIRMED` ones.** There is no way to empty
  a confirmed slot at all. If she has no replacement yet, she has no move — her only option is to
  reassign to *someone*, which means picking a name she doesn't have.

**Required semantics — unpublish exactly one slot:**

1. Clear that game's staff column (`-1L` sentinel → `null`).
2. Reset the slot to `OPEN` in the console.
3. Email the removed person a cancellation (Gap 2).
4. Touch **nothing else** — no other slot, game, or week is republished, and nobody else is emailed.

**"Remove them from everywhere in the public UI" is one write.** Every public surface reads the
game's staff columns, not `shift_assignments`, so clearing the column clears all of them at once:

| Surface | Reads |
|---|---|
| Public game preview / recap | `GamePreview.jsx:76-78`, `GameRecap.jsx:93-95` |
| Referee schedule page | `RefereeSchedulePage.jsx:79` |
| Live score entry / scorekeeper view | `ScorekeeperContent.jsx:107` |
| Admin Assignments + coverage counters | `AdminOverview.jsx:59`, `RefereeSchedule.jsx:129` |
| **The person's own dashboard** | `/shifts/my-shifts` → `RefereeShiftService.getMyAssignments` → game columns |

That last one matters: `getMyAssignments` derives from the game columns, so clearing the column also
removes the game from the ex-ref's own "my shifts" list. No separate cleanup needed.

**Backend work: none beyond Gap 1.** With Gap 1's fix, `withdraw()` already does all four steps —
clears the column when published, sends the cancellation, deletes the row. This gap is **purely the
missing UI affordance.**

**Frontend.** In `SlotRow`, add a Remove action to the `CONFIRMED` branch (and to `SIGNED_UP`, which
has the same problem once confirmed):

```js
} else if (status === 'CONFIRMED') {
    actions.push(reassignAction);
    actions.push({ label: 'Remove', /* destructive styling */ onClick: onClear });
}
```

Removing a *published* person is destructive and sends mail, so it needs a confirmation step — unlike
clearing a `PROPOSED` row, which today fires immediately. See the Design handoff.

**Interaction with Gap 3.** This is what makes per-matchup publish pay off: remove the canceller →
assign a replacement → they confirm → **Publish Matchup** writes just that game. Without Gap 3 she'd
be re-running a week-wide publish for one slot, which is exactly the thing she was nervous about.

### Gap 6: Decline reason is captured but never shown

`declineReason` is already populated by both response paths (email token and in-app) and already
travels on `AssignmentView` — it is simply never rendered. Today the coordinator sees "Declined" and
nothing else.

**Backend.** Add three fields to `CoordinatorDto.AssignmentView` and set them in both
`CoordinatorService.toView` and `ShiftConfirmationService.toView`. All three columns already exist on
the entity — no migration.

| Field | Drives |
|---|---|
| `respondedAt` | "Declined 2 days ago", "confirmed 2 days ago" |
| `createdAt` | "Emailed 6 days ago · no reply yet" — the propose timestamp (per R3) |
| `tokenExpiresAt` | The `Link Expired` chip and "confirm link expires in N days" (per R3) |

`createdAt` is the row's creation stamp, and `propose()` upserts the same row on reassign — so a
reassigned slot keeps its original `createdAt` and would under-report its age. Set `createdAt`
explicitly on re-propose so "Emailed N days ago" measures **the current occupant's** proposal, not the
slot's first-ever one.

**Frontend.** In `SlotRow` (`CoordinatorBoard.jsx:630`), below the status chip row:

```jsx
{status === 'DECLINED' && (
    <div className="cc-slot-decline">
        <span className="cc-slot-decline-label">Declined{assignment?.respondedAt ? ` · ${relativeTime(assignment.respondedAt)}` : ''}</span>
        {assignment?.declineReason
            ? <span className="cc-slot-decline-reason">“{assignment.declineReason}”</span>
            : <span className="cc-slot-decline-reason is-empty">No reason given</span>}
    </div>
)}
```

Also show `respondedAt` as a muted "confirmed 2 days ago" on `CONFIRMED` rows.

> ⚠️ **Classname collisions.** This codebase has no CSS scoping and we've been bitten three times.
> `grep -rn "cc-slot-decline" frontend/src` before adding these, and keep the `cc-` prefix.

---

## Phase 2 — Per-matchup publish + "who gets emailed" preview

### Gap 3: Publish is week-scoped only

This is the coordinator's actual ask. Two parts: make publish targetable, and make its blast radius
visible *before* it fires.

**Important context that should also be surfaced in the UI:** `publishWeek` is already incremental.
It only writes rows that are `CONFIRMED` **and** `published = false` (`CoordinatorService.java:345`),
so re-publishing a week never re-emails anyone who was already published. The current behavior is
correct; it's just invisible, which is why it reads as risky.

**Backend — extend the existing endpoint rather than adding a new one:**

```java
@PostMapping("/publish")
public ResponseEntity<?> publish(@RequestParam Long seasonId,
                                 @RequestParam String role,
                                 @RequestParam(required = false) Integer week,
                                 @RequestParam(required = false) Long gameId,
                                 @RequestParam(required = false, defaultValue = "false") boolean dryRun,
                                 Authentication auth) { ... }
```

`publishWeek(seasonId, role, week, gameId, dryRun)`:
- Add `if (gameId != null && !gameId.equals(a.getGameId())) continue;` alongside the existing week filter.
- When `dryRun` is true, walk the exact same loop but skip `updateGameStaff`, the `published` write,
  and the email — return only the projection.

**Extend `PublishResult`** so the UI can name names:

```java
public static class PublishResult {
    private int publishedCount;
    private List<String> unconfirmedSlots;
    private List<String> notified;        // NEW: "Dave Kruger — Thu Aug 7, 7:15 PM (Ref 1)"
    private int alreadyPublishedCount;    // NEW: skipped, nobody re-emailed
}
```

`alreadyPublishedCount` is the number that answers her question directly — it's the count of people
who will *not* hear from this action.

**Frontend:**

1. `api.publishShiftWeek(seasonId, role, week, gameId, dryRun)` — append `gameId` / `dryRun` when present.
2. **Per-matchup button** in `GameCard`'s header (`CoordinatorBoard.jsx:564`), next to the fill badge
   and beside the existing Swap Goalies button. Visible only when the card has ≥1 slot that is
   `CONFIRMED && !published`; label it with the count, e.g. `Publish Matchup · 1 to notify`.
   Disabled with a tooltip otherwise ("Nothing new to publish — both slots are already live").
3. **Preview on the week button.** Clicking `Publish Week N` fires the dry run first and shows a small
   confirm panel:

   > Publishing Week 8 will email **2 people**: Dave Kruger (Thu Aug 7), Mike Toth (Sat Aug 9).
   > 6 already-published assignments will not be re-sent.
   > 1 slot is still awaiting a response and will not publish: Ref 2, Thu Aug 7.
   >
   > [ Publish and send ] [ Cancel ]

   Reuse the existing `cc-publish-result` block styling for the panel.
4. Apply to all three roles — the board is already role-generic, so this lands for goalie, ref, and
   scorekeeper at once.

---

## Phase 3 — Ref & scorekeeper parity with the goalie flow

### Gap 2: Refs and scorekeepers get no final-assignment or cancellation email

`publishWeek` gates the final email on `if ("GOALIE".equals(r))` (`CoordinatorService.java:351`).
A referee's *only* email today is the initial proposal with the confirm link. Publishing a ref week
is completely silent — they're written onto the game and never told it's final.

**Add two `EmailService` methods** alongside the existing ones. Match the current shape of the goalie
methods — both now carry a trailing `weekScheduleHtml` — so a ref week-schedule block can be dropped in
later without another signature change. Pass `null` until that's designed.

```java
/** Final assignment for a non-goalie role (no team — refs/scorekeepers work the game, not a side). */
public void sendStaffFinalAssignmentEmail(String toEmail, String name, String roleLabel,
        String gameDescription, String gamePreviewLink, String weekScheduleHtml)

/** You've been taken off a game that was previously published to you. */
public void sendShiftCancelledEmail(String toEmail, String name, String roleLabel,
        String gameDescription)
```

The cancellation email deliberately takes no schedule block — it's a short "you're off this game"
note, and attaching a full week card to it would bury the one line that matters.

Subjects: `OBHL referee assignment — you're set for Thu Aug 7` and
`OBHL referee shift — you're no longer scheduled for Thu Aug 7`.

In `publishWeek`, replace the goalie-only branch:

```java
if ("GOALIE".equals(r)) {
    sendGoalieFinalAssignment(a, game);   // keeps the team name + slot→team mapping
} else {
    sendStaffFinalAssignment(a, game, r);
}
```

Both remain best-effort (wrapped in try/catch) so a Resend outage can't roll back a publish, matching
the existing pattern.

The cancellation email is called from the two Gap 1 sites. It is what makes reassignment safe: the
outgoing person is told, the incoming person gets the standard proposal email, and nobody else hears
anything.

### ~~Gap 4: Refs have no staging step — assigning emails instantly~~ (CUT — see above)

Goalies get a three-step flow: auto-propose (`AUTO_PROPOSED`, filled, silent) → **Send Confirmations**
(`PROPOSED`, emails go out) → Publish. Refs go straight to `PROPOSED` + email on the first click, so
the coordinator can't lay out a draft week and review it before anyone hears about it. This is
probably the biggest day-to-day friction for her.

The `AUTO_PROPOSED` status already exists and the per-slot **Send Confirmation** button already
renders for it (`CoordinatorBoard.jsx:648`) for any role. Only two things are missing: a way to
*reach* that status without the goalie optimizer, and a bulk send.

**Backend:**

1. Add `private Boolean notify;` to `CoordinatorDto.ProposeRequest`. Null/true = today's behavior
   (immediate email — back-compatible with every existing caller including `sendConfirmations`).
   False = save as `STATUS_AUTO_PROPOSED`, skip the token mint and skip `notify(...)`.
2. Generalize the send-confirmations endpoint. `GoalieProposerService.sendConfirmations`
   (line 437) is already role-agnostic in substance — it just hardcodes `"GOALIE"`. Move it to
   `CoordinatorService.sendConfirmations(seasonId, role, week, coordinatorUserId)` and expose
   `POST /coordinator/send-confirmations?seasonId&role&week`. Keep `/coordinator/goalie/send-confirmations`
   as a thin delegate so the goalie bar keeps working unchanged.

**Frontend:**

- A **Draft mode** toggle in the board header for `REF` / `SCOREKEEPER`: *"Draft mode — assign without
  emailing."* When on, `handleAssign` passes `notify: false`. Persist per role in `localStorage`.
- A role-generic action bar above the games when any `AUTO_PROPOSED` rows exist for the current week:
  *"3 draft assignments not yet sent"* + `Send All Confirmations`. `GoalieProposerBar` is a reasonable
  visual model but is goalie-specific (auto-propose reasoning, sitting list) — build a smaller
  `cc-draft-bar` rather than overloading it.

> Note: `GoalieProposerBar.css` has outstanding `!important` cleanup owed once the button-scoping fix
> reaches main. Don't add to it — a new component is cleaner anyway.

### Gap 5: Ref availability is collected but never shown to the coordinator

Refs mark unavailable dates in `RefAvailability.jsx` and the endpoint exists
(`GET /coordinator/availability?role=REF` → `[{userId, date}]`). `api.getCoordinatorAvailability` is
defined at `api.js:528` and **called from nowhere**. The board only ever loads the goalie pool. So
she is assigning refs blind to data they were asked to enter.

**Frontend only — no backend change.**

1. In `CoordinatorBoard.load()`, for `REF`/`SCOREKEEPER` fetch `api.getCoordinatorAvailability(role)`
   into a `staffUnavailable` state, keyed as `Set<"userId|YYYY-MM-DD">`.
2. Derive each game's league-local date with the existing `toChicago(game.gameDate)` helper and format
   as `YYYY-MM-DD`. `RefAvailability.jsx` derives its dates from game days using the same local-date
   logic, so the two line up — verify this on a late-evening game that crosses UTC midnight, which is
   exactly where a mismatch would show.
3. In `SlotRow`'s `candidates` map, extend the existing `unavailable` computation to cover non-goalie
   roles, and set the sub-label to `Unavailable this date` in muted text. Unavailable candidates get
   the same disabled treatment goalies already have.

Mirror the goalie rule deliberately: only an **explicit** unavailable mark disables someone. A ref who
simply hasn't filled anything in stays selectable with `Availability unknown` — people routinely just
forget, and hard-blocking them would make the console less useful than the paper it replaced.

---

## Phase 4 — Coordinator notifications

### Gap 7: Nothing tells the coordinator that someone accepted or declined

`applyResponse` (`ShiftConfirmationService.java:88`) writes the status and sends nothing. She has to
open the console and look. A decline on a Thursday game discovered on Friday is the failure mode.

**Recommend: email on decline only.** Confirms are the happy path and would train her to ignore the
sender. Confirms are covered by the in-app counter below.

```java
private void notifyCoordinatorOfDecline(ShiftAssignment a) { ... }
```

Recipient resolution, in order:
1. `a.getAssignedBy()` — the coordinator who proposed it. Correct in the normal case.
2. Fall back to all users holding the role-matching coordinator role (`REF_COORDINATOR` etc.) when
   `assignedBy` is null or that user no longer holds the role.

> Role lookups must check **both** `roles[]` and the deprecated single `role` column — that split is
> still live in this codebase.

Body: who declined, which game and slot, the reason if given, and a deep link back to the console.
Best-effort try/catch — a mail failure must never block the ref's decline from being recorded.

**In-app counter.** `CoordinatorDashboard`'s tab badge counts only `SIGNED_UP`
(`CoordinatorDashboard.jsx:38`). Change it to a "needs attention" count:
`SIGNED_UP + DECLINED-and-not-yet-reassigned`, so a decline lights up the Referee tab. Keep the
existing amber badge styling.

---

## Optional follow-up (not specced in detail)

**Non-responder reminders.** Confirm tokens expire after 7 days (`TOKEN_TTL_DAYS`), and an expired
link just tells the ref to contact the coordinator — with no resend button. Today the only way to
re-send is Reassign-to-the-same-person, which works (it mints a fresh token) but is unobvious. Two
increments, in order of value:

1. A per-slot **Resend** action on `PROPOSED` rows older than N days — trivial, it's `propose()` with
   the same userId once Gap 1's "occupant unchanged → don't clear" guard is in place.
2. A scheduled nudge for slots still `PROPOSED` 72 hours before game time. Needs a scheduler; there
   isn't one in api-gateway yet, so this is a real addition, not a tweak.

---

## Suggested sequencing

| Phase | Contents | Why this order |
|---|---|---|
| 1 | Gaps 1, 8, 6 | Correctness bug, the last-minute-cancellation hole it unblocks, and a one-line UI win. No new endpoints, safe to ship alone. Gap 8 is frontend-only once Gap 1 lands. |
| 2 | Gap 3 | The actual request. Depends on nothing in Phase 1, but Gap 1 should land first so per-matchup publish isn't built on top of stale-column behavior. |
| 3 | Gaps 2, 4, 5 | Brings ref/scorekeeper to goalie parity. Gap 2's cancellation email is called by Phase 1, so stub it there and fill it in here — or pull Gap 2 forward into Phase 1. |
| 4 | Gap 7 | Highest new-surface (email templates, recipient resolution), lowest urgency. |

## Testing notes

> ⚠️ **The dev stack has a live Resend key.** Every path in this spec sends real mail to real league
> members. Use dedicated test accounts with addresses you control, or unset `RESEND_API_KEY` for runs
> where the email content isn't what's under test. Do not reset a real member's password to
> impersonate them.

- The dev-only **Simulate: confirms / declines** buttons (`CoordinatorBoard.jsx:662`) currently render
  only for `role === 'GOALIE'`. Drop the role check so ref and scorekeeper flows are testable locally
  without sending mail — it's already coordinator-authorized server-side and `import.meta.env.DEV`
  gated in the UI.
- Publish paths need a game-service round trip; `updateGameStaff` PATCHes game-service directly, so
  that service must be up. Reuse the shared `:8000` backend rather than spinning up an empty-DB stack.
- Seed at least one week with a mix of all five statuses (`OPEN`, `SIGNED_UP`, `AUTO_PROPOSED`,
  `PROPOSED`, `CONFIRMED`, `DECLINED`) — the dry-run projection and the `alreadyPublishedCount` math
  are the parts most likely to be subtly wrong.
