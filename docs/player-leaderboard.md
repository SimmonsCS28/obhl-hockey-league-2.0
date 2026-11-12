# Player leaderboard and pagination (#34)

The public Players page has Roster, Skater stats, and Goalie stats views. Each view supports name search, team filters, sortable columns, and 25/50/100 rows per page. Player names open the existing profile card. The view is shareable with `?view=skaters` or `?view=goalies`.

Pagination is client-side: the page loads the selected season's existing roster and aggregate stats endpoints, then displays a subset. No database migration or new API is required. Unrecorded skaters do not receive invented zero totals; goalie rates without a denominator display a dash. Points ties use goals, assists, name, then player ID.

The season context now keeps its league-season list stable so choosing an archived season survives view changes, filtering, and sorting (#37). Public pages still select the active season when first mounted. Upcoming seasons are labeled Upcoming rather than Archived.

## Local testing

Use Node 20.19+ and a running local backend/API gateway on port 8000. From `frontend`, run:

```sh
npm ci
npx vite --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173/players. Vite proxies API requests to the local gateway. The existing Docker frontend on port 8080 is a separate build and will not pick up these source edits.

### Fictional fixtures

`docs/test-fixtures/player-leaderboard.sql` is an opt-in fixture for an isolated, disposable development database with the app schema already initialized. It is deliberately outside the automatic database seeds. It creates an active demo season and should not be loaded into a production or shared database.

For the local `obhl-security` Docker project used during development, run from the repository root:

```sh
docker exec -i obhl-security-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < docs/test-fixtures/player-leaderboard.sql
```

The transaction skips demo seasons that already exist, so rerunning it does not duplicate them. It does not reset existing fixture edits or repair a partially edited demo season.

- Demo 2026–27: 154 players across two teams; 148 recorded skaters, two skaters without stats, and four goalies. One goalie has no games or shots.
- Demo 2025–26: 32 players with different totals for archived-season checks.
- Demo preseason (empty): no players or stats, for empty-state checks.

The fixtures contain invented names and `example.invalid` email addresses. They do not create login accounts, games, or scoring events; the stats are direct season aggregates for this feature's UI testing.

## Validation

From `frontend`:

```sh
npm run test:players
npx eslint src/components/public/PlayersPage.jsx src/components/common/SeasonSelector.jsx src/utils/playerLeaderboard.js
npx vite build
```

Manual checks: advance the roster pages, change page size, combine a name search with a team filter, sort goals/points/PIM, switch to the archived season and change views, open and close a player profile, and select the empty season. Check goalie save-percentage sorting in both directions: the goalie without shots stays last.

The repository's existing SeasonContext export pattern triggers `react-refresh/only-export-components`; the leaderboard changes do not introduce that baseline lint violation.
