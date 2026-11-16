-- Member-only league polls. Votes belong to accounts, never caller-supplied names.
BEGIN;
CREATE TABLE IF NOT EXISTS member_polls (
    id BIGSERIAL PRIMARY KEY,
    question VARCHAR(180) NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closes_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS member_poll_options (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES member_polls(id) ON DELETE CASCADE,
    label VARCHAR(120) NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (poll_id, position),
    UNIQUE (poll_id, id)
);
CREATE TABLE IF NOT EXISTS member_poll_votes (
    poll_id BIGINT NOT NULL REFERENCES member_polls(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, user_id),
    FOREIGN KEY (poll_id, option_id) REFERENCES member_poll_options(poll_id, id)
);
CREATE INDEX IF NOT EXISTS idx_member_poll_votes_option ON member_poll_votes(poll_id, option_id);
COMMIT;
