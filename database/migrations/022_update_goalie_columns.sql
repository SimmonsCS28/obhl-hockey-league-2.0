-- Migration to update goalie columns in games table
-- Version: 022
-- Description: Replace single goalie_id with goalie1_id and goalie2_id to match entity definition

-- Drop the old goalie_id column and index if they exist
DROP INDEX IF EXISTS idx_games_goalie_id;
ALTER TABLE games DROP COLUMN IF EXISTS goalie_id;

-- Add new goalie columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS goalie1_id BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS goalie2_id BIGINT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_goalie1_id ON games(goalie1_id);
CREATE INDEX IF NOT EXISTS idx_games_goalie2_id ON games(goalie2_id);
