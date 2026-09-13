-- Migration 063: person-level player profiles (photo, birth date, hometown, height, weight, shoots)
--
-- players is one row per person PER SEASON. Every draft finalize builds fresh rows and
-- DraftService.mapPlayer() copies only name / email / position / skill / veteran / buddy /
-- GM / ref -- so anything a player typed into birth_date or hometown last season is gone
-- this season. A profile the player owns has to live somewhere that survives the draft.
--
-- That somewhere is keyed by LOWERCASED EMAIL, not user_id:
--   * email is the only identity that is carried into each new season row;
--   * players.user_id is NULL for every league player (only the tournament draft writes it);
--   * players.email is case-sensitive, so "Bob@x.com" and "bob@x.com" are the same person
--     across two seasons -- lower() is what makes them one profile;
--   * players who registered but never created an account still get a card (and a
--     backfilled profile); they just can't edit it until they sign up.
-- user_id is still recorded when it can be resolved, for future joins -- it is never the
-- lookup key.
--
-- After this, players.birth_date / hometown / shoots / height_inches / weight_lbs are
-- LEGACY per-season copies. The card reads COALESCE(profile.x, season_row.x); the player's
-- own edits write to the profile only. The admin Player Management form still writes the
-- legacy columns -- that is documented, not fixed, here.
--
-- Photos are NOT in the database. Like highlights (056), only a storage key is kept; the
-- bytes sit under app.media.root (the highlight_media Docker volume) in players/. They are
-- not covered by pg_dump.
--
-- NOTE: docker-compose mounts database/migrations at /docker-entrypoint-initdb.d, which
-- Postgres only executes against an EMPTY data volume. An existing dev or prod database
-- will not pick this up automatically -- apply it explicitly with psql.

-- These statements CONVERGE the schema (see 059). api-gateway runs with
-- spring.jpa.hibernate.ddl-auto=update, so Hibernate creates this table from
-- PlayerProfile.java the moment the new build starts -- typically BEFORE this file runs.
-- Every statement below is therefore idempotent and states the intended type/constraint
-- explicitly so the end state is identical either way.

CREATE TABLE IF NOT EXISTS player_profiles (
    id                 BIGSERIAL PRIMARY KEY,
    email_lower        VARCHAR(255) NOT NULL,
    user_id            BIGINT,
    birth_date         DATE,
    hometown           VARCHAR(100),
    height_inches      INTEGER,
    weight_lbs         INTEGER,
    shoots             VARCHAR(1),
    photo_key          VARCHAR(255),
    photo_content_type VARCHAR(100),
    photo_size_bytes   BIGINT,
    photo_updated_at   TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE player_profiles ALTER COLUMN email_lower TYPE VARCHAR(255);
ALTER TABLE player_profiles ALTER COLUMN email_lower SET NOT NULL;
ALTER TABLE player_profiles ALTER COLUMN hometown TYPE VARCHAR(100);
ALTER TABLE player_profiles ALTER COLUMN shoots TYPE VARCHAR(1);
ALTER TABLE player_profiles ALTER COLUMN photo_key TYPE VARCHAR(255);
ALTER TABLE player_profiles ALTER COLUMN photo_content_type TYPE VARCHAR(100);
ALTER TABLE player_profiles ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE player_profiles ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_email_lower ON player_profiles (email_lower);
CREATE INDEX IF NOT EXISTS idx_player_profiles_user ON player_profiles (user_id);

DO $$
BEGIN
    ALTER TABLE player_profiles
        ADD CONSTRAINT fk_player_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE player_profiles
        ADD CONSTRAINT chk_player_profiles_email_lower CHECK (email_lower = lower(email_lower));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE player_profiles
        ADD CONSTRAINT chk_player_profiles_shoots CHECK (shoots IS NULL OR shoots IN ('L', 'R'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE player_profiles
        ADD CONSTRAINT chk_player_profiles_height CHECK (height_inches IS NULL OR height_inches BETWEEN 48 AND 96);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE player_profiles
        ADD CONSTRAINT chk_player_profiles_weight CHECK (weight_lbs IS NULL OR weight_lbs BETWEEN 80 AND 400);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: one profile per distinct lowercased email. For each column take the most
-- recent NON-NULL value across that person's season rows (newest season first), so a
-- hometown typed two seasons ago is not lost just because the latest row is blank.
-- The 'N/A' shoots sentinel from 003's chk_shoots is dropped -- the profile only knows
-- L/R. user_id is linked through the case-insensitive users.email index (044); retired
-- 'retired+...' accounts are inactive and never link. Re-running is a no-op.
WITH person AS (
    SELECT lower(btrim(p.email)) AS email_lower,
           (array_agg(p.birth_date    ORDER BY p.season_id DESC NULLS LAST, p.id DESC) FILTER (WHERE p.birth_date IS NOT NULL))[1] AS birth_date,
           (array_agg(p.hometown      ORDER BY p.season_id DESC NULLS LAST, p.id DESC) FILTER (WHERE p.hometown IS NOT NULL AND btrim(p.hometown) <> ''))[1] AS hometown,
           (array_agg(p.height_inches ORDER BY p.season_id DESC NULLS LAST, p.id DESC) FILTER (WHERE p.height_inches BETWEEN 48 AND 96))[1] AS height_inches,
           (array_agg(p.weight_lbs    ORDER BY p.season_id DESC NULLS LAST, p.id DESC) FILTER (WHERE p.weight_lbs BETWEEN 80 AND 400))[1] AS weight_lbs,
           (array_agg(p.shoots        ORDER BY p.season_id DESC NULLS LAST, p.id DESC) FILTER (WHERE p.shoots IN ('L', 'R')))[1] AS shoots
    FROM players p
    WHERE p.email IS NOT NULL
      AND btrim(p.email) <> ''
      AND p.email NOT LIKE '%@obhl.invalid'
    GROUP BY lower(btrim(p.email))
),
account AS (
    -- one active account per lowercased email (044 guarantees at most one; ORDER BY is belt-and-braces)
    SELECT DISTINCT ON (lower(u.email)) lower(u.email) AS email_lower, u.id AS user_id
    FROM users u
    WHERE u.is_active
    ORDER BY lower(u.email), u.id
)
INSERT INTO player_profiles (email_lower, user_id, birth_date, hometown, height_inches, weight_lbs, shoots)
SELECT person.email_lower, account.user_id,
       person.birth_date, person.hometown, person.height_inches, person.weight_lbs, person.shoots
FROM person
LEFT JOIN account ON account.email_lower = person.email_lower
ON CONFLICT (email_lower) DO NOTHING;

COMMENT ON TABLE player_profiles IS
    'Person-level (cross-season) player profile keyed by lowercased email. '
    'players.birth_date/hometown/shoots/height_inches/weight_lbs are legacy per-season '
    'copies read only as a fallback when the profile value is null.';

COMMENT ON COLUMN player_profiles.email_lower IS
    'lower(btrim(players.email)). The only identity that survives a draft; NOT user_id.';

COMMENT ON COLUMN player_profiles.photo_key IS
    'Server-generated <uuid>.jpg under app.media.root/players/. Not in the database, not in pg_dump.';
