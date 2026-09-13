# Handoff: Player Profile Card — public card modal + self-service profile editing

## Purpose
A new feature, not a restyle. Today the public Players page
(`frontend/src/components/public/PlayersPage.jsx`) is a flat list — jersey, name, team,
position — and clicking a row does nothing. There is no place anywhere on the site
where a player has a face, a hometown, or a history.

This handoff asks Claude Design for **one modal** with two modes:

1. **Read mode (public)** — the *player profile card*. Opens when anyone clicks a
   player on the Players page. Shows the player's photo, identity, on-ice details,
   and a list of every season they've played with the team they were on.
2. **Edit mode (self only)** — when the logged-in viewer is looking at *their own*
   card, an **Edit Profile** button flips the same modal into a form where they upload
   a photo and fill in their details.

**The profile is person-level, not season-level.** The league runs a fresh draft each
season; a player's team, jersey number, and sometimes position change every year. The
photo, birth date, hometown, height, weight, and shooting hand are the *person* and
must carry forward untouched from season to season. The card design should make that
split legible: the top of the card is "this season" (team colours, #, position); the
details and the season history are "this person."

### What this is NOT
- Not **Account Settings** (`/account`, `frontend/src/pages/AccountSettings.jsx`).
  That page is login identity and security: username, email, password, security
  question, volunteer roles. The profile card is on-ice identity. Neither surface
  should offer the other's fields.
- Not a stats card. **No stats appear anywhere on the card** — no goals, assists,
  points, GAA. This is deliberate; don't leave a slot for them.
- **Skill rating is never shown and never editable.** It's a league-internal number.
  Don't design a field, a hint, a "rating" chip, or any copy that alludes to it.
- Not the Draft Tool's `PlayerCard.jsx` (that's an admin draft-board tile; unrelated).

### Entry points
- **Players page** — `/players`, any row in the list (`PlayersPage.jsx:199-215`).
  Rows already have a gold hover state (`PlayersPage.css:131`) so the affordance is
  half-there; the row should read as clickable (cursor, hover, keyboard focus).
- **Team roster page** — `/teams/:teamId`, the roster rows
  (`frontend/src/components/public/TeamRosterPage.jsx:217-238`). Same card, same
  behaviour.
- **My Profile** — the logged-in dashboard's welcome banner
  (`frontend/src/components/user/Dashboard.jsx:284-299`) shows an initials avatar +
  name + team. Making the avatar/name open the viewer's own card gives players a
  direct route to editing without hunting for themselves in the list. Design may
  also propose a small "Edit profile" text link in that banner.

