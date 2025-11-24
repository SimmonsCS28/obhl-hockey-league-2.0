-- Migration: Create penalty tracking table
-- Description: Tracks player penalties across games for ejection and suspension rules

CREATE TABLE IF NOT EXISTS penalty_tracking (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL,
    game_id BIGINT NOT NULL,
    penalty_count INTEGER NOT NULL DEFAULT 0,
    is_ejected BOOLEAN DEFAULT false,
    is_suspended_next_game BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_penalty_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_penalty_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT chk_penalty_count CHECK (penalty_count >= 0),
    CONSTRAINT unique_player_game UNIQUE (player_id, game_id)
);

-- Create indexes
CREATE INDEX idx_penalty_player ON penalty_tracking(player_id);
CREATE INDEX idx_penalty_game ON penalty_tracking(game_id);
CREATE INDEX idx_penalty_ejected ON penalty_tracking(is_ejected);
CREATE INDEX idx_penalty_suspended ON penalty_tracking(is_suspended_next_game);

-- Add comments
COMMENT ON TABLE penalty_tracking IS 'Tracks player penalties for ejection (3 in game) and suspension (4 in 2 games) rules';
COMMENT ON COLUMN penalty_tracking.penalty_count IS 'Number of penalties player has received in this game';
COMMENT ON COLUMN penalty_tracking.is_ejected IS 'Whether player was ejected from this game';
COMMENT ON COLUMN penalty_tracking.is_suspended_next_game IS 'Whether player is suspended for the next game';
