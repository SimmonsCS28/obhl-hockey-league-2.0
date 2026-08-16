-- How many regulation periods a game was played under.
--
-- Needed because tournament scoring awards a point per period won and a point per penalty-free
-- period, and a period in which NOTHING happened still scores: no goals means neither team wins it,
-- but no penalties means BOTH teams earn the penalty-free point. Deriving the period list from the
-- events actually recorded would silently drop such a period and cost each team a point.
--
-- Stored on the game rather than read from tournaments.period_count on demand, for two reasons:
--   * game-service has no client for league-service, and adding a cross-service call to the
--     finalize path buys a failure mode for a number that never changes once a game is played.
--   * it is the more correct answer anyway. A game played as 2 x 15 should keep scoring as two
--     periods even if the tournament is later reconfigured -- same reasoning as storing
--     scoring_profile as a name rather than as columns.
--
-- NULL for league games, which use the league's regulation of 3 periods plus overtime.

ALTER TABLE games ADD COLUMN IF NOT EXISTS period_count SMALLINT;

ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_game_period_count;
ALTER TABLE games ADD CONSTRAINT chk_game_period_count
    CHECK (period_count IS NULL OR (period_count >= 1 AND period_count <= 5));

COMMENT ON COLUMN games.period_count IS
    'Regulation periods this game was played under. Set from tournaments.period_count when a '
    'tournament schedule is generated; NULL for league games (3 + OT). Scoring reads this, not the '
    'tournament config, so replaying old games cannot rescore them under new rules.';
