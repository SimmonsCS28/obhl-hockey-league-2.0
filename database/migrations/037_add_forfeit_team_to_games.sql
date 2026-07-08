-- Migration: Add forfeit tracking to games
-- Description: Allows marking a game as forfeited by one team when finalizing; the opposing team is recorded as the winner

ALTER TABLE games ADD COLUMN forfeit_team_id BIGINT;

ALTER TABLE games ADD CONSTRAINT fk_game_forfeit_team FOREIGN KEY (forfeit_team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE games ADD CONSTRAINT chk_forfeit_team CHECK (forfeit_team_id IS NULL OR forfeit_team_id = home_team_id OR forfeit_team_id = away_team_id);

COMMENT ON COLUMN games.forfeit_team_id IS 'If set, the team that forfeited this game; the opposing team is recorded as the winner (1-0)';
