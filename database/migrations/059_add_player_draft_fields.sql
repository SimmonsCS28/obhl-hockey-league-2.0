-- Migration 059: carry draft attributes through onto the players table
--
-- Buddy picks, GM and referee flags are collected on the registration spreadsheet and
-- live on the draft board all night, but DraftService.mapPlayer() never wrote them to
-- players -- they existed only inside the draft_saves JSONB blob and were discarded at
-- finalize. So the season started with no record of who requested whom, who is a GM, or
-- who volunteered to referee, and all of it had to be re-derived by hand.
--
-- Deliberately NOT added here:
--   * a `status` column. DraftPlayerDTO.status is only ever "Veteran"/"Rookie" and the
--     frontend computes it as `player.status || (isVeteran ? 'Veteran' : 'Rookie')`. It is
--     a display alias for is_veteran, which already exists. A second source of truth for
--     the same fact is how they drift apart.
--   * a real buddy table. buddy_pick stays free text (comma-separated names, matched to
--     people by fuzzy name lookup in the UI) because that is what the registration form
--     collects. Normalizing it is a separate job.
--
-- Safe on a populated database: the two text columns are nullable, and the two boolean
-- flags are backfilled to FALSE before NOT NULL is applied.
--
-- NOTE: docker-compose mounts database/migrations at /docker-entrypoint-initdb.d, which
-- Postgres only executes against an EMPTY data volume. An existing dev or prod database
-- will not pick this up automatically -- apply it explicitly with psql.

-- These statements CONVERGE the schema rather than just adding to it, and that is
-- deliberate. stats-service runs with spring.jpa.hibernate.ddl-auto=update (see
-- stats-service application.properties and application-docker.properties), so Hibernate
-- creates these columns from Player.java the moment the new build starts -- typically
-- BEFORE anyone runs this file. Hibernate's versions are varchar(255) and NULLABLE with
-- no default, so a plain "ADD COLUMN IF NOT EXISTS" would silently no-op and leave the
-- database permanently diverged from what this migration claims. Setting the type,
-- default and NOT NULL explicitly makes the end state identical either way.

ALTER TABLE players ADD COLUMN IF NOT EXISTS buddy_pick TEXT;
ALTER TABLE players ALTER COLUMN buddy_pick TYPE TEXT;

ALTER TABLE players ADD COLUMN IF NOT EXISTS buddy_email VARCHAR(255);

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_gm BOOLEAN;
UPDATE players SET is_gm = FALSE WHERE is_gm IS NULL;
ALTER TABLE players ALTER COLUMN is_gm SET DEFAULT FALSE;
ALTER TABLE players ALTER COLUMN is_gm SET NOT NULL;

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_ref BOOLEAN;
UPDATE players SET is_ref = FALSE WHERE is_ref IS NULL;
ALTER TABLE players ALTER COLUMN is_ref SET DEFAULT FALSE;
ALTER TABLE players ALTER COLUMN is_ref SET NOT NULL;

COMMENT ON COLUMN players.buddy_pick IS
    'Free-text, comma-separated names of the people this player asked to be placed with, '
    'straight from the registration form. Resolved to actual players by name matching in '
    'the draft tool; unmatched names are simply not honoured.';

COMMENT ON COLUMN players.buddy_email IS
    'Optional resolved email of a buddy pick. Populated only when the draft tool could '
    'match the free-text name to a real registrant.';

COMMENT ON COLUMN players.is_gm IS
    'Whether this player is a GM for their team this season. teams.gm_id also exists but '
    'is overloaded -- its migration documents it as a user account id while the league '
    'draft writes a players.id into it -- so this flag is the reliable read path.';

COMMENT ON COLUMN players.is_ref IS
    'Whether this player volunteered to referee this season, per the registration form.';

-- Finding the GMs for a season is the query the draft tool and roster screens actually run.
CREATE INDEX IF NOT EXISTS idx_players_season_is_gm
    ON players (season_id) WHERE is_gm = TRUE;
