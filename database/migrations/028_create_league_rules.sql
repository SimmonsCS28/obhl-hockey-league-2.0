-- Run this to create the league_rules table and seed with the extracted PDF content.
-- This is migration 028.

CREATE TABLE IF NOT EXISTS league_rules (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    updated_by_id INTEGER REFERENCES users(id),
    updated_by_name VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed one empty row so there is always exactly one record to GET/PUT
-- (Only inserts if table was just created and is empty)
INSERT INTO league_rules (content, updated_by_name)
SELECT '', 'System'
WHERE NOT EXISTS (SELECT 1 FROM league_rules);
