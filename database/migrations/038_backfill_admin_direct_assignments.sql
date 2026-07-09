-- Migration: Backfill shift_assignments for admin-direct-assigned games
-- Version: 038
-- Description: The Admin Assignments page used to write straight to
-- games.goalie1_id/goalie2_id/referee1_id/referee2_id/scorekeeper_id without
-- creating a shift_assignments row. Those assignments never showed up on the
-- Coordinator Console or the assigned user's dashboard, since both read only
-- from shift_assignments. Insert a CONFIRMED + published row for every game
-- staff column that's set but has no matching shift_assignments row, so
-- existing admin-made assignments become visible retroactively.

INSERT INTO shift_assignments (game_id, season_id, role, slot, user_id, status, published, created_at, updated_at, responded_at)
SELECT g.id, g.season_id, 'GOALIE', 1, g.goalie1_id, 'CONFIRMED', true, now(), now(), now()
FROM games g
WHERE g.goalie1_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM shift_assignments sa
      WHERE sa.game_id = g.id AND sa.role = 'GOALIE' AND sa.slot = 1
  );

INSERT INTO shift_assignments (game_id, season_id, role, slot, user_id, status, published, created_at, updated_at, responded_at)
SELECT g.id, g.season_id, 'GOALIE', 2, g.goalie2_id, 'CONFIRMED', true, now(), now(), now()
FROM games g
WHERE g.goalie2_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM shift_assignments sa
      WHERE sa.game_id = g.id AND sa.role = 'GOALIE' AND sa.slot = 2
  );

INSERT INTO shift_assignments (game_id, season_id, role, slot, user_id, status, published, created_at, updated_at, responded_at)
SELECT g.id, g.season_id, 'REF', 1, g.referee1_id, 'CONFIRMED', true, now(), now(), now()
FROM games g
WHERE g.referee1_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM shift_assignments sa
      WHERE sa.game_id = g.id AND sa.role = 'REF' AND sa.slot = 1
  );

INSERT INTO shift_assignments (game_id, season_id, role, slot, user_id, status, published, created_at, updated_at, responded_at)
SELECT g.id, g.season_id, 'REF', 2, g.referee2_id, 'CONFIRMED', true, now(), now(), now()
FROM games g
WHERE g.referee2_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM shift_assignments sa
      WHERE sa.game_id = g.id AND sa.role = 'REF' AND sa.slot = 2
  );

INSERT INTO shift_assignments (game_id, season_id, role, slot, user_id, status, published, created_at, updated_at, responded_at)
SELECT g.id, g.season_id, 'SCOREKEEPER', 1, g.scorekeeper_id, 'CONFIRMED', true, now(), now(), now()
FROM games g
WHERE g.scorekeeper_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM shift_assignments sa
      WHERE sa.game_id = g.id AND sa.role = 'SCOREKEEPER' AND sa.slot = 1
  );
