-- Migration: Create teams table
-- Description: Tracks hockey teams with standings and statistics

CREATE TABLE IF NOT EXISTS teams (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL UNIQUE,
    season_id BIGINT NOT NULL,
    logo_url VARCHAR(500),
    team_color VARCHAR(7),
    gm_id BIGINT,
    active BOOLEAN NOT NULL DEFAULT true,
    points INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    ties INTEGER NOT NULL DEFAULT 0,
    overtime_wins INTEGER NOT NULL DEFAULT 0,
    overtime_losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_points CHECK (points >= 0),
    CONSTRAINT chk_wins CHECK (wins >= 0),
    CONSTRAINT chk_losses CHECK (losses >= 0),
    CONSTRAINT chk_ties CHECK (ties >= 0),
    CONSTRAINT chk_overtime_wins CHECK (overtime_wins >= 0),
    CONSTRAINT chk_overtime_losses CHECK (overtime_losses >= 0),
    CONSTRAINT chk_goals_for CHECK (goals_for >= 0),
    CONSTRAINT chk_goals_against CHECK (goals_against >= 0)
);

-- Create indexes
CREATE INDEX idx_teams_season ON teams(season_id);
CREATE INDEX idx_teams_active ON teams(active) WHERE active = true;
CREATE INDEX idx_teams_points ON teams(points DESC);

-- Add comments
COMMENT ON TABLE teams IS 'Hockey teams with standings and statistics';
COMMENT ON COLUMN teams.points IS 'Total points in standings';
COMMENT ON COLUMN teams.team_color IS 'Team color in hex format (#RRGGBB)';
