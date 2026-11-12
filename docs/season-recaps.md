# Archived season recaps (#36)

Completed seasons on the public Seasons page show the championship winner and final, games played, goals scored, recorded penalty counts/minutes, and the highest-scoring game. Active and upcoming seasons retain the existing overview. A stable season list keeps archived selections from immediately resetting (the same fix included in PR #39).

## Data rules

`GET /api/v1/seasons/{id}/recap` is public through the gateway's existing season-read policy. Its specific controller mapping takes precedence over the season proxy. The endpoint reads the shared database; no schema migration is needed.

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
