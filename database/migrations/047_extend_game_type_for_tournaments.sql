-- Lets games belong to a tournament, and records which stage of one they are.
--
-- Tournament games are ordinary rows in games so they inherit Live Score Entry, game_events,
-- finalize, staffing (goalie1_id/referee1_id/scorekeeper_id) and the stats pipeline. Only two
-- things about them are new: the game_type value, and which stage of the tournament they belong to.

-- 010 created chk_game_type with a bare ADD CONSTRAINT, which errors on every re-run of the
-- migration directory. Recreate it the idempotent way while extending it.
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_game_type;
ALTER TABLE games ADD CONSTRAINT chk_game_type
    CHECK (game_type IN ('REGULAR_SEASON', 'PLAYOFF', 'TOURNAMENT'));

COMMENT ON COLUMN games.game_type IS
    'REGULAR_SEASON, PLAYOFF or TOURNAMENT. Only REGULAR_SEASON moves the denormalised standings '
    'columns on the team row -- see TeamStatsUpdater.affectsLeagueStandings.';

-- Which stage of the tournament a game belongs to. NULL for every league game.
--
-- This is not derivable from playoff_round, and the distinction earns its keep three times over:
--   * overtime -- pool and round-robin games can end tied; bracket, placement and consolation
--     games go to sudden death, because somebody has to advance.
--   * points   -- ONLY group-stage games award tournament points. Bracket, placement and
--     consolation games decide who advances and who finishes where, not standings.
--   * reading  -- isElimination(game) stays a field read rather than a join back through
--     tournaments to work out what format is being run.
ALTER TABLE games ADD COLUMN IF NOT EXISTS tournament_stage VARCHAR(20);

ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_tournament_stage;
ALTER TABLE games ADD CONSTRAINT chk_tournament_stage
    CHECK (tournament_stage IS NULL OR tournament_stage IN
        ('POOL', 'ROUND_ROBIN', 'BRACKET', 'PLACEMENT', 'CONSOLATION'));

COMMENT ON COLUMN games.tournament_stage IS
    'POOL | ROUND_ROBIN | BRACKET | PLACEMENT | CONSOLATION for tournament games; NULL otherwise. '
    'POOL/ROUND_ROBIN are the only stages that award tournament points. PLACEMENT is the game '
    'between the two semifinal losers.';

-- The standings service reads every group-stage game for a season on each request.
CREATE INDEX IF NOT EXISTS idx_games_season_stage ON games(season_id, tournament_stage);
