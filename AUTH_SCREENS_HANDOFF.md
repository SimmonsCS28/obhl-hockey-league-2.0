# Handoff request — Auth screens restyle (Login, Signup, Forgot/Reset Password)

**Ask:** Redesign all of the pre-redesign auth surfaces together in one pass — Login
modal, Signup, Forgot Password, and Reset Password. They're the last screens still on
the old light theme, they share the same form-field/button/error-banner vocabulary, and
none of them have an earlier Claude Design mockup to diff against, so this is one
net-new design pass rather than a reconciliation.

## Current state — components & files
- **Login** (modal overlay, not a page): `frontend/src/components/LoginModal.jsx` +
  `LoginModal.css`. Triggered from the public header's "Log In" button
  (`PublicLayout.jsx`), centered overlay over a dark scrim.
- **Signup** (full page, route `/signup`): `frontend/src/components/Signup.jsx`,
  styled via `frontend/src/components/referee/Signup.css` (reused, not its own file).
- **Forgot Password** (full page, route `/forgot-password`):
  `frontend/src/components/ForgotPassword.jsx` + `ForgotPassword.css`. Multi-step:
  choose method → email link OR security question → (if question) answer + set new
  password.
- **Reset Password** (full page, route `/reset-password?token=&email=`):
  `frontend/src/components/ResetPassword.jsx`, reuses `ForgotPassword.css`.
- All four share: white card, navy header text (`#003E7E`), slate grays, no
  `--obi-*` tokens — the "doesn't match the new theme" gap.

## Current copy — source of truth (design against this, not any older screenshot)

### Login (modal)
- Header: "Login" / "Sign in to continue"
- Field: label "Email or Username", placeholder "Enter your email or username"
- Field: label "Password", placeholder "Enter your password", show/hide eye-icon
  toggle inside the input
- Primary button: "Sign In" → "Signing in..." while submitting
- Inline error banner above the fields (failed login only)
- Footer: "Don't have an account? Create Account" · "Forgot Password?"

### Signup (page, title "Create Account")
- Fields: Username · First Name / Last Name (side by side) · Email
- "I am a... (Select all that apply)" — checkboxes: Goalie / Referee / Scorekeeper
- Password · Confirm Password
- Security Question — dropdown of 6 common questions + "Write my own..." custom text
  input option (component `common/SecurityQuestionInput.jsx`, has its own "Back to
  list" link)
- Security Answer
- Primary button: "Sign Up" → "Creating Account..."
- Footer: "Already have an account? Log In"
- Inline error banner (e.g. duplicate email/username messages)

### Forgot Password (page, title "Reset Password")
- Step 0 — method choice: "How would you like to reset your password?" with two
  buttons: "Email Me a Reset Link" / "Answer My Security Question"
- Email path: "Enter your account email and we'll send you a link to reset your
  password." + Email field + "Send Reset Link" → "Sending..."; success message
  "If an account with that email exists, a password reset link has been sent..."
- Security-question path, step 1: "Enter your username to retrieve your security
  question." + Username field + "Next" → "Searching..."
- Security-question path, step 2: displays the retrieved question in quotes + Answer
  field + New Password + Confirm Password + "Reset Password" → "Resetting...";
  success message "Password reset successfully! Redirecting to login..."
- Links: "Choose a different option" (back to method choice), "Back to Login"
- Inline error banner (e.g. "User not found or no security question set.")

### Reset Password (page, title "Reset Password", from emailed link)
- If token/email missing from URL: error banner "This reset link is invalid. Please
  request a new one."
- Otherwise: New Password + Confirm Password fields, "Reset Password" →
  "Resetting..."; same success message/redirect as above
- Links: "Request a new link", "Back to Login"

## States needed per screen
- **Login**: default, password revealed, submitting, error
- **Signup**: default, role-checkbox selection, custom security question, submitting,
  error (both the generic and the duplicate-email/username variants — those are
  longer strings, make sure the banner handles multi-line text)
- **Forgot Password**: method choice, each path's form, loading, success message,
  error
- **Reset Password**: valid form, invalid-link error, loading, success message

## Design system to build within
- Tokens: `frontend/src/styles/theme.css` — dark surfaces (`--obi-bg`, `--obi-bg-card`,
  `--obi-bg-elevated`), gold accent `--obi-accent` (`#F6A91C`), text scale
  (`--obi-text`, `--obi-text-secondary`, `--obi-text-muted`), status colors
  (`--obi-success`, `--obi-error`, `--obi-warning`), borders (`--obi-card-border`,
  `--obi-divider`), fonts (`--obi-font-display` = Saira Condensed for headings,
  `--obi-font-body` = Saira for body/inputs).
- Closest existing pattern already built in this style: the centered card in
  `frontend/src/components/ConfirmShift.css` (`.cs-page` / `.cs-card` / `.cs-eyebrow` /
  `.cs-title` / `.cs-alert--error` / `.cs-alert--success`) — same "centered card over
  dark page" shape as these full-page auth screens, and its alert classes are a ready
  pattern for the error/success banners all four screens need.
- Login stays a modal overlay (dark scrim + centered card) — that's the existing UX
  and shouldn't change. Signup/Forgot/Reset stay full pages.
- Reuse one visual language across all four so they read as a single "auth" family
  (same card shape, same input/button/banner styling, same spacing rhythm) rather than
  four independently-designed screens.

## Deliverable format
Same as prior handoffs — an `.dc.html` prototype (or screenshot set) per screen (or one
file with a section per screen) with a short README noting any new/changed tokens,
dropped into a new `Website theme integration` folder in Downloads so it can be read
and wired in directly.
