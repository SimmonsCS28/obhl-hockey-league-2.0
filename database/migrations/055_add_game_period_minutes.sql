-- How long a regulation period was in this game.
--
-- The companion to period_count (052), added for the same reason and stored the same way. Scoring
-- needed the count; the scorekeeper's clock needs the length. Without it, gameRules.js had no way
-- to know how long a period runs and fell back to a constant -- which meant the length shown to a
-- scorekeeper was a hardcoded guess rather than the tournament's actual configuration, and an event
-- could not be entered past that guess.
--
-- On the game rather than read from tournaments.period_minutes on demand, because:
--   * game-service still has no client for league-service, and the scorekeeper's clock should not
--     depend on a cross-service call.
--   * a game played as 2 x 20 keeps that length forever, even if next year's tournament is
--     configured as 2 x 15. Same reasoning as period_count and scoring_profile.
--
-- NULL for league games, which use the league's 20-minute regulation period.

ALTER TABLE games ADD COLUMN IF NOT EXISTS period_minutes SMALLINT;

ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_game_period_minutes;
ALTER TABLE games ADD CONSTRAINT chk_game_period_minutes
    CHECK (period_minutes IS NULL OR (period_minutes >= 1 AND period_minutes <= 60));

COMMENT ON COLUMN games.period_minutes IS
    'Length of a regulation period in minutes for this game. Set from tournaments.period_minutes '
    'when a tournament schedule is generated; NULL for league games (20). The scorekeeper clock '
    'reads this, not the tournament config, so reconfiguring a tournament cannot change the rules '
    'a game was already played under.';

-- Backfill any tournament games generated before this column existed, so a schedule created during
-- setup does not keep a null and silently fall back to the default.
UPDATE games g
SET period_minutes = t.period_minutes
FROM tournaments t
WHERE g.season_id = t.season_id
  AND g.game_type = 'TOURNAMENT'
  AND g.period_minutes IS NULL;
