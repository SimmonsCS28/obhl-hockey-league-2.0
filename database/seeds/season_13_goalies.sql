-- Seed: Summer 2026 (season_id 13) goalie roster
-- 12 full-time goalies (is_fulltime = true) + the other 10 rated goalies as substitutes.
-- Idempotent: re-running updates is_fulltime to match this file.

INSERT INTO season_goalies (season_id, user_id, is_fulltime) VALUES
    -- Full-time (12)
    (13, 138, true),   -- Todd Borchert (7)
    (13, 147, true),   -- Cole Mitchell (7)
    (13, 154, true),   -- Mason LeFebvre (7)
    (13, 145, true),   -- Erich Manthey (6)
    (13, 213, true),   -- Luke Frelke (6)
    (13, 146, true),   -- Patrick Martin (5)
    (13, 141, true),   -- Chris Erickson (4)
    (13, 139, true),   -- Steve Braun (3)
    (13, 140, true),   -- Randy Coleman (3)
    (13, 144, true),   -- Rhiannon Lucente (3)
    (13, 150, true),   -- Amy Vincent (2)
    (13, 164, true),   -- Tyler Madro (0)
    -- Substitutes (other 10 rated goalies)
    (13, 153, false),  -- Seth Blahnik (10)
    (13, 142, false),  -- Austin Hutchison (6)
    (13, 151, false),  -- Daniel Zellmer (6)
    (13, 152, false),  -- Luke Kneubuehl (5)
    (13, 148, false),  -- Ethan Ryan (5)
    (13, 162, false),  -- Matthew Holschuh (4)
    (13, 143, false),  -- Jason Kenney (4)
    (13, 149, false),  -- Eric Twilegar (4)
    (13, 165, false),  -- Jake Cauley (3)
    (13, 163, false)   -- Bryan Reiter (3)
ON CONFLICT (season_id, user_id) DO UPDATE SET is_fulltime = EXCLUDED.is_fulltime, updated_at = CURRENT_TIMESTAMP;
