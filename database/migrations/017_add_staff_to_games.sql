-- Migration to add staff assignment fields to games table
-- Version: 017
-- Description: Add goalie_id, referee_id, and scorekeeper_id columns

ALTER TABLE games ADD COLUMN IF NOT EXISTS goalie_id BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS referee_id BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS scorekeeper_id BIGINT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_goalie_id ON games(goalie_id);
CREATE INDEX IF NOT EXISTS idx_games_referee_id ON games(referee_id);
CREATE INDEX IF NOT EXISTS idx_games_scorekeeper_id ON games(scorekeeper_id);
