---
name: obhl-season-recap
description: Generate or regenerate a completed OBHL season's recap and save it to the hockey league website. Use for requests to publish season summaries, update an archived recap after score corrections, or preview the recorded season highlights.
---

# OBHL season recap

Publish the website's curated season summary from recorded games: champion and final, games played, goals, penalties, and highest-scoring game. This skill runs on demand; it does not schedule jobs or change game results. The API computes the statistics—do not invent a champion, totals, quotes, or highlights.

## Pick the season and destination

Use the site and season established in the conversation. Local previews and production are different targets; do not silently substitute one for the other. The production OBHL origin is `https://oldbuzzardhockey.com`. Use `OBHL_SITE_URL` when configured.

Read public `/api/v1/seasons` to resolve a supplied season name to its ID and confirm `status` is `completed`. The bundled helper can list these with `--list-seasons`. If multiple seasons match or the destination is unclear, ask only for that missing choice. Do not complete an active season just to make recap generation succeed.

A request to generate/save a recap authorizes publishing it for the specified site and season. Regeneration replaces that season's existing snapshot. A request only to inspect or preview uses `GET /api/v1/seasons/{id}/recap` and does not publish.

## Generate and save

Prefer an existing authenticated ADMIN browser session when available: open Seasons, choose the completed season, and click **Generate recap** or **Regenerate recap**. Follow the available browser tool's instructions. Use the site's normal login flow if needed; do not extract stored session tokens.

For a scriptable session, use the bundled `scripts/publish_recap.py`. It requires Python 3's standard library and these environment variables:

- `OBHL_SITE_URL`: site origin, without an API path.
- `OBHL_RECAP_USERNAME` and `OBHL_RECAP_PASSWORD`: credentials for an active ADMIN account whose initial password setup is complete.

Use already-authorized credentials supplied through the environment or the user's chosen local credential source. Do not echo credentials/tokens, add them to source control, or search unrelated files for credentials. If none are available, have the user sign in normally or configure those variables.

```sh
python3 <skill-directory>/scripts/publish_recap.py --list-seasons
python3 <skill-directory>/scripts/publish_recap.py --season-id 12
```

`12` is only an example; use the verified season ID. Add `--allow-local` only for a loopback HTTP development site. Production requires HTTPS. The helper refuses redirects and verifies the POST result with a public GET.

The write endpoint is `POST /api/v1/seasons/{id}/recap/generate`. It saves a snapshot and publication timestamp. Public reads return the saved snapshot until it is regenerated; an unsaved season may still show live statistics.

## Verify and report

Confirm the selected season's recap has an Updated timestamp and the expected totals, using the public endpoint or page. Report the season, website link, and whether it was first generated or regenerated when known. When using the helper, its success means the saved JSON matched the unauthenticated public read.

Stop on authentication/permission failures and identify the missing access. A 404 can mean the recap feature has not been deployed; a 409 means the season is not completed. Do not deploy code, modify roles, edit source games, or retry publishing blindly to resolve those errors. After an uncertain network result, read the current recap before deciding whether another write is necessary.

## Deployment prerequisite

For `SimmonsCS28/obhl-hockey-league-2.0`, deploy the recap publishing API/frontend and apply `database/migrations/070_create_season_recaps.sql` before first use. Skill installation itself neither deploys this feature nor publishes a recap.
