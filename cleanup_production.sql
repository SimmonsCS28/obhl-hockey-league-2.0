-- Cleanup script: Remove all data not tied to season 12
-- This will delete orphaned teams, players, and seasons from failed draft attempts

BEGIN;

-- Show what will be deleted (for verification)
SELECT 'Seasons to delete: ' || COUNT(*) FROM seasons WHERE id != 12;
SELECT 'Teams to delete: ' || COUNT(*) FROM teams WHERE season_id != 12;
SELECT 'Players to delete: ' || COUNT(*) FROM players WHERE season_id != 12;

-- Delete in order to respect foreign keys
-- 1. Delete player stats (if any exist for old seasons)
DELETE FROM player_stats WHERE player_id IN (SELECT id FROM players WHERE season_id != 12);
DELETE FROM goalie_stats WHERE player_id IN (SELECT id FROM players WHERE season_id != 12);

-- 2. Delete game events for games in old seasons
DELETE FROM game_events WHERE game_id IN (SELECT id FROM games WHERE season_id != 12);

-- 3. Delete games for old seasons
DELETE FROM games WHERE season_id != 12;

-- 4. Delete players for old seasons
DELETE FROM players WHERE season_id != 12;

-- 5. Delete teams for old seasons
DELETE FROM teams WHERE season_id != 12;

-- 6. Delete old seasons
DELETE FROM seasons WHERE id != 12;

-- Also delete old draft saves (keep only the successful one)
DELETE FROM draft_saves WHERE id NOT IN (SELECT id FROM draft_saves ORDER BY created_at DESC LIMIT 1);

-- Show final counts
SELECT 'Remaining seasons: ' || COUNT(*) FROM seasons;
SELECT 'Remaining teams: ' || COUNT(*) FROM teams;
SELECT 'Remaining players: ' || COUNT(*) FROM players;

COMMIT;
