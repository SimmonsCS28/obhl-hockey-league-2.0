-- Migration: Fix team unique constraints to be per-season
-- Description: Drop global UNIQUE constraints and add composite constraint for name + season_id only

-- Drop the existing global UNIQUE constraints
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_abbreviation_key;

-- Add composite UNIQUE constraint only for name + season_id
-- Abbreviations are auto-generated and don't need to be unique
ALTER TABLE teams ADD CONSTRAINT teams_name_season_unique UNIQUE (name, season_id);

-- Update team_color column to allow 30 characters to match JPA entity
ALTER TABLE teams ALTER COLUMN team_color TYPE VARCHAR(30);

COMMENT ON CONSTRAINT teams_name_season_unique ON teams IS 'Team names must be unique within a season';
