-- Migration: Create goalie_stats table
-- Description: Tracks goalie-specific statistics per season

CREATE TABLE IF NOT EXISTS goalie_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL,
    season_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_started INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    overtime_losses INTEGER NOT NULL DEFAULT 0,
    shutouts INTEGER NOT NULL DEFAULT 0,
    saves INTEGER NOT NULL DEFAULT 0,
    shots_against INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    save_percentage DECIMAL(5,3) DEFAULT 0.000,
    goals_against_average DECIMAL(4,2) DEFAULT 0.00,
    minutes_played INTEGER NOT NULL DEFAULT 0,
    penalty_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_gstats_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_gstats_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_gstats_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT uq_goalie_season UNIQUE (player_id, season_id),
    CONSTRAINT chk_games_played CHECK (games_played >= 0),
    CONSTRAINT chk_games_started CHECK (games_started >= 0 AND games_started <= games_played),
    CONSTRAINT chk_wins CHECK (wins >= 0),
    CONSTRAINT chk_losses CHECK (losses >= 0),
    CONSTRAINT chk_saves CHECK (saves >= 0),
    CONSTRAINT chk_shots_against CHECK (shots_against >= 0),
    CONSTRAINT chk_goals_against CHECK (goals_against >= 0),
    CONSTRAINT chk_save_pct CHECK (save_percentage >= 0 AND save_percentage <= 1),
    CONSTRAINT chk_gaa CHECK (goals_against_average >= 0)
);

-- Create indexes
CREATE INDEX idx_gstats_player ON goalie_stats(player_id);
CREATE INDEX idx_gstats_season ON goalie_stats(season_id);
CREATE INDEX idx_gstats_team ON goalie_stats(team_id);
CREATE INDEX idx_gstats_save_pct ON goalie_stats(save_percentage DESC);
CREATE INDEX idx_gstats_gaa ON goalie_stats(goals_against_average ASC);

-- Add comments
COMMENT ON TABLE goalie_stats IS 'Goalie statistics per season';
COMMENT ON COLUMN goalie_stats.save_percentage IS 'Save percentage (0.000 to 1.000)';
COMMENT ON COLUMN goalie_stats.goals_against_average IS 'Goals against average per game';
