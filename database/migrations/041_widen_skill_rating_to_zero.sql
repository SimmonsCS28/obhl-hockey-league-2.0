-- Migration: Allow skill_rating down to 0
-- Description: Goalie ratings (set by the Goalie Coordinator) need a 0 floor, not 1 —
-- widen the existing 1-10 CHECK to 0-10. Skaters keep a 1 floor at the application
-- layer (GMController/PlayerManagement); this only widens what the DB allows.
-- Idempotent: safe to re-run.

ALTER TABLE players DROP CONSTRAINT IF EXISTS chk_skill_rating;
ALTER TABLE players ADD CONSTRAINT chk_skill_rating
    CHECK (skill_rating IS NULL OR (skill_rating >= 0 AND skill_rating <= 10));
