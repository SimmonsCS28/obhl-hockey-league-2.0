-- Migration to update staff assignment fields in games table
-- Version: 021
-- Description: Replace single referee_id with referee1_id and referee2_id for dual referee support

-- Drop the old referee_id column and index
DROP INDEX IF EXISTS idx_games_referee_id;
ALTER TABLE games DROP COLUMN IF EXISTS referee_id;

-- Add new referee columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS referee1_id BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS referee2_id BIGINT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_referee1_id ON games(referee1_id);
CREATE INDEX IF NOT EXISTS idx_games_referee2_id ON games(referee2_id);
