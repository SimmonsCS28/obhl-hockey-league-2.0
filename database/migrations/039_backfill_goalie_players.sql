-- Migration: Backfill player profiles for existing goalies
-- Description: Goalies are treated like regular players (position='G') so they show up
-- on the Players page and can carry a skill_rating like anyone else. This backfills a
-- players row for every GOALIE-role user in the active season who doesn't already have
-- one, carrying over any existing goalie_profiles.skill_rating if set.
-- Idempotent: safe to re-run (this migration runner has no version tracking and
-- re-executes every file on each run).

ALTER TABLE players ALTER COLUMN skill_rating DROP NOT NULL;

-- players.email/season_id/is_veteran exist in production today (added via Hibernate
-- ddl-auto=update, not a tracked migration — see Player.java) but were never captured
-- in a migration file. Add them defensively here so this migration is self-contained
-- on a fresh database too.
ALTER TABLE players ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE players ADD COLUMN IF NOT EXISTS season_id BIGINT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_veteran BOOLEAN DEFAULT false;

DO $$
DECLARE
    active_season_id BIGINT;
BEGIN
    SELECT id INTO active_season_id FROM seasons WHERE is_active = true LIMIT 1;

    IF active_season_id IS NULL THEN
        RAISE EXCEPTION 'No active season found — aborting goalie backfill';
    END IF;

    INSERT INTO players (team_id, first_name, last_name, position, is_active, skill_rating, email, season_id)
    SELECT NULL, u.first_name, u.last_name, 'G', true, gp.skill_rating, u.email, active_season_id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.name = 'GOALIE'
    LEFT JOIN goalie_profiles gp ON gp.user_id = u.id
    WHERE u.email <> 'black_night91@yahoo.com'
      AND u.username <> 'testGoalie'
      AND NOT EXISTS (
          SELECT 1 FROM players p WHERE p.email = u.email AND p.season_id = active_season_id
      );
END $$;