Optional (Design's call, not required): once photos exist, the Players page rows and
roster rows could show a small circular thumbnail before the name. If you propose it,
show the initials fallback too — most players won't have uploaded a photo on day one.

## Card modal — read mode

### Shell
- Dark scrim overlay + centered card. The Players page gets heavy phone traffic, so
  the card must work at ~375px wide (full-bleed sheet is fine on mobile).
- Header: close (×). Escape closes. Clicking the scrim closes in read mode.
- Card is scrollable if the season history runs long (some players have 10+ seasons).

### Identity block (this season)
- **Photo** — square, displayed as a large rounded square or circle. Source is a
  512×512 JPEG. **Fallback = initials avatar** filled with the player's team colour
  (same pattern as `UserPill.jsx` / `Dashboard.jsx` `dash-avatar`; colour helpers
  `resolveTeamColor()` / `textOn()` in `frontend/src/constants/teamColors.js`). Most
  players will be on the fallback for a while — it has to look intentional, not
  broken.
- **Name** — `First Last`, display font.
- **Team pill** — team colour dot/pill + team name. Players with no team this season
  (free agents, unassigned goalies) show "Free agent" or similar — design that state.
- **`#12 · Forward`** — jersey number and position. Position labels: F → Forward,
  D → Defense, G → Goalie (`TeamRosterPage.posLabel`). Jersey may be missing early in
  a season → show just the position.
- **Badges** — any of: **GM** (this player runs the team), **VET** (veteran),
  **2GL** (two-goal limit). Existing `.obi-mini-badge` look on the Players page is the
  reference; 2GL already uses a distinct colour there. Zero, one, or all three may
  apply.

### Details grid (this person)
| Label | Value format | Notes |
|---|---|---|
| Age | `42` | Computed server-side from birth date. **The full birth date is never shown publicly.** |
| Hometown | `Windsor, ON` | Free text, up to 100 chars |
| Height | `6'1"` | Stored as inches; display feet + inches |
| Weight | `185 lb` | |
| Shoots | `Left` / `Right` | Goalies typically leave this blank |

Every field is individually optional. Show `—` for a missing value or drop the row —
pick one and be consistent. Also design the **all-empty** state: a player who has
never filled anything in should get a quiet "No profile details yet" line, not five
dashes.

### Season history (this person)
A list, newest season first, one row per season the person has played:

| Season | Team | Position | # |
|---|---|---|---|
| Season 15 (current) | ● Blue Jays | Forward | 12 |
| Season 14 | ● Rockets | Forward | 7 |
| Summer Classic 2025 | ● Team Red | Defense | 4 |

- Team shown with its colour dot; a season where the person had no team shows
  "Free agent."
- The **current** season is marked (chip, weight, or accent bar).
- Tournaments come through the same list with a `seasonType` flag — give them a
  subtle visual distinction (an eyebrow tag, muted style) or group them under a
  divider. Don't hide them.
- A first-season player has exactly one row. Still show the section; it's how the
  card tells them "this will grow."
- No stats columns. Not even points. (Yes, really.)

### Footer
- **Close**.
- **Edit Profile** (primary, gold) — **only when the viewer is this player.**
- **Remove photo** (small, destructive, secondary) — **only when the viewer is an
  ADMIN** and a photo exists. Moderation escape hatch; needs a confirm step.

### Interaction with the season selector
The Players page has a season selector. The card opens on the *row that was clicked*
— so if an admin is browsing Season 12, the identity block shows that player's
Season 12 team and number — but the details grid and season history are always the
full person, all seasons.

## Card modal — edit mode (self only)

Same shell, same width. Entered via **Edit Profile**; exits via **Cancel** (back to
read mode, changes discarded) or **Save** (back to read mode, showing fresh data).
Clicking the scrim or pressing Escape with unsaved changes should prompt, not silently
discard.

### Photo editor (replaces the identity block's photo)
- Shows the current photo, or the initials fallback.
- Actions: **Upload photo** (no photo yet) / **Replace** + **Remove** (photo exists).
- Accepted: JPG or PNG, up to 5 MB. The client crops to a square and downsizes before
  upload (this also fixes sideways phone photos), so the user should see a preview of
  the square crop before it goes up. A simple center-crop preview is enough; a
  drag-to-reposition cropper is a nice-to-have, not required.
- Upload is its own action with a progress state — it saves immediately, independent
  of the Save button for the text fields. Make that clear ("Photo saved" toast or
  inline check) so the user doesn't think they still need to hit Save.
- Photo errors to design copy for: wrong type ("JPG or PNG only"), too large ("Keep it
  under 5 MB"), unreadable file ("That file doesn't look like an image").

### Read-only context (greyed, not inputs)
Name · team · # · position, shown faintly with a one-line hint:
*"Your name, team, and number are set by the league and your GM."* This heads off
the obvious "why can't I change my number" question.

### Editable fields
1. **Birth date** — date picker. Helper text under it: *"Only your age is shown on
   your card."* This is the one field with a privacy angle; the helper is required.
2. **Hometown** — text, max 100 characters.
3. **Height** — two small inputs, **ft** and **in** (stored as total inches). Don't
   make people do the math.
4. **Weight** — number, **lb**.
5. **Shoots** — segmented control: **Left** / **Right** (plus a way to clear it; a
   third "—" segment or a deselect-on-tap is fine).

Nothing else. No nickname, no bio, no favourite team, and — again — no rating.

### Footer
- **Cancel** (ghost) · **Save** (primary). Save is disabled until something changes.

### States to design
- Edit / default (populated)
- Edit / first-time (all fields empty, initials avatar, "Upload photo")
- Edit / photo uploading (progress on the avatar)
- Edit / photo error (one of the three messages above, inline by the photo)
- Edit / saving (Save button busy)
- Edit / save error (banner at the top of the form — "Couldn't save your profile.
  Try again.")
- Edit / unsaved-changes prompt on close

## Empty and edge states (read mode)
- **Anonymous visitor** — read-only, no Edit, no admin actions. This is the majority
  case.
- **Logged in, someone else's card** — identical to anonymous.
- **Logged in, own card, no profile yet** — details grid is empty. Instead of the
  quiet "No profile details yet," this viewer gets a prominent CTA: *"Add your photo
  and details"* → opens edit mode. This is the onboarding moment; make it inviting.
- **Player with no linked account** — some players exist only from the registration
  spreadsheet and never signed up. Their card renders normally (photo fallback, empty
  details, history from their rows). Nothing to design beyond the empty state — just
  don't assume every card can be edited by someone.
- **Card loading** — skeleton or spinner inside the modal shell (the list row click
  should open the shell immediately, then fill).
- **Card error** — "Couldn't load this player" + Close.

## Validation surfaced to the user
| Field | Rule | Suggested copy |
|---|---|---|
| Birth date | Between 16 and 100 years ago | "Enter a valid birth date." |
| Hometown | ≤ 100 characters | "Keep it under 100 characters." |
| Height | 4'0" – 8'0" (48–96 in) | "Enter a height between 4'0\" and 8'0\"." |
| Weight | 80 – 400 lb | "Enter a weight between 80 and 400 lb." |
| Shoots | Left or Right | (segmented control — can't be invalid) |
| Photo | JPG/PNG, ≤ 5 MB, decodes | see photo editor above |

Server-side errors come back as one message in the banner; field-level errors are
shown inline under the field.

## Data contract (for reference)
All through the API gateway.

- **GET `/api/v1/players/{playerId}/card`** — public; if a JWT is present it's used to
  compute `isSelf`. Returns:
  ```
  {
    playerId, firstName, lastName, position, jerseyNumber,
    seasonId, seasonName,
    team: { id, name, abbreviation, teamColor } | null,
    photoUrl | null,
    age | null,
    hometown, heightInches, weightLbs, shoots,
    badges: { isGm, isVeteran, twoGoalLimit },
    isSelf, hasProfile,
    seasonHistory: [ { seasonId, seasonName, seasonType, isCurrent,
                       team: {…} | null, position, jerseyNumber } ]   // newest first
  }
  ```
  Deliberately absent: `email`, `birthDate`, `skillRating`, `buddyPick`, any stats.
- **GET `/api/v1/user/player-profile`** — authenticated; the owner's own view,
  including the full `birthDate` for the date picker. 404 if the account has no
  player record.
- **PUT `/api/v1/user/player-profile`** ← `{ birthDate, hometown, heightInches,
  weightLbs, shoots }` (full replace; null clears) → the owner view.
- **POST `/api/v1/user/player-profile/photo`** — multipart `file` → the owner view
  with the new `photoUrl`. 413 over 5 MB.
- **DELETE `/api/v1/user/player-profile/photo`** → 204.
- **DELETE `/api/v1/players/{playerId}/photo`** — ADMIN only, moderation → 204.
- **GET `/api/v1/media/players/{key}`** — the photo bytes, public, cacheable forever
  (keys are UUIDs; a replaced photo gets a new URL).

## Design system to build within
Standard post-redesign tokens (`frontend/src/styles/theme.css`): `--obi-bg-deep-card`
for the modal card, `--obi-card-border`, `--obi-accent` (gold) for the primary action
and the current-season marker, `--obi-icy` for secondary text/labels, `--obi-error`
for the destructive admin action and error banners, `--obi-font-display` for the name
and section heads, `--obi-font-body` elsewhere, `--obi-radius-card` (16px).

Closest existing precedents:
- **`frontend/src/components/UserModal.jsx` + `UserModal.css`** — the best visual
  reference for a dark modal in this system (overlay, `#161b22` card, 16px radius,
  header/body/footer, banner, field/label/input vocabulary).
- **`frontend/src/components/admin/draft/DraftModal.jsx`** — the a11y mechanics to
  match (Escape closes, focus trap, focus restore, body scroll lock).
- Team colour pill/dot: the Players page chips and `TeamBadge.jsx` in
  `components/common/`.

Implementation constraint worth knowing while you design: this codebase has **no CSS
scoping**, and `.modal-overlay` / `.modal-content` / `.player-card` / `.form-group`
are already defined multiple conflicting times (see the note at the top of
`UserModal.css`). The build will use a unique prefix (`obi-pcard-*`). Nothing for
Design to do except not assume generic class names carry meaning here.

## Deliverable format
Same as prior handoffs — a `.dc.html` prototype with a short README, dropped into the
`Website theme integration` folder in Downloads. Required states, at minimum:

- read / another player, populated (photo, all details, 4+ seasons incl. a tournament)
- read / another player, initials fallback + empty details
- read / anonymous (identical to the above, confirms no Edit)
- read / self with profile (Edit Profile button)
- read / self, no profile yet (the "Add your photo and details" CTA)
- read / admin viewing (Remove photo action)
- edit / populated
- edit / first-time empty
- edit / photo uploading + one photo error
- edit / save error banner
- **mobile (~375px)** for read/populated and edit/populated
- the Players page row hover/focus state (and the optional thumbnail, if proposed)

---

## Gotcha for whoever implements it (not for Design)

Backend design was worked through before this handoff; the shape below is the intended
build. Full detail lives in the plan file this doc was written from.

**Persistence model — the cross-season guarantee.**
- `players` is one row per person **per season** (see memory note / migrations 003,
  039, 049, 059). `DraftService.mapPlayer()` in league-service builds each new-season
  row copying only name / email / position / skill / veteran / buddy / GM / ref. Nothing
  entered on a prior-season row survives.
- So the profile goes in a **new table `player_profiles`, owned by api-gateway, keyed
  by `email_lower` (unique, NOT NULL) with a nullable `user_id`.** Email is the only
  identity that survives a draft; `players.user_id` is NULL for every league player
  (only the tournament draft writes it), and `players.email` is case-sensitive so
  case variants exist. Columns: `birth_date, hometown, height_inches, weight_lbs,
  shoots, photo_key, photo_content_type, photo_size_bytes, photo_updated_at,
  created_at, updated_at`. CHECKs on shoots (L/R), height 48–96, weight 80–400.
- Migration `database/migrations/063_create_player_profiles.sql`. Must be idempotent
  (the runner re-executes every file) and follow the **059 "converge" pattern**
  because api-gateway runs `ddl-auto=update` and will create the table from the entity
  first. Backfill one row per `lower(email)` taking, per column, the newest non-null
  value across that person's season rows (drop the `'N/A'` shoots sentinel); link
  `user_id` by `lower(users.email)` where the user is active.
- `players.birth_date / hometown / shoots / height_inches / weight_lbs` become
  **legacy fallback**: the card reads `COALESCE(profile.x, seasonRow.x)`; writes go to
  the profile only. Admin `PlayerManagement` keeps writing the legacy column (document,
  don't fix in v1). `height_inches`/`weight_lbs` aren't even mapped in the stats
  `Player` entity — profile-only.
- With this, **no changes to `DraftService`, `TournamentDraftService`, or the goalie
  import** — new rows carry the email; the card resolves the profile through it.

**Self resolution.** JWT principal is the *username* → `UserRepository.findByUsername`
→ `user.email` → `lower()` compared to `lower(players.email)`. That inline pattern is
in `PlayerDashboardController.java:73-99`; extract it into a small helper rather than
copying it a fourth time. **Do not build self-edit on stats-service
`PATCH /api/v1/players/{id}`** — it has no ownership check (any authenticated user can
edit any player today; separate security item).

**Season history.** New stats-service endpoint `GET /api/v1/players/history?email=`
(privileged / internal-key only — it's an email-keyed lookup) backed by a new
`findByEmailIgnoreCaseOrderBySeasonIdDesc`. The existing `PlayerRepository.findByEmail`
returns `Optional` and **throws** for any multi-season player — don't reuse it (and
`/players/exists` + `/players/by-email` already have that latent bug). Seasons via a
new `LeagueClient.getSeasons("ALL")` (`GET /api/v1/seasons?type=ALL` exists; there's no
client method yet). Teams are a local gateway JPA entity — no Feign call. Wrap the
history/season lookups so a league-service outage degrades to an empty history, not a
failed card.

**Photos.** Clone the highlights feature (`HighlightController` /
`HighlightStorageService` / `MediaResourceConfig`, migration 056): gateway-native
`@RequestPart` endpoint, UUID keys, same `app.media.root` and the existing
`highlight_media:/app/media` volume (put photos under `players/` — the Dockerfile
`mkdir -p /app/media` + chown already handles ownership). Generalize the storage
service (subdir + `byte[]` store) rather than adding a second one. Serve via a second
resource handler at **`/api/v1/media/players/**`** — NOT `/api/v1/players/media/**`,
because `PlayerProxyController`'s `/**` mapping shadows resource handlers under
`/players/`. Add `GET /api/v1/media/**` to `permitAll` in `SecurityConfig`. Server-side:
`javax.imageio` (in the JRE, no new dependency) center-crop → 512×512 JPEG ~0.85 —
re-encoding strips EXIF/GPS and guarantees the bytes are a real image; reject > 6000px
before full decode (decompression bomb). ImageIO ignores EXIF orientation, so the
frontend must also canvas-resize with `createImageBitmap(file, { imageOrientation:
'from-image' })` before upload (this is also what lets users pick HEIC on the client).
Frontend upload = XHR clone of `api.js uploadHighlight` (~line 829) — multipart cannot
go through the gateway's String-body proxies (TECHNICAL_DEBT #1). Photos are not in
`pg_dump`, same caveat as 056.

**Frontend wiring.** `PlayersPage.jsx:30` fetches `/stats-api/players` directly with no
auth header. The card must call the new `api.getPlayerCard(id)` through the gateway
(`/api/v1`) or `isSelf` is always false. New `api.js` methods: `getPlayerCard`,
`getMyPlayerProfile`, `updateMyPlayerProfile`, `uploadMyPlayerPhoto`,
`deleteMyPlayerPhoto`, `adminDeletePlayerPhoto`. `PlayerDto.jerseyNumber` in the
gateway is a `String` — grep callers before changing the type, or map separately for
the card.

**Risks.** Email drift (admin edits `players.email`, or a user changes their account
email in Account Settings) silently detaches a profile — no auto-repair in v1, note it
in TECHNICAL_DEBT. Retired `retired+…` users (044) never link. The 2GL badge is
public today and is derived from skill ≥ 9 — it stays, but it's the one place skill
leaks into the card; don't add anything else rating-adjacent.
