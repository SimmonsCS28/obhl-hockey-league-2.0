-- Migration: Create goalie_profiles table
-- Description: Store goalie-specific profile data including skill ratings and statistics

CREATE TABLE IF NOT EXISTS goalie_profiles (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    skill_rating VARCHAR(20),  -- e.g., 'A', 'B', 'C', 'Beginner', 'Intermediate', 'Advanced'
    is_veteran BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    games_played_current_season INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by user
CREATE INDEX idx_goalie_profiles_user_id ON goalie_profiles(user_id);

-- Create index for active goalies
CREATE INDEX idx_goalie_profiles_active ON goalie_profiles(is_active);
