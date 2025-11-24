-- Migration: Create games table
-- Description: Tracks scheduled and completed hockey games

CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL,
    league_id BIGINT,
    home_team_id BIGINT NOT NULL,
    away_team_id BIGINT NOT NULL,
    game_date TIMESTAMP NOT NULL,
    venue VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    overtime BOOLEAN DEFAULT false,
    shootout BOOLEAN DEFAULT false,
    period INTEGER DEFAULT 1,
    game_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_game_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_league FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL,
    CONSTRAINT fk_game_home_team FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_away_team FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT chk_game_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
    CONSTRAINT chk_different_teams CHECK (home_team_id != away_team_id),
    CONSTRAINT chk_scores CHECK (home_score >= 0 AND away_score >= 0)
);

-- Create indexes
CREATE INDEX idx_games_season ON games(season_id);
CREATE INDEX idx_games_league ON games(league_id);
CREATE INDEX idx_games_home_team ON games(home_team_id);
CREATE INDEX idx_games_away_team ON games(away_team_id);
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_status ON games(status);

-- Add comments
COMMENT ON TABLE games IS 'Hockey games schedule and results';
COMMENT ON COLUMN games.status IS 'Game status: scheduled, in_progress, completed, postponed, cancelled';
