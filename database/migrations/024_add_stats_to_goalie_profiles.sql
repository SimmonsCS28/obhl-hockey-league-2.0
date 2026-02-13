-- Migration: Add stats to goalie_profiles
-- Description: Tracks career wins and losses for goalies
-- Date: 2026-02-12

ALTER TABLE goalie_profiles
ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN goalie_profiles.wins IS 'Total career wins';
COMMENT ON COLUMN goalie_profiles.losses IS 'Total career losses';
