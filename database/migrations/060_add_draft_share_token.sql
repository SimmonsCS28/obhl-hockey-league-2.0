-- A share token so GMs can follow the draft on their own devices, read-only.
--
-- GMs cannot be identified by role here: players.is_gm is only written at finalize, which happens
-- AFTER the draft they want to watch. So the scope comes from an unguessable link rather than from
-- who the viewer is.
--
-- Only the HASH is stored. The raw token is returned to the operator once, when it is minted, and
-- is never recoverable afterwards -- same posture as shift_assignments.confirm_token_hash.
--
-- SHA-256 rather than bcrypt, deliberately, and for two reasons. The token is 32 bytes of
-- CSPRNG output, not a low-entropy password, so a slow hash buys nothing against brute force.
-- And this column is read on every poll by every watching GM; bcrypt cannot be indexed, so it
-- would force a row scan plus a deliberately-slow compare on each one. A fixed-width digest in a
-- unique index makes the lookup O(1).
--
-- NULL means sharing is off. Revoking is therefore just setting it back to NULL, which
-- immediately invalidates every link already handed out.

-- VARCHAR, not CHAR. A SHA-256 hex digest is always exactly 64 characters so CHAR(64) looks
-- like the tighter choice, but Postgres reports CHAR as `bpchar` and league-service runs
-- spring.jpa.hibernate.ddl-auto=validate: it expects varchar(64) for a String column and refuses
-- to start against bpchar. Getting this wrong does not cause a subtle bug, it stops the service
-- booting -- which during a draft means the board is gone. (Found exactly this way in testing.)
ALTER TABLE draft_saves ADD COLUMN IF NOT EXISTS share_token_hash VARCHAR(64);

-- Converge a database that already took the CHAR(64) form above. No-op where it is already
-- varchar. Same convergent style as migration 059, and for the same reason: these are applied
-- by hand and may have been run from an earlier version of this file.
ALTER TABLE draft_saves ALTER COLUMN share_token_hash TYPE VARCHAR(64);
ALTER TABLE draft_saves ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMP;

-- Unique so a token can never resolve to two drafts, and so the lookup is an index hit.
-- Partial, because NULL is the common state (most drafts are never shared) and several NULLs
-- must be allowed to coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_saves_share_token
    ON draft_saves (share_token_hash)
    WHERE share_token_hash IS NOT NULL;

COMMENT ON COLUMN draft_saves.share_token_hash IS
    'SHA-256 hex of the read-only share token. NULL = sharing off. Raw token is never stored.';
COMMENT ON COLUMN draft_saves.share_created_at IS
    'When the current share token was minted. Reset each time the token is rotated.';
