-- Migration 064: let a player use their profile photo as their dashboard avatar
--
-- The profile card always shows the photo. The dashboard welcome-banner badge (and any
-- other initials avatar that opts in later) shows initials by default; this flag is the
-- player's own choice to put their photo there instead. Opt-in, so uploading a photo for
-- the card never silently changes how a player appears elsewhere.
--
-- Converge pattern (see 059/063): api-gateway runs ddl-auto=update and will add this
-- column from PlayerProfile.java as nullable with no default before this file runs.

ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS use_photo_avatar BOOLEAN;
UPDATE player_profiles SET use_photo_avatar = FALSE WHERE use_photo_avatar IS NULL;
ALTER TABLE player_profiles ALTER COLUMN use_photo_avatar SET DEFAULT FALSE;
ALTER TABLE player_profiles ALTER COLUMN use_photo_avatar SET NOT NULL;

COMMENT ON COLUMN player_profiles.use_photo_avatar IS
    'Player opted to show their profile photo in place of initials on their dashboard avatar. Meaningless without photo_key.';
