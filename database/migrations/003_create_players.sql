-- Migration: Create players table
-- Description: Tracks hockey players with their team associations

CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    jersey_number INTEGER,
    position VARCHAR(10) NOT NULL,
    shoots VARCHAR(5),
    height_inches INTEGER,
    weight_lbs INTEGER,
    birth_date DATE,
    hometown VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_player_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT chk_position CHECK (position IN ('F', 'D', 'G')),
    CONSTRAINT chk_shoots CHECK (shoots IN ('L', 'R', 'N/A') OR shoots IS NULL),
    CONSTRAINT chk_jersey_number CHECK (jersey_number > 0 AND jersey_number < 100)
);

-- Create indexes
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_active ON players(is_active) WHERE is_active = true;
CREATE INDEX idx_players_name ON players(last_name, first_name);

-- Add comments
COMMENT ON TABLE players IS 'Hockey players roster';
COMMENT ON COLUMN players.position IS 'Position: F (Forward), D (Defense), G (Goalie)';
COMMENT ON COLUMN players.shoots IS 'Shooting hand: L (Left), R (Right), N/A (for goalies who catch)';
