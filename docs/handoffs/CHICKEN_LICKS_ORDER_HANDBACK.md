# Handback: Chicken Licks team ordering — full functional surface

## Purpose
Chicken Licks Bar & Grill is the local spot a lot of the league goes to after
games. This feature lets a user browse the menu, build an order right on the
site, and then place a real phone call to the restaurant with that order still
on screen so they can read it off. It also lets a whole team build one shared
order together, and keeps a history of past orders so they can be reordered
later. This is a **brand-new feature with no existing code** — there's nothing
to preserve, this doc is the full spec for the mockup.

**Not in scope (deferred, future idea only):** an AI voice agent that
auto-dials the restaurant and speaks the order for the user. That's a much
bigger project (telephony + speech + a live conversation with restaurant
staff) and is intentionally being left as a possible future side project, not
part of this build. This handback covers the "site builds the order, human
places the actual call" version only.

## Placement
Lives on the user dashboard (`frontend/src/components/user/Dashboard.jsx`),
added as one more entry in the existing horizontal sub-nav strip
(`dash-subnav` — currently "My Week" / "Signups" / "Team Management" / "Goalie
Stats"), scrolling to a new zone/section lower on the same page — same pattern
as the other tabs use (`<a href="#id">` + a `<section id="id">` further down).
Deliberately **not** added to the main site nav so it doesn't crowd it. Visible
to every user regardless of role (GM/official/player all eat wings).

## Menu data (source: photographed menu, transcribed — treat as real content, not lorem ipsum)

**Wings — $13/basket.** Flavors: Original, Dry Rub, Buffalo, BBQ, Nude
(Plain). Sauces on the side +$1 each: Blue Cheese, Ranch, BBQ, Buffalo.
Extra Celery +$0.75.

**Sandwiches:** Chicken Po-Boy $11.50 · Crispy Chicken $7 · Grilled Chicken $7
· Crispy Cod $7.50

**Baskets — $12.** Chicken Strips, Shrimp, Crispy Cod.

**Blue Cheese Pint — $7**

**Appetizers:** Cheese Curds $6 · Jalapeno Poppers $6 · Onion Rings $6 · Mac &
Cheese Bites $6 · Mushrooms $6 · Breaded Pickle Chips $6 · Pub Chips $5 ·
Waffle Fries $5 · Tater Tots $5 · French Fries $4.50 · Cole Slaw $2

**Cheeseburger — $7.50** (+Bacon $2)

Each item needs a quantity stepper (not just add/remove), and wing/basket
items need their flavor/side picked at add-time (e.g. "Wings — Buffalo, +
Ranch"), since that's what has to be read aloud on the call.

**Phone number for the call button: (608) 837-6721.**

## Order model — three states a user can be in
1. **No active order** — default state. Two entry points: "Start My Order"
   (personal) or "Start a Team Order" (shared).
2. **Building a personal order** — just this user's cart. Works exactly like
   a normal food-ordering cart: browse menu → add items → review → call.
3. **Participating in a team order** — see below.

### Team order behavior
- Any user can tap **"Start a Team Order"**, which creates one shared order
  scoped to their current team (`dash?.team`, current season). They become the
  **initiator**.
- The moment it's started, every other member of that same team sees a new
  banner/card on their *own* dashboard — something like *"🍗 [Name] started a
  Chicken Licks order for [Team] — add your items"* — with a button to jump in
  and add their own items to the shared order. This needs to appear without
  the teammate needing to already be looking at the Chicken Licks section —
  treat it like the existing `dash-action-card` "Action Needed" banner at the
  top of the dashboard.
- Each teammate's added items stay **attributed to them** in the shared order
  (needed for the read-aloud and for history — "who ordered what").
  Teammates can edit/remove only their own items; they cannot touch anyone
  else's.
- Only the **initiator** can close the order. "Close & Call" locks it (no more
  additions from anyone) and moves to the call screen (see below).
- If the initiator abandons it without closing, that's fine to leave as a
  simple "Cancel Order" action available only to the initiator — no auto-expiry
  logic needed for the mockup.

## The aggregated/review screen (shown before calling, whether personal or team)
- Items grouped by person (for a team order) or just a flat list (personal).
- Each line shows: item, flavor/side choices, quantity, price.
- Per-person subtotal (team order only) + running grand total.
- Primary action: **"Call Chicken Licks"** — a real `tel:` link/button, so
  tapping it on a phone actually dials (608) 837-6721.
- The order summary **stays visible on screen** during/after the call is
  placed (this is the whole point — so whoever's calling can read it off to
  the person on the other end). Treat this as a persistent "call screen" state,
  not a dismissed modal.
- Team order screen only: **"Close Order"** button (initiator-only), separate
  from placing the call — closing is what finalizes it into history.

## Order history
- A simple reverse-chronological list of past orders (personal and team),
  each showing: date/time, team (if a team order), who participated, full
  item list per person, and total.
- Each history entry has a **"Order This Again"** action, which clones it into
  a brand-new draft order (pre-filled with the same items/flavors/quantities)
  that the user can then edit before calling — reusing the same
  personal-vs-team distinction (reordering a past team order offers "start a
  new team order from this" the same way "Start a Team Order" does).

## Design system to build within
Same OBI dark theme as the rest of the dashboard —
`frontend/src/styles/theme.css` tokens, the `dash-` prefixed shell classes
already used by every other dashboard zone (`dash-zone`, `dash-card`,
`dash-subnav-link`, `dash-btn`, `dash-empty`, etc. — see current
`Dashboard.jsx`/`Dashboard.css`). **New markup for this feature should use its
own prefix** (e.g. `cl-`) rather than generic names, per this codebase's
established classname-collision problem (no CSS scoping — several unrelated
components already fight over names like `.modal-content`/`.btn-confirm`).
The "Action Needed" banner pattern (`dash-action-card`) is the closest sibling
for the "teammate started a team order" notification.

## Deliverable format
Same as prior handoffs — a `.dc.html` prototype covering: empty/entry state
(Start My Order vs Start a Team Order), menu browse + cart building (including
a wing/basket item's flavor picker), the teammate-notified state when someone
else started a team order, the aggregated review/call screen (both personal
and multi-person team variants) with the call button and persistent order
summary, the initiator's close-order control, and the order history list
including a reorder-in-progress state — dropped into a new `Website theme
integration` folder in Downloads, with a short README.
