-- Tournament-specific columns on the shared teams and players tables.
--
-- Tournament teams and players are ordinary rows scoped to the tournament's season, so they need a
-- few extra fields that mean nothing to a league season and stay NULL there.

-- ---------------------------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------------------------

-- Bracket seed. Populated from the final group standings when group play closes, NOT entered by
-- hand and NOT derived from draft order -- the tournament draft has no pick order. Only a format
-- with group_stage = NONE needs this set manually.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS seed INTEGER;

-- The team's GM/captain, as a players row. Distinct from the existing gm_id, which references a
-- user account: a tournament GM may have no account at all, so gm_id is set only when one is
-- linked and captain_player_id is always set.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS captain_player_id BIGINT;

-- Division label ('A', 'B', ...) when group_stage = DIVISIONS.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS pool VARCHAR(10);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS eliminated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_teams_season_seed ON teams(season_id, seed);

-- Deliberately NOT added: tournament standings columns. The existing points/wins/losses/ties/
-- goals_for/goals_against on this row are league-shaped and are written on finalize by
-- TeamStatsUpdater, which now ignores tournament games entirely. Tournament standings use a
-- different formula and are computed on read by TournamentStandingsService, so a changed formula
-- recomputes retroactively and there is no revert path to get wrong. Tournament UI must never read
-- teams.points.

COMMENT ON COLUMN teams.seed IS
    'Tournament bracket seed, derived from group standings. NULL for league teams.';
COMMENT ON COLUMN teams.captain_player_id IS
    'Tournament GM/captain as a players row. teams.gm_id is the separate user-account link, set '
    'only when that person has an account.';

-- ---------------------------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------------------------

-- A real foreign key to the user account, at last.
--
-- Players are currently linked to users by matching email strings, which is fragile enough that
-- season_goalies (migration 043) exists partly to work around it. Tournament entrants make it
-- worse: many have no account at all, and those who do may have registered under a different
-- address. Nullable because "no linked account" is a normal, permanent state for a tournament
-- player -- the tournament must work with zero accounts linked.
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- Order the player was assigned during the tournament draft. Audit/undo only: the draft is
-- operator-directed with no pick order, so this carries no turn semantics and nothing is seeded
-- from it.
ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_pick INTEGER;

CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_season ON players(season_id);

COMMENT ON COLUMN players.user_id IS
    'Optional link to a user account. NULL is normal -- many tournament entrants have no account.';
