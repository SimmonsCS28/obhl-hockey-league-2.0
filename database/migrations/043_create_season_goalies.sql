-- Migration: Create season_goalies table
-- Version: 043
-- Description: Per-season goalie roster with the full-time vs substitute distinction.
-- Keyed by user_id (the same key games.goalie1_id/goalie2_id use) so the weekly
-- goalie-assignment algorithm can operate directly on user ids without crossing the
-- fragile players.email+season_id link. Skill rating still lives on players.skill_rating.
--   is_fulltime = true  -> a full-time goalie the algorithm assigns each week
--   is_fulltime = false -> a substitute who fills in ad hoc (not auto-assigned)
-- Idempotent: safe to re-run (this migration runner re-executes every file each run).

CREATE TABLE IF NOT EXISTS season_goalies (
    id BIGSERIAL PRIMARY KEY,
    season_id   BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    is_fulltime BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_season_goalie UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_season_goalies_season ON season_goalies(season_id);
CREATE INDEX IF NOT EXISTS idx_season_goalies_fulltime ON season_goalies(season_id, is_fulltime);

COMMENT ON TABLE season_goalies IS 'Per-season goalie roster; is_fulltime flags the goalies the weekly assignment algorithm schedules.';
