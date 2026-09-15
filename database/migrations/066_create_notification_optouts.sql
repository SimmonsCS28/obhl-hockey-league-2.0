-- Self-service opt-outs from broadcast emails, starting with the goalie "spot open" alert.
--
-- A row means "opted out"; no row means the default, which is subscribed. Presence-only on purpose:
-- the recipient list for a broadcast is "everyone in the pool minus these rows", so nobody has to be
-- backfilled when they join the pool, and a person who never touched the setting has no row at all.
--
-- Keyed by user rather than by season_goalies row because the whole point is the substitute who
-- quietly stopped playing two seasons ago: their unsubscribe has to survive the next season's roster
-- carry-forward, which recreates their season_goalies row.
--
-- The link in the email carries no stored token. It is the user id plus an HMAC over (user id, kind)
-- derived from the JWT secret, so it never expires, needs no column, and a rotated JWT secret
-- invalidates every old link at once (they just get "this link is no longer valid" and can use the
-- Account Settings toggle instead).
--
-- kind: GOALIE_OPEN_SPOT -- a goalie declined or dropped a shift, or the coordinator pressed
--                          "Alert Pool" on an open net; sent to the whole season goalie pool.

CREATE TABLE IF NOT EXISTS notification_optouts (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        VARCHAR(40) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One opt-out per person per kind; resubscribing deletes the row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_optouts_user_kind
    ON notification_optouts (user_id, kind);

-- Every broadcast reads the full opt-out set for its kind.
CREATE INDEX IF NOT EXISTS idx_notification_optouts_kind
    ON notification_optouts (kind);
