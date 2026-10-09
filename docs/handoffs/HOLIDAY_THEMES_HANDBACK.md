# Holiday Themes — design handback

Drop-in files for the existing holiday plumbing. No code changes needed.

## Copy into the repo
```
frontend/src/styles/holidays/<key>.css               → same path
frontend/src/assets/images/holidays/buzzard-<key>.png → same path
```
Keys: `halloween`, `thanksgiving`, `christmas`, `nye`, `valentines`, `stpatricks`, `easter`, `july4`.

Preview: `HolidayThemes.dc.html` loads these exact files against a replica of the header and footer (1440px desktop + 375px phone, baseline first).

## What each file does
- **Tokens:** overrides `--obi-accent`, `-soft`, `-hover`, `--obi-header-border`, `--obi-shadow-gold`, `--obi-icy`. Backgrounds and text colours are untouched. Every accent keeps ≥ 6:1 contrast (passes AA) as a button fill with the existing `#0b0c0f` label, and as text on the dark header.
- **`.obi-holiday-fx`:** a faint tint as `background`, a slowly moving pattern tile as `::before` (ghosts, leaves, snow, confetti, hearts, shamrocks, pastel dots, stars) kept at 20–50% opacity, and an optional `::after` (pumpkins, string lights, firework pop, eggs).
- **`.obi-footer::before`:** a small motif sitting on the 3px accent border (Christmas and NYE run a full-width strip). Sets `position: relative` on `.obi-footer` so the motif can anchor. No layout effect.
- **Phones (≤540px):** `::before` is masked away from the logo and burger, and the `::after` motif is hidden (except the Christmas lights).
- **Reduced motion:** all animation stops.
- All art is inline SVG data-URIs. The largest stylesheet is ~10 KB and each logo is under 40 KB.

| Key | Accent | Header | Logo |
|---|---|---|---|
| halloween | `#FF7A1A` + purple border | drifting/bobbing ghosts, pumpkins | zombie (green skin, stitches, red eye) |
| thanksgiving | `#E8892E` + rust border | falling leaves | turkey-tail fan |
| christmas | `#EF4B50` + green border | snowfall, string lights on the bottom border | Santa hat |
| nye | `#FFC23D` gold | gold confetti, periodic firework | party hat |
| valentines | `#FF5C8A` | rising hearts | heart deely-boppers |
| stpatricks | `#3DBE6B` + gold icy | drifting shamrocks | leprechaun top hat |
| easter | `#F7B7D2` pastel | pastel dots, eggs on the border | bunny ears |
| july4 | `#FF5A5F` + blue border | stars, red/blue burst | Uncle Sam hat |

## Notes
- The logos are 376×114 transparent PNGs with the same aspect ratio as the original. Hat variants scale the bird to 78% to leave headroom, because the source art touches the top edge. They are composited from the existing logo, so an illustrator pass would make them look more polished.
- Phone rules use `max-width` media queries, so in the preview's 375px frame they only apply at a real phone viewport. Check them at `?theme=<key>` in devtools.
