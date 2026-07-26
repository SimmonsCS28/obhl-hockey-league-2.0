# Handback: Chicken Licks personal order-total tracker

## Purpose
Follow-up to the main Chicken Licks ordering feature (already built and live —
see `CHICKEN_LICKS_ORDER_HANDBACK.md`). Adds a small "how much have I
personally spent on Chicken Licks this season" stat to the Chicken Licks
section on the user Dashboard. This is a small, self-contained addition —
not a redesign of the existing section.

## What's already built (backend, live in prod)
`GET /api/v1/chicken-licks/my-total?seasonId=` (authenticated) returns the
current user's own season-to-date total: `{ "total": 47.25 }`. It sums the
user's own line items across every "finalized" order they've participated
in — their own personal orders once placed, **and** their own attributed
lines within any team order once that team order is closed (so someone who
only ever adds a couple of items to team orders still accrues a total, not
just people who use personal orders). Nothing about this number resets
per-order; it's a running season total, currently with no frontend consumer.

## What needs designing
Where and how this number appears in the existing Chicken Licks section
(`frontend/src/components/user/chickenLicks/ChickenLicksSection.jsx`) —
e.g. a small stat/badge near the header (next to the logo, phone number,
hours), or its own compact tile above/beside the order cards. Needs:
- The zero-state (a user with no orders yet this season) — hide it entirely,
  show "$0.00", or some friendly empty copy?
- Whether it's just a number + label ("You've ordered $47.25 this season")
  or wants a small icon/visual treatment to match the section's CL-orange
  accent styling already in place.
- Whether it should link/scroll anywhere (e.g. down to Order History) or is
  purely informational.

## Design system to build within
Same as the rest of the Chicken Licks section — dark OBI theme
(`frontend/src/styles/theme.css` tokens) plus the CL accent `#FF7A45`
already established there. Keep it visually consistent with the existing
header/order-card treatment rather than introducing a new visual language.

## Deliverable format
Same as prior handoffs — a `.dc.html` prototype showing the tracker in
context within the existing Chicken Licks section header (a couple of
states: zero-balance and a real dollar amount), dropped into a new
`Website theme integration` folder in Downloads, with a short README.
