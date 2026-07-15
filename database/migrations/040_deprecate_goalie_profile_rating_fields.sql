-- Migration: Deprecate goalie_profiles rating/win/loss columns
-- Description: Goalies now have a real players row (see 039_backfill_goalie_players.sql)
-- and use players.skill_rating like any other player. goalie_profiles.skill_rating/
-- wins/losses duplicated this (keyed by user_id instead of player_id) and were only
-- ever written once at signup/import, never updated elsewhere. Drop them.
-- is_veteran/is_rookie/is_active/games_played_current_season are left alone (out of
-- scope — used elsewhere / harmlessly unused).
-- Idempotent: safe to re-run.

ALTER TABLE goalie_profiles DROP COLUMN IF EXISTS skill_rating;
ALTER TABLE goalie_profiles DROP COLUMN IF EXISTS wins;
ALTER TABLE goalie_profiles DROP COLUMN IF EXISTS losses;
