-- Per-coordinator, per-role notification preferences.
--
-- One row per (user, coordinator role) because a person can run more than one role and reasonably
-- want different answers for each -- decline notices for referees, nothing at all for scorekeepers.
--
-- Absence of a row means "defaults", so this table only ever holds deliberate choices. Reading code
-- must treat a missing row as {decline: true, confirm: false, no override} rather than requiring a
-- backfill for every current and future coordinator.
--
-- There is deliberately no column for the drop notice. Someone giving up a shift they had confirmed
-- is the one notice that cannot be switched off: a silent drop means a person simply does not turn
-- up to a game that may already be published.

CREATE TABLE IF NOT EXISTS coordinator_notification_prefs (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- GOALIE | REF | SCOREKEEPER -- the shift role, matching shift_assignments.role, NOT the
    -- coordinator role name. Keeps lookups aligned with the assignment being notified about.
    role                VARCHAR(20) NOT NULL,
    notify_on_decline   BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_confirm   BOOLEAN NOT NULL DEFAULT FALSE,
    -- NULL = send to the account's own email. Never store a copy of users.email here: it would go
    -- stale the moment someone changes their address.
    email_override      VARCHAR(255),
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One set of preferences per person per role.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coord_notify_prefs_user_role
    ON coordinator_notification_prefs (user_id, role);

-- Recipient resolution reads these by role on every decline and drop.
CREATE INDEX IF NOT EXISTS idx_coord_notify_prefs_role
    ON coordinator_notification_prefs (role);
