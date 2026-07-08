# Handback: Account Settings page — fields, behavior & validation

## Purpose
The self-service **Account Settings** page (`frontend/src/pages/AccountSettings.jsx` +
`AccountSettings.css`, route **`/account`**, any authenticated user) lets a user edit
their own username, email, password, security question, and opt in/out of volunteer
staff roles. It is one of the last surfaces still on the **pre-redesign light theme**
(white card, `#2d3748` text, `#e2e8f0` borders — none of the `--obi-*` tokens). This
handback documents every field and all client + server behavior so the redesign
covers the real surface.

Rendered inside the **public site chrome** (PublicLayout header/footer), reached from
the user pill. It's a single scrolling card/form, not a modal.

## Sections & fields (in page order)
The form is organized into labeled sections separated by dividers:

1. **Username** — text input, pre-filled with current username, required (can't be
   blanked).
2. **Email** — email input, pre-filled, required.
3. **Password** — section hint: "Leave blank to keep your current password."
   - **New Password** — password input with a **Show/Hide toggle**, min 8 chars,
     `autoComplete="new-password"`. Hint below: "Minimum 8 characters".
   - **Confirm New Password** — password input + Show/Hide toggle. If it's non-empty
     and doesn't match New Password, an inline **"Passwords must match"** message
     shows in red under the field (live, before submit).
4. **Security Question** — section hint: "This is used to reset your password if you
   ever forget it."
   - **Security Question** — dropdown (`<select>`) of 8 preset questions (list below).
   - **Answer** — text input. Placeholder is **"Leave blank to keep your current
     answer"** when the user already has one set, otherwise "Enter your answer".
     Hint: "Not case-sensitive. Only fill this in if you want to set or change your
     security question/answer." (Answer is stored lowercased server-side, so casing
     never matters.)
5. **Volunteer Roles** — section hint: "Opt in to volunteer as a goalie, referee, or
   scorekeeper. Enabling a role unlocks the matching shift sign-up pages; disabling it
   removes that access." Three checkboxes, each with a label + sub-hint:
   - **Goalie** — "Sign up for goalie shifts"
   - **Referee** — "Sign up for referee shifts"
   - **Scorekeeper** — "Sign up for scorekeeping shifts"

   These map to the GOALIE / REF / SCOREKEEPER backend roles. Important framing: this
   section only manages the user's **self-service** roles — it never shows or touches
   ADMIN/GM/coordinator roles the user may also hold. Pre-checked to reflect roles the
   user currently has.
6. **Confirm Changes** — the gate for the whole form:
   - **Current Password** — password input + Show/Hide toggle, **required to save
     anything**. Hint: "Required to save any changes on this page." Below it, a
     **"Forgot your password?"** link that routes to `/forgot-password`.
7. **Actions** — **Save Changes** (primary; shows "Saving..." while in flight) and
   **Back to Home** (secondary, routes to `/`).

## States to design
- **Loading** — while the profile loads (currently just "Loading account settings…").
- **Default / populated** — all sections with current values.
- **Password-mismatch inline error** (confirm ≠ new).
- **Form-level error banner** — a single red banner at the top of the form for
  server/validation errors (see messages below).
- **Success** — on save, a **centered success modal** appears (overlay + card with a
  ✓ icon, "Success" heading, the message "Account updated successfully", and an OK
  button that dismisses it). Design this modal too.
- **Show/Hide password** toggles on all four password fields (New, Confirm, Current).

## Validation & behavior

### Client-side (before submit)
- **Current Password is required** — if empty: "Please enter your current password to
  save changes."
- If New or Confirm password is non-empty:
  - New password must be **≥ 8 chars** — else "New password must be at least 8
    characters."
  - New and Confirm must match — else "New passwords do not match."
- Only **changed** fields are sent: username/email only if different from loaded
  values; newPassword only if entered; security question+answer only if an answer was
  typed; volunteer roles are always sent (server reconciles to the exact set).

### Server-side (surfaced as the top error banner)
- Current password is re-verified — "Current password is incorrect."
- Username uniqueness — "Username is already taken."
- Email uniqueness — "Email is already in use."
- New password ≥ 8 — "New password must be at least 8 characters."
- Security question + answer are only updated when **both** are provided.
- Volunteer roles: only GOALIE/REF/SCOREKEEPER may be self-assigned; the user's other
  roles are preserved untouched.

### On success
- Clears the New Password, Confirm, Answer, and Current Password fields (username/email
  stay as their new values).
- If the **username changed**, the server returns a new JWT and the session is
  re-established transparently (no re-login needed) — no special UI required, just
  don't assume the username is immutable.
- Shows the success modal described above.

## The 8 security questions (exact list, for the dropdown)
1. What was the name of your first pet?
2. What city were you born in?
3. What is your mother's maiden name?
4. What was the name of your elementary school?
5. What was the make and model of your first car?
6. What is the name of the street you grew up on?
7. What was your childhood nickname?
8. What is your oldest sibling's middle name?

## Data contract (for reference)
- **GET `/auth/profile`** → `{ username, email, securityQuestion, staffRoles[] }`
  (staffRoles = the user's current subset of GOALIE/REF/SCOREKEEPER; securityQuestion
  may be null if never set).
- **PUT `/auth/profile`** ← `{ currentPassword (required), username?, email?,
  newPassword?, securityQuestion?, securityAnswer?, staffRoles[] }` → `{ message,
  user, token? }` (token present only when username changed).

## Design system to build within
Standard post-redesign tokens (`frontend/src/styles/theme.css`): dark card
(`--obi-bg-card`/`--obi-bg-elevated`), `--obi-accent`, `--obi-error`/`--obi-success`
for the inline/error/success states, `--obi-card-border`, `--obi-font-display` /
`--obi-font-body`. The password Show/Hide toggle, the checkbox-with-sub-hint pattern
(same shape as the UserModal role cards / Volunteer-role rows), and the success modal
should all match the vocabulary already established in the auth screens and UserModal
handoffs so this reads as part of the same family.

## Deliverable format
Same as prior handoffs — an `.dc.html` prototype covering the populated form (all
sections), the inline password-mismatch state, the top error banner, and the success
modal, with a short README. Drop into a new `Website theme integration` folder in
Downloads.
