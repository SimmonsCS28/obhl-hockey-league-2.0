BEGIN;
CREATE TABLE IF NOT EXISTS season_recaps (
    season_id BIGINT PRIMARY KEY REFERENCES seasons(id) ON DELETE CASCADE,
    recap_json TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    generated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
COMMIT;
