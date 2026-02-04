-- Migration: Create goalie_unavailability table
-- Description: Track dates when goalies are not available to play

CREATE TABLE IF NOT EXISTS goalie_unavailability (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unavailable_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_date UNIQUE(user_id, unavailable_date)
);

-- Create index for faster lookups by user
CREATE INDEX idx_goalie_unavailability_user_id ON goalie_unavailability(user_id);

-- Create index for date range queries
CREATE INDEX idx_goalie_unavailability_date ON goalie_unavailability(unavailable_date);
