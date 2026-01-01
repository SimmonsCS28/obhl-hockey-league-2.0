-- Migration: Add week and rink columns to games table
-- Purpose: Support game scheduling with week numbers and rink assignments

ALTER TABLE games ADD COLUMN IF NOT EXISTS week INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS rink VARCHAR(20);

-- Add index on week for faster queries
CREATE INDEX IF NOT EXISTS idx_games_week ON games(week);

-- Add index on season_id and week for schedule queries
CREATE INDEX IF NOT EXISTS idx_games_season_week ON games(season_id, week);
