-- Migration 029: Add playoff columns and update chk_different_teams constraint
-- Allows homeTeamId=0 / awayTeamId=0 as "TBD" sentinel for playoff games
-- Adds playoff_round and bracket_position columns (also handled by ddl-auto=update
-- in game-service, but included here for clean fresh-database installs)

-- Add playoff columns if they don't already exist
ALTER TABLE games
    ADD COLUMN IF NOT EXISTS playoff_round VARCHAR(20),
    ADD COLUMN IF NOT EXISTS bracket_position INTEGER;

-- Drop and recreate the chk_different_teams constraint so that TBD playoff games
-- (home_team_id=0, away_team_id=0) are allowed.
-- The new rule: if either team is 0 (TBD), skip the check; otherwise teams must differ.
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_different_teams;
ALTER TABLE games ADD CONSTRAINT chk_different_teams
    CHECK (home_team_id = 0 OR away_team_id = 0 OR home_team_id <> away_team_id);
