-- Clear all test data from the database
-- This script truncates all tables in the correct order to avoid foreign key violations

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Clear game-related data first
TRUNCATE TABLE game_events CASCADE;
TRUNCATE TABLE games CASCADE;

-- Clear player stats
TRUNCATE TABLE goalie_stats CASCADE;
TRUNCATE TABLE player_stats CASCADE;

-- Clear players
TRUNCATE TABLE players CASCADE;

-- Clear teams
TRUNCATE TABLE teams CASCADE;

-- Clear seasons
TRUNCATE TABLE seasons CASCADE;

-- Clear leagues
TRUNCATE TABLE leagues CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Reset sequences
ALTER SEQUENCE IF EXISTS leagues_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seasons_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS teams_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS players_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS games_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS game_events_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS player_stats_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS goalie_stats_id_seq RESTART WITH 1;

SELECT 'Database cleared successfully!' AS status;
