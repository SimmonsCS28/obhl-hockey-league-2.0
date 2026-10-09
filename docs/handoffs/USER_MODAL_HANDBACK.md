# Handback: User Modal (Add User / Edit User) — full functional surface

## Purpose
One modal component (`frontend/src/components/UserModal.jsx`, styles in
`UserManagement.css` + `PlayerManagement.css`) handles **both** creating a new user
and editing an existing one. It also has a second, related job baked in: linking a
user account to a **Player profile**, either at creation time or after the fact. This
doc gives Claude Design the complete field list and state map for both modes so the
next design pass covers the real surface, not just the base fields.

**Context on current state:** this modal already has *some* dark-theme styling in the
build (from an earlier restyle pass, `232ab07`, plus a later role-chip-contrast fix
that came out of v4 reconciliation, `fb7b282`). But the full functional surface below
— both modes, both player-linking flows, every conditional section — has not been
confirmed as fully specified in any Claude Design mockup. Treat this as a from-scratch
design brief, not a "just check my existing styling" ask.

Opened from: `frontend/src/components/UserManagement.jsx`, "Manage Users" subtab →
**+ Add User** button (create mode) or the **Edit** action on any row (edit mode).

## Shared shell
- Standard modal overlay + centered card (dark scrim, card ~540px max-width, scrollable
  if content exceeds viewport height).
- Header: title + close (×). Title is **"Create New User"** (create) or
  **"Edit User: {username}"** (edit).
- Footer action row: **Cancel** (ghost) + a primary button whose label depends on mode
  and whether the player-link flow is active (see below).
- A form-level error banner can appear above the fields (e.g. duplicate username,
  password-policy failure, "Please select at least one role").

## Fields common to both modes
1. **Username*** — text.
2. **First Name** / **Last Name** — text, side by side.
3. **Email*** — text.
4. **Roles* (select at least one)** — a **checkbox-card grid**, NOT a dropdown. Each
   role renders as its own card: checkbox + role name (bold) + one-line description.
   Grid wraps responsively (roughly 2–3 cards per row on desktop, 1 per row on
   narrow/mobile). **Live role list (9 today, can grow — design for an arbitrary
   count, not a fixed 6):**
   | Role | Description |
   |---|---|
   | ADMIN | Full system access |
   | GM | Team management |
   | REF | Referee scheduling |
   | SCOREKEEPER | Game scoring |
   | GOALIE | Goalie scheduling |
   | GOALIE_COORDINATOR | Assigns & confirms goalie shifts |
   | REF_COORDINATOR | Assigns & confirms referee shifts |
   | SCOREKEEPER_COORDINATOR | Assigns & confirms scorekeeper shifts |
   | USER | Basic access |

   (This list is loaded live from the API — the table above is the current fallback/
   actual set, but the design shouldn't hardcode "exactly 9" as a layout assumption.)
5. **Team ID (optional, for GMs)** — plain number input today (a raw numeric team ID,
   not a team picker — flagging as-is; open to Design proposing a real team-name
   picker here instead, since typing a bare ID is not great UX).

## Password — differs by mode
- **Create mode:** **Password\*** is required up front (plain text field + strength
  hint: "Min 8 characters, 1 uppercase, 1 special character, no spaces"), plus a
  separate **"Force password change on first login"** checkbox (defaults checked).
- **Edit mode:** password starts collapsed behind a **"Reset Password"** button.
  Clicking it reveals **New Password** + the same strength hint + a **"Cancel Reset"**
  button that collapses it back and clears the field. No force-change checkbox in
  edit mode (existing users aren't force-flagged from this screen).

## The Player-linking sub-form (the part most likely to be missed)
Both modes can attach the user to a **Player** record — same set of fields, but two
different entry points and slightly different framing:

### Fields (identical in both entry points)
1. **Season\*** (select) + **Skill Rating (1–10)** (number) — side by side.
2. **First Name\*** + **Last Name\*** — side by side. (Player names are entered
   separately from the user's own First/Last Name above — they aren't auto-copied.)
3. **Team** (select, filtered to the chosen season; "N/A (Free Agent)" is a valid
   choice) + **Jersey Number** (0–99) — side by side. The Team field has an inline
   **"Active teams only"** checkbox filter next to its label.
4. **Position\*** (select: Forward / Defense / Goalie) + **Shoots** (select: Left /
   Right) — side by side.
5. **Birth Date** (date picker).
6. **Hometown** (text).
7. **Veteran** (checkbox) + **Active** (checkbox) — side by side.

The player's **email is not a separate field** — it's copied from the user's Email
field above.

### Entry point A — Create mode: "Also create as Player" checkbox
Below a divider, under the password/force-change fields: a plain checkbox labeled
**"Also create as Player"**. Checking it reveals the full field list above (under a
**"Player Details"** heading) inline, still within the same form/scroll. Unchecking
hides it again (values are retained in local state either way). Submitting creates
the user, then the linked player — if player creation fails, the just-created user is
rolled back (deleted) and an error is shown, so from a UX standpoint this should read
as "one atomic action," not two separable steps.

### Entry point B — Edit mode: "⚡ Create Player from this User" button
Only shown when: **the user being edited has no existing Player record matching
their email** (checked automatically on open — while that check is in flight, this
whole section simply doesn't render yet, no loading indicator today). If a match IS
found, this section never appears at all — editing an already-linked user never shows
it.

When shown: a divider, then a single call-to-action button —
**"⚡ Create Player from this User"**. Clicking it expands the same field list as
above under a **"Player Details"** heading, this time with an inline **×** close
button in that section's own header (collapses it back without leaving edit mode).
Submitting updates the user AND creates the player in the same save action.

### Save button label — depends on mode × player-link state
| Mode | Player link active? | Button label |
|---|---|---|
| Create | No | Create User |
| Create | Yes | Create User & Player |
| Edit | No | Save Changes |
| Edit | Yes | Save & Create Player |

## Validation surfaced to the user (for error-state design)
- At least one role must be selected.
- Password required on create; strength rule violations shown inline under the
  password field.
- When the player-link section is active: First Name, Last Name, and Season are
  required for the player; missing any shows a form-level error naming which.

## Design system to build within
Same as every other post-redesign screen: `frontend/src/styles/theme.css` tokens
(`--obi-bg-elevated` for the modal card, `--obi-card-border`, `--obi-accent`,
`--obi-error`, `--obi-font-display`/`--obi-font-body`). Existing card-section pattern
for the linked-player panel: soft `rgba(157,185,205,0.04)` fill, `rgba(157,185,205,
0.28)` border, 10px radius — reuse or intentionally redesign, but the visual
relationship "this is a form nested inside a form" should stay legible either way.

## Deliverable format
Same as prior handoffs — an `.dc.html` prototype covering both modes and both
player-link entry points (at minimum: create/default, create/player-expanded,
edit/default, edit/password-reset-open, edit/player-CTA-visible,
edit/player-expanded, plus the role-grid and an error state) with a short README,
dropped into a new `Website theme integration` folder in Downloads.
