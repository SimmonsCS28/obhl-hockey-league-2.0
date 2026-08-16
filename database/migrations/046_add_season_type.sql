-- Distinguishes league seasons from tournament seasons (The Conley Classic).
--
-- A tournament is backed by its own seasons row so that its teams, players, games and game_events
-- can be ordinary rows scoped to a season_id. That reuses Live Score Entry, staffing, finalize and
-- the stats pipeline wholesale instead of duplicating them against parallel tournament_* tables.
-- The tradeoff is that a tournament season must never be mistaken for a league season by the rest
-- of the app -- hence this column and, more importantly, the CHECK below.

ALTER TABLE seasons ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'LEAGUE';

ALTER TABLE seasons DROP CONSTRAINT IF EXISTS chk_season_type;
ALTER TABLE seasons ADD CONSTRAINT chk_season_type
    CHECK (type IN ('LEAGUE', 'TOURNAMENT'));

-- The single most important line in the tournament work.
--
-- SeasonContext.jsx resolves "the current season" as
--     list.find(s => s.isActive || s.status === 'active') || list[0]
-- and public/Home.jsx does the same with seasons.find(s => s.isActive). If a tournament season ever
-- reaches one of those lists while flagged active, the ENTIRE league site silently retargets to the
-- tournament -- standings, schedule, rosters, the admin topbar, the GM dashboard.
--
-- Filtering the ~22 call sites that fetch seasons is necessary but is not a guarantee: two of them
-- bypass both SeasonContext and services/api.js with a raw fetch/axios call, and nothing stops a
-- future one being added. This constraint makes the dangerous state unrepresentable in the database
-- instead of merely unlikely in the UI.
--
-- Consequence for application code: a tournament's lifecycle lives on tournaments.status, NEVER on
-- seasons.is_active. Do not "fix" a failing insert here by dropping this constraint.
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS chk_tournament_never_active;
ALTER TABLE seasons ADD CONSTRAINT chk_tournament_never_active
    CHECK (type <> 'TOURNAMENT' OR is_active = false);

-- Season lists are filtered by type on nearly every request now that GET /seasons defaults to
-- type=LEAGUE.
CREATE INDEX IF NOT EXISTS idx_seasons_type ON seasons(type);

COMMENT ON COLUMN seasons.type IS
    'LEAGUE or TOURNAMENT. Tournament seasons back a tournaments row and are hidden from league '
    'season lists by default (GET /seasons?type=LEAGUE). They must never be is_active.';


-- ---------------------------------------------------------------------------------------------
-- Fold the untracked team-constraint fix into the migration sequence.
--
-- 000_create_teams.sql declares name and abbreviation as GLOBALLY unique. That is wrong for this
-- league -- teams are named by colour (Blue, Red, Black, White...) and the same names recur every
-- season -- and it was corrected by fix_team_constraints.sql, which lives in the REPO ROOT and was
-- run by hand. It is not in database/migrations/, so it never runs on a fresh volume.
--
-- Verified 2026-08-16: both production and local dev already carry the per-season constraints, so
-- on existing databases this block is a no-op. It matters for any database built from the migration
-- sequence alone, where the global uniques would otherwise survive and make it impossible to create
-- a tournament team named "Blue" while a league season already has one.
--
-- Hibernate (api-gateway runs ddl-auto=update) has also generated its own equivalents from the Team
-- entity's @UniqueConstraint, so live databases carry redundant duplicates with generated names
-- (uk...). Those are harmless and are deliberately left alone rather than dropped by pattern match.

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_abbreviation_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'teams'::regclass AND conname = 'teams_name_season_unique'
    ) THEN
        ALTER TABLE teams ADD CONSTRAINT teams_name_season_unique UNIQUE (name, season_id);
    END IF;
END $$;

COMMENT ON CONSTRAINT teams_name_season_unique ON teams IS
    'Team names are unique within a season, not globally -- the league reuses colour names every '
    'season, and tournament teams reuse them again in their own tournament season.';
