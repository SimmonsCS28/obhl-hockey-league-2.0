-- Rename the tournament off the founder's name at his request: "The Conley Classic" is now
-- "The C League Classic".
--
-- Name, slug and scoring-profile key all carry the old name and all live in data, not code, so a
-- code-only rename would leave the deployed tournament still calling itself the old thing.
--
-- The slug change breaks any /tournaments/conley-classic-YYYY link already shared. That is
-- accepted: the point of the rename is that the old name stops appearing, and a URL is the most
-- public place it appears. Nothing in the schema references slug as a foreign key -- it is a
-- lookup handle only -- so rewriting it is safe.

BEGIN;

-- Names are entered by hand in Tournament Setup, so match loosely rather than on an exact string:
-- "The Conley Classic", "Conley Classic 2026" and "the conley classic" must all be caught.
UPDATE tournaments
SET name = regexp_replace(name, 'Conley', 'C League', 'gi'),
    slug = regexp_replace(slug, 'conley', 'c-league', 'g')
WHERE name ILIKE '%conley%'
   OR slug ILIKE '%conley%';

-- The backing seasons row is named after the tournament and is what the season selector shows.
UPDATE seasons
SET name = regexp_replace(name, 'Conley', 'C League', 'gi')
WHERE type = 'TOURNAMENT'
  AND name ILIKE '%conley%';

-- Scoring profile: same numbers, new key. TournamentScoringProfile still accepts 'conley-v1' for
-- any row this misses (a restored backup), so the two can coexist without breaking standings.
ALTER TABLE tournaments ALTER COLUMN scoring_profile SET DEFAULT 'classic-v1';
UPDATE tournaments SET scoring_profile = 'classic-v1' WHERE scoring_profile = 'conley-v1';

-- Live table metadata set by 048.
COMMENT ON TABLE tournaments IS
    'One row per annual tournament (The C League Classic). Owns a seasons row of type TOURNAMENT '
    'whose teams/players/games hold the actual tournament data.';

COMMIT;
