-- Migration: Create game_events table
-- Description: Tracks in-game events (goals, penalties, etc.)

CREATE TABLE IF NOT EXISTS game_events (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    player_id BIGINT,
    event_type VARCHAR(20) NOT NULL,
    period INTEGER NOT NULL,
    time_minutes INTEGER NOT NULL,
    time_seconds INTEGER NOT NULL,
    description TEXT,
    assist1_player_id BIGINT,
    assist2_player_id BIGINT,
    penalty_minutes INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_event_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_assist1 FOREIGN KEY (assist1_player_id) REFERENCES players(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_assist2 FOREIGN KEY (assist2_player_id) REFERENCES players(id) ON DELETE SET NULL,
    CONSTRAINT chk_event_type CHECK (event_type IN ('goal', 'penalty', 'save', 'shot', 'hit', 'faceoff')),
    CONSTRAINT chk_period CHECK (period > 0 AND period <= 5),
    CONSTRAINT chk_time_minutes CHECK (time_minutes >= 0 AND time_minutes < 60),
    CONSTRAINT chk_time_seconds CHECK (time_seconds >= 0 AND time_seconds < 60),
    CONSTRAINT chk_penalty_minutes CHECK (penalty_minutes IS NULL OR penalty_minutes > 0)
);

-- Create indexes
CREATE INDEX idx_events_game ON game_events(game_id);
CREATE INDEX idx_events_team ON game_events(team_id);
CREATE INDEX idx_events_player ON game_events(player_id);
CREATE INDEX idx_events_type ON game_events(event_type);
CREATE INDEX idx_events_period ON game_events(period);

-- Add comments
COMMENT ON TABLE game_events IS 'In-game events tracking';
COMMENT ON COLUMN game_events.event_type IS 'Event type: goal, penalty, save, shot, hit, faceoff';
COMMENT ON COLUMN game_events.period IS 'Period number (1-3 regular, 4+ overtime)';
