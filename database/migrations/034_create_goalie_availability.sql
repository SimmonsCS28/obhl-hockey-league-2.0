-- Migration: Create goalie_availability table
-- Version: 034
-- Description: Positive, per-week goalie availability for the v3 Goalie Availability page.
-- A goalie marks each week AVAILABLE or UNAVAILABLE (no row = "not set"). This is distinct
-- from the date-based goalie_unavailability table (kept for now, no longer surfaced in the v3 UI).
-- The coordinator's goalie pool reads this to see who's available for a given week.

CREATE TABLE IF NOT EXISTS goalie_availability (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id BIGINT NOT NULL,
    week INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,            -- AVAILABLE | UNAVAILABLE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_goalie_avail_user_season_week UNIQUE (user_id, season_id, week)
);

CREATE INDEX IF NOT EXISTS idx_goalie_availability_season_week ON goalie_availability(season_id, week);
CREATE INDEX IF NOT EXISTS idx_goalie_availability_user_season ON goalie_availability(user_id, season_id);
