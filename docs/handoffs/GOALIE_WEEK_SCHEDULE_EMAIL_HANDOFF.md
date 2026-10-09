# Handoff: Week Schedule block for goalie emails

**Audience:** Claude Design. Design an **email-embeddable HTML block** that shows the full week's
goalie matchups and who is currently in each net. The backend (api-gateway) will generate the real
HTML from live data using your design as the template — you don't need to wire up data, just define
the look and the exact markup structure.

## Purpose / where it appears
OBHL sends goalies two transactional emails (via Resend): a "confirm your time" proposal and a
"final assignment" email. We want to add, to **both**, a compact **week schedule** so the goalie can
see every matchup that week and who's assigned — for context beyond their own game.

## What it shows (behavior — already decided)
- The **current state** of the week's goalie slots, exactly as they stand at send time.
- Each game shows **two goalie slots**: home team's goalie and away team's goalie.
- If a slot has no goalie yet, show it **empty** (e.g. "—" or "Unassigned").
- **Confirmation status is irrelevant** here — a name shows whether or not that goalie has confirmed.
  Do NOT color/badge by confirmed/pending/declined. This block is purely "who's currently penciled
  into which matchup."
- Optionally highlight the **recipient's own game/row** (the backend can flag which row is theirs).
  Nice-to-have; tell us if you want it and we'll pass a boolean per row.

## The medium — READ THIS (email HTML constraints)
This is NOT app HTML. It renders in email clients, so:
- **Table-based layout only** (`<table>`/`<tr>`/`<td>`). No flexbox/grid. No `<style>` block reliance,
  no external CSS, no classes that matter — **every style must be an inline `style="..."` attribute.**
- **No JavaScript, no external images/fonts/CSS.** Team colors must be pure CSS (e.g. a `<td>` with
  `background-color`), not image swatches. If you want a logo it must be a hosted absolute-URL image
  or omitted; prefer omitting for deliverability.
- **Custom fonts won't load** (the app's 'Saira'/'Saira Condensed' are unavailable in email). Use a
  web-safe stack, e.g. `Arial, Helvetica, sans-serif`, and lean on weight/size/spacing for hierarchy.
- Target **max-width ~600px**, single column, **mobile-friendly** (stack/scale gracefully on narrow
  screens). Must be legible in both **light and dark** email themes — avoid pure-white-on-transparent
  or colors that vanish on a dark background; test that near-black team colors and near-white team
  colors both stay visible (draw a subtle border so a white/black swatch still reads).
- Keep it **self-contained**: it gets inserted between existing `<p>` paragraphs in a minimal email
  (there is currently no branded wrapper — the emails are bare HTML paragraphs).

## Data available per week (the contract)
For the target week, the backend can supply, for each game (ordered by start time):
- `date` — league-local, e.g. "Thu Jul 23"
- `time` — league-local, e.g. "7:15 PM"
- `rink` — e.g. "Tubbs" (may be "TBD")
- `homeTeamName`, `homeTeamColor` (hex), `awayTeamName`, `awayTeamColor` (hex)
- `homeGoalieName` (string or empty), `awayGoalieName` (string or empty)
- `isRecipientGame` (boolean) — true for the row belonging to the goalie receiving the email
- Week label, e.g. "Week 8"
Also available if you want it (say so): which team has **goalie pick** that matchup (we just shipped a
"pick" indicator in the app — lower-standing team in regular season, higher seed in playoffs). Only
include if you think it adds value in the email; otherwise ignore.

## Deliverable
Produce the **HTML for the block** with obvious repeat/placeholder structure — one worked example
with 2–3 game rows plus a clear "this `<tr>…</tr>` repeats per game, with these fields substituted"
note, so we can turn it into a server-side template. Include the section heading (e.g. "Week 8 —
Goalie Schedule") and the empty-slot treatment. All styles inline.

## Brand tokens (for reference; adapt to email realities)
- Accent (brand gold): `#F6A91C`
- Text: near-black on light, near-white on dark — but since email theme is unpredictable, prefer
  neutral grays with sufficient contrast on both, and explicit backgrounds where needed.
- (Status colors green/blue/red are intentionally NOT used here — status isn't shown.)

## Out of scope
- Backend data gathering + templating (we do this).
- Any confirm/decline actions (those live in the separate confirm link already in the email).
- A full branded email wrapper/redesign — just the schedule block.
