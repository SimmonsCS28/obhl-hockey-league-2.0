-- Migration: Goalie availability per game night
-- Version: 068
-- Description: goalie_availability was one row per (goalie, season, week). Some weeks have games
-- on two nights (e.g. Thursday and Friday) and a goalie may be free for only one of them, so a
-- row is now per (goalie, season, game night). The night is the game's America/Chicago calendar
-- date — the same day key the coordinator board and staff_unavailability use. `week` stays on
-- every row so week-level reads (coordinator pool, auto-proposer) still work by index.
--
-- Existing week rows are expanded into one row per game night in that week, so nothing a goalie
-- has already marked is lost. Rows for weeks that no longer have any games carry no meaning and
-- are dropped.
--
-- APPLY BEFORE rebuilding api-gateway: it runs ddl-auto=update, and booting the new entity first
-- would add a bare game_date column that this migration's backfill then has to fight.

BEGIN;

ALTER TABLE goalie_availability ADD COLUMN IF NOT EXISTS game_date DATE;

-- The old one-row-per-week constraint would reject the expansion below.
ALTER TABLE goalie_availability DROP CONSTRAINT IF EXISTS unique_goalie_avail_user_season_week;

INSERT INTO goalie_availability (user_id, season_id, week, status, created_at, updated_at, game_date)
SELECT ga.user_id, ga.season_id, ga.week, ga.status, ga.created_at, ga.updated_at, n.night
FROM goalie_availability ga
JOIN (
    SELECT DISTINCT season_id, week,
           (game_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date AS night
    FROM games
    WHERE week IS NOT NULL AND game_date IS NOT NULL
) n ON n.season_id = ga.season_id AND n.week = ga.week
WHERE ga.game_date IS NULL;

DELETE FROM goalie_availability WHERE game_date IS NULL;

ALTER TABLE goalie_availability ALTER COLUMN game_date SET NOT NULL;

ALTER TABLE goalie_availability
    ADD CONSTRAINT unique_goalie_avail_user_season_date UNIQUE (user_id, season_id, game_date);

CREATE INDEX IF NOT EXISTS idx_goalie_availability_season_date ON goalie_availability(season_id, game_date);

COMMIT;
