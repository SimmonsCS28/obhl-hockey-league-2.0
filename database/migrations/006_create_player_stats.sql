-- Migration: Create player_stats table
-- Description: Tracks skater statistics per season

CREATE TABLE IF NOT EXISTS player_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL,
    season_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 0,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    plus_minus INTEGER NOT NULL DEFAULT 0,
    penalty_minutes INTEGER NOT NULL DEFAULT 0,
    power_play_goals INTEGER NOT NULL DEFAULT 0,
    power_play_assists INTEGER NOT NULL DEFAULT 0,
    short_handed_goals INTEGER NOT NULL DEFAULT 0,
    short_handed_assists INTEGER NOT NULL DEFAULT 0,
    game_winning_goals INTEGER NOT NULL DEFAULT 0,
    shots INTEGER NOT NULL DEFAULT 0,
    shooting_percentage DECIMAL(5,2) DEFAULT 0.00,
    faceoff_wins INTEGER NOT NULL DEFAULT 0,
    faceoff_losses INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0,
    blocked_shots INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_pstats_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_pstats_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_pstats_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT uq_player_season UNIQUE (player_id, season_id),
    CONSTRAINT chk_games_played CHECK (games_played >= 0),
    CONSTRAINT chk_goals CHECK (goals >= 0),
    CONSTRAINT chk_assists CHECK (assists >= 0),
    CONSTRAINT chk_points CHECK (points >= 0),
    CONSTRAINT chk_shooting_pct CHECK (shooting_percentage >= 0 AND shooting_percentage <= 100)
);

-- Create indexes
CREATE INDEX idx_pstats_player ON player_stats(player_id);
CREATE INDEX idx_pstats_season ON player_stats(season_id);
CREATE INDEX idx_pstats_team ON player_stats(team_id);
CREATE INDEX idx_pstats_points ON player_stats(points DESC);
CREATE INDEX idx_pstats_goals ON player_stats(goals DESC);

-- Add comments
COMMENT ON TABLE player_stats IS 'Skater statistics per season';
COMMENT ON COLUMN player_stats.points IS 'Total points (goals + assists)';
COMMENT ON COLUMN player_stats.plus_minus IS 'Plus/minus rating';
