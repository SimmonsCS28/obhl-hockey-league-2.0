-- Migration: Create goalie_profiles table
-- Description: Store goalie-specific profile data including skill ratings and statistics

CREATE TABLE IF NOT EXISTS goalie_profiles (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    skill_rating INTEGER CHECK (skill_rating >= 1 AND skill_rating <= 10),
    is_veteran BOOLEAN DEFAULT false,
    is_rookie BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    games_played_current_season INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create index for faster lookups by user
CREATE INDEX idx_goalie_profiles_user_id ON goalie_profiles(user_id);

-- Create index for active goalies
CREATE INDEX idx_goalie_profiles_active ON goalie_profiles(is_active);
