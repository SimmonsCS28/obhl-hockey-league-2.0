-- Migration 065: push already-saved profile fields back onto the per-season players rows
--
-- Between 063 and this migration a player's own edits landed ONLY in player_profiles, while
-- the admin Players page kept reading players.birth_date / hometown / shoots from the season
-- rows -- so an admin saw blanks for exactly the people who had just filled their profile in.
-- The gateway now fans profile saves out to the rows (PlayerRowSyncService) and writes admin
-- row edits back to the profile; this is the one-time catch-up for anything saved before that
-- shipped.
--
-- COALESCE on purpose: a profile field that is NULL never blanks a row value. 063 seeded each
-- profile from the newest non-null row value, so a NULL profile field means "nothing known",
-- not "cleared". Idempotent -- re-running finds nothing left to change.

UPDATE players p
SET    birth_date = COALESCE(pp.birth_date, p.birth_date),
       hometown   = COALESCE(pp.hometown,   p.hometown),
       shoots     = COALESCE(pp.shoots,     p.shoots)
FROM   player_profiles pp
WHERE  pp.email_lower = lower(btrim(p.email))
  AND (   (pp.birth_date IS NOT NULL AND pp.birth_date IS DISTINCT FROM p.birth_date)
       OR (pp.hometown   IS NOT NULL AND pp.hometown   IS DISTINCT FROM p.hometown)
       OR (pp.shoots     IS NOT NULL AND pp.shoots     IS DISTINCT FROM p.shoots));
