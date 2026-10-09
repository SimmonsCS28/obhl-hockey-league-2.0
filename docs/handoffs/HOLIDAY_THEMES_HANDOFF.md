# Holiday Themes — Claude Design handoff

**What we want:** eight holiday "dress-up" themes for the public OBHL site (the pages anyone can
see without logging in: home, seasons, teams, players, standings, schedule, rules). Each theme sits
**on top of** the existing design. It adds decoration and changes a few colours, but never replaces
the site's layout or styles. Turning a theme off has to put the site back exactly as it was.

The scheduling plumbing is already built, with no themes in it yet. Your deliverables drop into two
folders, and each theme goes live on its own dates with no further code changes.

---

## 1. When each theme runs

| Theme | Key | Default window |
|---|---|---|
| Valentine's Day | `valentines` | all of February |
| St. Patrick's Day | `stpatricks` | all of March |
| Easter | `easter` | Easter Sunday only (the date moves each year) |
| 4th of July | `july4` | all of July |
| Halloween | `halloween` | all of October |
| Thanksgiving | `thanksgiving` | all of November |
| Christmas | `christmas` | Dec 1 – Dec 30 |
| New Year's Eve | `nye` | Dec 31 – Jan 1 |

Admins can switch each theme on or off and change its dates in **Admin → Holiday Themes**.

**Priority order:** please design **Halloween first** because it is live now, then Thanksgiving,
Christmas and New Year's Eve, then the rest.

---

## 2. The contract (please follow exactly)

### 2a. One stylesheet per theme, every selector scoped
File: `frontend/src/styles/holidays/<key>.css`

**Every selector must start with `[data-holiday="<key>"]`.** That attribute sits on the public
layout's root element only while the theme is on. The codebase has no CSS scoping, so an unscoped
rule would leak into the whole site.

```css
/* ✅ good */
[data-holiday="halloween"] { --obi-accent: #FF7A1A; }
[data-holiday="halloween"] .obi-header { border-bottom-color: #7A3FB0; }

/* ❌ never */
.obi-header { ... }
:root { ... }
```

The stylesheet only loads while its theme is on, but the scoping is still required: once loaded,
a stylesheet stays in the page if a visitor previews several themes.

### 2b. Logo variant (optional, but the headline feature)
File: `frontend/src/assets/images/holidays/buzzard-<key>.png`

- If this file exists, it automatically replaces the buzzard logo in the **header and footer**.
- The current logo is `frontend/src/assets/images/buzzard-logo.png`: **188 × 57 px** transparent PNG
  (it shows at 42px tall in the header and 38px in the footer). Match the **same aspect ratio** and
  supply it at **2× (376 × 114)** or larger with a transparent background.
- Ideas: a zombie buzzard for Halloween, a Santa-hat buzzard for Christmas, a party-hat buzzard for
  New Year's Eve, a turkey-feathered buzzard for Thanksgiving.

### 2c. Decoration layer in the header
While a theme is on, the header contains an empty element you can draw into:

```html
<header class="obi-header">
  <div class="obi-holiday-fx" aria-hidden="true"></div>   <!-- only present when a theme is on -->
  <div class="obi-header-inner"> …logo, wordmark, nav… </div>
</header>
```

The plumbing already positions `.obi-holiday-fx`: it fills the header (`position:absolute; inset:0;
overflow:hidden; pointer-events:none`) and sits **behind** the logo, links and mobile menu. Use its
background, its `::before`/`::after`, and CSS animations for ghosts, snow, string lights, fireworks
and so on. You may also decorate `.obi-footer` with `::before`/`::after`. Inline SVG data-URIs, or
SVG files next to the stylesheet, are both fine.

### 2d. Colour tokens you may override
These are defined on `:root` in `frontend/src/styles/theme.css`. Override them **only inside your
scoped selector**:

| Token | Default | Used for |
|---|---|---|
| `--obi-accent` | `#F6A91C` (gold) | primary buttons, "HOCKEY LEAGUE" subline, active nav, footer top border |
| `--obi-accent-soft` / `--obi-accent-hover` | gold at 12% / 5% | tints |
| `--obi-header-border` | gold at 28% | header bottom border |
| `--obi-shadow-gold` | gold glow | primary button glow |
| `--obi-icy` | `#9DB9CD` | secondary accent |

