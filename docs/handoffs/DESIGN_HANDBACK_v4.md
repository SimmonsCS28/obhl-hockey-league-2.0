# OBHL — Implementation → Claude Design Handback (post-v4)

Purpose: sync Claude Design with what the **built app** actually looks like now, so the next
design pass builds on reality. We implemented the v4 reconciliation this session; most of it
matches v4, but a few things **intentionally diverge** (please update the design to match),
and a few v4 screens are **not built yet** (the remaining work). Ends with **direction for the
next design pass**: the scorekeeper **Live Score Entry**, the admin **Schedule** (keep file
import), and the **Draft Tool**.

---

## 1. What's now LIVE in the build (v4 implemented)
- **v3 officiating loop** — Open Slots (ref/scorekeeper self-signup), Goalie Availability (weekly), Coordinator Console (assign / confirm / reassign / clear / publish; role tabs Goalie/Ref/Scorekeeper). Lifecycle: `open → signed-up → pending → confirmed`. **Scorekeeper self-signs up exactly like a ref**; goalies are assigned from availability.
- **`SCOREKEEPER_COORDINATOR`** is its own role (three separate coordinator roles).
- **Sectioned Rules** — public page (grouped ToC: General Info / Game Rules / Agreement + scroll-spy) and an admin **Rules Editor** (section list + ▲/▼ reorder + per-section title/group + rich-text body + Publish). Seeded with the **real 14-section rules content** (incl. the updated Game Forfeit rule). *Note: no draft isolation — edits persist on Publish.*
- **Admin Standings** module (read-only, playoff cut = top 8).
- **Unified Dashboard** (`/dashboard`) replacing the two old dashboards — zones **My Week / Signups / Team Management**, gated by real roles. Role tabs show open-slot counts. Scorekeepers get a **"Score Game"** button on confirmed commitments → Live Score Entry.
- **Shared user pill** across public / dashboard / coordinator / admin headers (avatar+name → dashboard; Coordinator/Admin links highlight gold on the active page; Log Out). Admin also keeps its sidebar-footer "← View public site" identity.
- **Rinks = Cardinal / Tubbs** (see §2).

## 2. Intentional divergences from v4 — please UPDATE the design to match
1. **RSVP removed.** After checking with GMs, the "Are you playing? (I'm In / Can't Make It)" feature won't be used. The Next Game card has **no RSVP buttons**, and My Schedule has **no per-game availability pills**. Please drop RSVP from the Dashboard design.
2. **Dashboard sub-nav "Officiating" → "Signups"** (the section now covers goalie availability *and* ref/scorekeeper signups, so "Signups" reads better).
3. **"Gated · Goalie / Official" / "Gated · General Manager" badges removed.** They were prototype role-gating scaffolding (paired with the "Preview your access" toggles); real users would be confused by "Gated." The zones simply don't render unless you hold the role.
4. **Rinks are Cardinal and Tubbs — not "Eagle."** v4 §8 renamed Tubbs → Eagle; that's incorrect per the owner. Please keep **Tubbs** (venue/building stays "Sun Prairie Ice Arena").
5. **Minor:** in the Rules content the tie rules (#5–6) sit under "Scoring & Tiebreakers" and Captains (#13) under "Penalties & Discipline" (v4 grouped a couple of these slightly differently). Non-blocking — just noting so the design's Rules grouping can match if desired.

## 3. Pragmatic simplifications (design is fine; implementation is lighter for now)
- **Last Game card** shows score + result but **not** the per-game G/A/PIM stat trio (we don't expose per-game player stats yet).
- **GM Team Management zone** links out to the full team editor instead of inline roster editing.
- **Officiating "my commitments"** are sourced from pending assignments + your open-slot signups (no dedicated "all my assignments" endpoint yet).

## 4. v4 designs NOT yet implemented (still to build)
- **Admin Live Score Entry** — v4 redesigned it (Admin.dc.html), but our admin still renders the **original** component. Not yet ported.
- **Admin Schedule** — v4 redesigned it, but ours is still the **original file-import ScheduleManager**. See the constraint in §5.
- **Scorekeeper-facing Live Score Entry** (`/scorekeeper/game/:id`) — still the **old light-themed page**; needs a proper design (see §5).
- (Also not yet built: the v4 Manage Users / Generate Users rebuild — lower priority.)

## 5. Direction for the next design pass
### A. Scorekeeper Live Score Entry (primary ask)
Design a **scorekeeper-facing** Live Score Entry in the OBHL dark theme. Context: a scorekeeper reaches it from **Dashboard → Signups → Scorekeeper tab → "Score Game →"** (`/scorekeeper/game/:id`). It should feel consistent with the v4 **admin** Live Score Entry (scoreboard, + Goal / + Penalty, period control, game log, Finalize) but rendered in the scorekeeper portal chrome. It wires to the existing scoring backend (game events, finalize/unfinalize). The current page is unstyled/legacy — this is the main thing to design next.

### B. Admin Schedule — KEEP the file-import flow
We like the v4 design's **generated-schedule display + inline editing**, but **the import must stay a file upload**, not the paste-CSV-text box shown in the v4 Schedule design. Our current flow: **Select season → Download CSV template → Choose File (upload) → parses/generates the schedule**. Please redesign the schedule so it **marries our file-upload import** with the v4 generated-schedule table/editing look. (Rinks in the template: Cardinal / Tubbs.)

### C. Draft Tool
Whenever ready — currently a "Soon" placeholder in the admin nav.
