-- Migration: Add scoring system fields to games table
-- Description: Adds game_type, ended_in_ot, and points fields for OBHL scoring rules

-- Add game_type column
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS game_type VARCHAR(20) NOT NULL DEFAULT 'REGULAR_SEASON';

-- Add ended_in_ot column (replacing the generic overtime field)
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS ended_in_ot BOOLEAN DEFAULT false;

-- Add points columns for both teams
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS home_team_points INTEGER DEFAULT 0;

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS away_team_points INTEGER DEFAULT 0;

-- Add constraint for game_type
ALTER TABLE games 
ADD CONSTRAINT chk_game_type CHECK (game_type IN ('REGULAR_SEASON', 'PLAYOFF'));

-- Add constraint for points (can be negative due to penalty deductions)
ALTER TABLE games 
ADD CONSTRAINT chk_points CHECK (home_team_points >= -1 AND away_team_points >= -1);

-- Create index on game_type for filtering
CREATE INDEX IF NOT EXISTS idx_games_type ON games(game_type);

-- Add comments
COMMENT ON COLUMN games.game_type IS 'Type of game: REGULAR_SEASON or PLAYOFF';
COMMENT ON COLUMN games.ended_in_ot IS 'Whether the game ended in overtime (for tied games)';
COMMENT ON COLUMN games.home_team_points IS 'Points awarded to home team (2=win, 1=tie/OT loss, 0=loss, -1=7+ penalties)';
COMMENT ON COLUMN games.away_team_points IS 'Points awarded to away team (2=win, 1=tie/OT loss, 0=loss, -1=7+ penalties)';
