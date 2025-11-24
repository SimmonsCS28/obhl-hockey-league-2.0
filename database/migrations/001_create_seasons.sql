-- Migration: Create seasons table
-- Description: Tracks hockey league seasons with start/end dates and status

CREATE TABLE IF NOT EXISTS seasons (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_season_status CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    CONSTRAINT chk_season_dates CHECK (end_date > start_date)
);

-- Create index for active season lookups
CREATE INDEX idx_seasons_status ON seasons(status);
CREATE INDEX idx_seasons_active ON seasons(is_active) WHERE is_active = true;

-- Add comment
COMMENT ON TABLE seasons IS 'Hockey league seasons';
COMMENT ON COLUMN seasons.status IS 'Season status: upcoming, active, completed, cancelled';
