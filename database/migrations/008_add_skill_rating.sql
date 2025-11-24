-- Migration: Add skill_rating to players table
-- Description: Adds skill rating field (1-10) for goal limit validation

ALTER TABLE players 
ADD COLUMN skill_rating INTEGER NOT NULL DEFAULT 5;

-- Add constraint to ensure rating is between 1 and 10
ALTER TABLE players
ADD CONSTRAINT chk_skill_rating CHECK (skill_rating >= 1 AND skill_rating <= 10);

-- Add comment
COMMENT ON COLUMN players.skill_rating IS 'Player skill rating (1-10). Skill 9+ have 2 goal limit, others have 3 goal limit';
