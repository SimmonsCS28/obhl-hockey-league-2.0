-- Migration 029: Add playoff columns and update constraints for TBD playoff games
-- Playoff games use NULL homeTeamId/awayTeamId as "to be determined" until bracket is set

-- Add playoff columns if they don't already exist
ALTER TABLE games
    ADD COLUMN IF NOT EXISTS playoff_round VARCHAR(20),
    ADD COLUMN IF NOT EXISTS bracket_position INTEGER;

-- Allow NULL team IDs (playoff TBD slots have no teams assigned yet)
ALTER TABLE games ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE games ALTER COLUMN away_team_id DROP NOT NULL;

-- Drop and recreate chk_different_teams to allow NULL,NULL TBD playoff games.
-- Rule: skip check if either is NULL or 0 (legacy sentinel); otherwise teams must differ.
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_different_teams;
ALTER TABLE games ADD CONSTRAINT chk_different_teams
    CHECK (home_team_id IS NULL OR away_team_id IS NULL
        OR home_team_id = 0 OR away_team_id = 0
        OR home_team_id <> away_team_id);
