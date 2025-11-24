-- Migration: Create leagues table
-- Description: Tracks different leagues/divisions/conferences

CREATE TABLE IF NOT EXISTS leagues (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    description TEXT,
    league_type VARCHAR(20) NOT NULL DEFAULT 'division',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_league_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT chk_league_type CHECK (league_type IN ('division', 'conference', 'league')),
    CONSTRAINT uq_league_season_name UNIQUE (season_id, name)
);

-- Create indexes
CREATE INDEX idx_leagues_season ON leagues(season_id);
CREATE INDEX idx_leagues_type ON leagues(league_type);

-- Add comments
COMMENT ON TABLE leagues IS 'League divisions and conferences';
COMMENT ON COLUMN leagues.league_type IS 'Type: division, conference, or league';
