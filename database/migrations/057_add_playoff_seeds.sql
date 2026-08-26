-- The seed each participant carried into a playoff game.
--
-- Re-seeding needs to know what seed a surviving team holds, and until now nothing in the league
-- path recorded that. teams.seed exists but is written only by the tournament draw; the league
-- bracket's seed order was computed in the browser (points desc, then goal differential) and posted
-- to /initialize-bracket as a bare ordered teamIds array, then thrown away.
--
-- Stored on the game rather than on the team row, for two reasons:
--   * game-service has no write path to teams -- it reaches them through api-gateway, and adding a
--     cross-service write would need ADMIN on a request made by a scorekeeper finalizing a game.
--     Same trade TournamentBracketService already declined to make.
--   * a seed is a fact about a bracket, not about a team. Frozen here, re-finalizing a regular
--     season game months later cannot silently renumber a bracket already in progress.
--
-- NULL for regular season, consolation and tournament games, and for bracket games created before
-- this column existed -- resolvePlayoffSeeds() falls back to recomputing from standings when a
-- bracket predates it.

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS home_seed INTEGER,
    ADD COLUMN IF NOT EXISTS away_seed INTEGER;

ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_game_home_seed;
ALTER TABLE games ADD CONSTRAINT chk_game_home_seed
    CHECK (home_seed IS NULL OR home_seed >= 1);

ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_game_away_seed;
ALTER TABLE games ADD CONSTRAINT chk_game_away_seed
    CHECK (away_seed IS NULL OR away_seed >= 1);

COMMENT ON COLUMN games.home_seed IS
    'Playoff seed of the home team in this bracket game (1 = best regular season record). Written '
    'when the bracket is initialized and carried forward as each round is re-seeded. NULL for any '
    'game that is not a league bracket game.';

COMMENT ON COLUMN games.away_seed IS
    'Playoff seed of the away team in this bracket game. See home_seed.';

-- Backfill brackets seeded before this column existed, so a playoff already under way can be
-- re-seeded without the code having to guess. Reproduces the ordering the browser used when it
-- posted the seed list to /initialize-bracket: points desc, then goal differential desc.
--
-- Only league bracket games (playoff_round IS NOT NULL) are touched -- consolation games have no
-- seeds, and tournaments carry theirs on teams.seed already.
WITH seeded AS (
    SELECT id,
           season_id,
           ROW_NUMBER() OVER (PARTITION BY season_id
                              ORDER BY points DESC, (goals_for - goals_against) DESC, id) AS seed
    FROM teams
    WHERE active = true
)
UPDATE games g
SET home_seed = s.seed
FROM seeded s
WHERE g.season_id = s.season_id
  AND g.home_team_id = s.id
  AND g.game_type = 'PLAYOFF'
  AND g.playoff_round IS NOT NULL
  AND g.home_seed IS NULL;

WITH seeded AS (
    SELECT id,
           season_id,
           ROW_NUMBER() OVER (PARTITION BY season_id
                              ORDER BY points DESC, (goals_for - goals_against) DESC, id) AS seed
    FROM teams
    WHERE active = true
)
UPDATE games g
SET away_seed = s.seed
FROM seeded s
WHERE g.season_id = s.season_id
  AND g.away_team_id = s.id
  AND g.game_type = 'PLAYOFF'
  AND g.playoff_round IS NOT NULL
  AND g.away_seed IS NULL;
