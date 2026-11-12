# Archived season recaps (#36)

Completed seasons on the public Seasons page show the championship winner and final, games played, goals scored, recorded penalty counts/minutes, and the highest-scoring game. Active and upcoming seasons retain the existing overview. A stable season list keeps archived selections from immediately resetting (the same fix included in PR #39).

## Data rules

`GET /api/v1/seasons/{id}/recap` is public through the gateway's existing season-read policy. Its specific controller mapping takes precedence over the season proxy. Apply `database/migrations/070_create_season_recaps.sql` before deploying the updated gateway. The endpoint serves the saved snapshot when one exists, otherwise it calculates a live preview.

- Include only completed regular-season/playoff games for totals. Exclude forfeits from games played, goals, and penalties. Tournament games do not count.
- Goals come from valid final scoreboard totals. Missing scores trigger a coverage note; no scored games yields an unavailable goal total rather than an invented zero.
- Count penalty events directly and sum recorded minutes. These are recorded calls, not an inferred count from player penalty minutes.
- Name a champion only when exactly one PLAYOFF/FINAL game exists and is completed with a decisive score or a recognized forfeiting team. Never substitute standings. Missing, tied, or ambiguous finals get an explicit unknown state.
- Highest combined score uses scored, non-forfeit games. Ties are disclosed and use date then game ID for deterministic selection.
- Unknown season returns 404; a season not yet completed returns 409.

## Local review

The development gateway runs on port 8005 and Vite on 5175, separate from the leaderboard and poll previews. With Node 20.19+, run from `frontend`:

```sh
npm ci
OBHL_API_PROXY_TARGET=http://127.0.0.1:8005 npx vite --host 127.0.0.1 --port 5175 --strictPort
```

Open http://127.0.0.1:5175/seasons and select **Demo 2024–25 recap**. The opt-in `docs/test-fixtures/season-recap.sql` creates a fictional season, teams, players, games, and scoring events. Use only an isolated database with the app schema. It skips an already-existing fixture season and does not reset edits.

Expected fixture: Demo Copper champions, 4–2 final; 5 games played, 37 goals, 6 penalties, 15 penalty minutes; a 7–6 standout game; one excluded forfeit and one unfinished game. Demo 2025–26 from the leaderboard fixture exercises an archive without games.

## Validation

Run `./gradlew test` in `backend/api-gateway`. Eight recap tests exercise SQL against H2 plus aggregation logic: cross-season/game-type exclusions, lowercase event types, missing scores, ties, forfeits, ambiguous/unfinished finals, and empty archives. PostgreSQL/API checks verify the live fixture totals and public routing.

Frontend checks: targeted ESLint, production Vite build, desktop/mobile selection and rendering, empty archives, and championship recap links. The pre-existing SeasonContext mixed-export pattern still triggers the repository's React Refresh lint rule. The production build retains its existing bundle-size warning.


## Generate and save a recap

An active ADMIN can click **Generate recap** on a completed season, or **Regenerate recap** to replace its saved snapshot after game corrections. Publication saves JSON, a timestamp, and the administrator account ID atomically. Public reads do not expose the publishing account. Changes to game records do not alter a saved recap until it is regenerated.

The same operation is available as `POST /api/v1/seasons/{id}/recap/generate`. Signed-out callers receive 401; non-admin callers receive 403; an active season receives 409. A row lock serializes publication for the same season.

### AI skill

Use **$obhl-season-recap** to generate or regenerate the recap on demand. The portable skill is in `skills/obhl-season-recap`; it is also installed in the local Codex skills directory for this workspace's user.

Example: “Use $obhl-season-recap to generate and save the Demo 2024–25 recap on the local site at http://127.0.0.1:5175.” The skill resolves the season ID, uses an authenticated admin session or configured credentials, publishes the recap, and verifies the saved result. Preview-only requests do not publish.

The skill's standard-library helper supports:

```sh
python3 skills/obhl-season-recap/scripts/publish_recap.py --list-seasons
python3 skills/obhl-season-recap/scripts/publish_recap.py --season-id ID
```

Set `OBHL_SITE_URL` and, for publication, `OBHL_RECAP_USERNAME` and `OBHL_RECAP_PASSWORD` in the process environment. `--allow-local` permits HTTP only on loopback addresses. Production requires HTTPS, the deployed publishing API/frontend, and migration 070. No GitHub Action or scheduled job is added.

Script tests: `python3 -m unittest discover -s scripts/tests -v`. Local demo credentials are not included in the repository or skill. Installing the skill does not deploy or publish anything to production.