Leave backgrounds and text colours alone. The site is dark (`#0b0c0f` / `#13171d`) and its text
contrast is tuned for that.

### 2e. Rules
- **No layout changes.** Don't change the header's 74px height, padding or nav, or anything inside `<main>`.
- **Readable:** text contrast must stay WCAG AA. Decorations go behind or beside text, never over it.
- **Calm motion:** animations stay slow and subtle, and everything stops under
  `@media (prefers-reduced-motion: reduce)`.
- **Phones:** below 1400px the nav collapses to a burger menu, and below 540px the header padding
  shrinks to 18px. Decorations must not crowd the logo or the burger button at 375px wide.
- **Light:** CSS and images only, no JavaScript, and keep each theme's total assets under ~150 KB.

---

## 3. Per-theme asks

| Theme | Logo | Banner / header | Accent |
|---|---|---|---|
| **Halloween** | zombie buzzard | ghosts drifting across the banner, pumpkins | pumpkin orange + purple |
| **Thanksgiving** | turkey-feathered buzzard | falling autumn leaves | warm amber / rust |
| **Christmas** | Santa-hat buzzard | light snowfall, string lights along the header's bottom border | red + green (or keep gold) |
| **New Year's Eve** | party-hat buzzard | confetti / small fireworks | gold + black (lean into the existing gold) |
| **Valentine's Day** | your call | hearts | pink / red |
| **St. Patrick's Day** | your call | shamrocks | green |
| **Easter** | your call | eggs / spring | pastels (keep contrast) |
| **4th of July** | your call | stars / fireworks | red, white and blue |

For the "your call" rows, please propose something in the same spirit, tongue-in-cheek and beer-league.

---

## 4. Current markup (for reference)

From `frontend/src/components/PublicLayout.jsx`:

```html
<div class="obi-public-layout" data-holiday="halloween">
  <header class="obi-header">                       <!-- sticky, dark translucent, 1px bottom border -->
    <div class="obi-holiday-fx" aria-hidden="true"></div>
    <div class="obi-header-inner">                  <!-- 74px tall, flex row -->
      <a class="obi-brand">
        <img class="obi-brand-logo">                <!-- 42px tall -->
        <span class="obi-wordmark">
          <span class="obi-wordmark-top">OLD BUZZARD</span>      <!-- Saira Condensed 900 italic 22px -->
          <span class="obi-wordmark-sub">HOCKEY LEAGUE</span>    <!-- 13px, var(--obi-accent) -->
        </span>
      </a>
      <button class="obi-burger">…</button>
      <nav class="obi-nav">…links, Donate, Log In…</nav>
    </div>
  </header>
  <main class="obi-public-main">…</main>
  <footer class="obi-footer">                       <!-- #070809, 3px top border in var(--obi-accent) -->
    … <img class="obi-footer-logo"> (38px tall) <span class="obi-footer-wordmark">OLD BUZZARD HOCKEY</span> …
  </footer>
</div>
```

Fonts: `Saira Condensed` (display) and `Saira` (body), both already loaded.

---

## 5. Deliverables checklist (per theme)

- [ ] `frontend/src/styles/holidays/<key>.css`, every selector prefixed `[data-holiday="<key>"]`
- [ ] `frontend/src/assets/images/holidays/buzzard-<key>.png`, transparent, same aspect as 188×57, at 2×
- [ ] any SVG decorations (inline in the CSS, or next to it)
- [ ] screenshots at desktop and 375px wide

## 6. How to preview

Run the frontend (`npm run dev`) and open `http://localhost:5173/?theme=<key>`. The preview lasts for
the browser tab's session, so you can click around the site. `/?theme=none` shows the plain site,
and `/?theme=auto` goes back to the real schedule. Admin → Holiday Themes has a Preview link on
every row, and shows **"Design pending"** for any theme with no stylesheet or logo yet.
