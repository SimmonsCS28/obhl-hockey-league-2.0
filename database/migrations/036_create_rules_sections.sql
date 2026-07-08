-- Migration: Create rules_sections table
-- Version: 036
-- Description: Move League Rules from a single HTML blob (league_rules.content) to an
-- ordered list of sections (v4 §5). Each section has a group (gen|game|mou), a title
-- (drives the public page's grouped table-of-contents), rich-text HTML content, and a
-- sort order. The league_rules row is kept as the publish-metadata singleton
-- (updated_at/updated_by_name = published_at/published_by).

CREATE TABLE IF NOT EXISTS rules_sections (
    id BIGSERIAL PRIMARY KEY,
    section_group VARCHAR(10) NOT NULL DEFAULT 'gen',   -- gen | game | mou
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_sections_order ON rules_sections(sort_order);

-- Preserve existing content: migrate the current single blob into one initial section
-- (the admin can then split it into proper sections via the sectioned Rules Editor).
INSERT INTO rules_sections (section_group, title, content, sort_order)
SELECT 'gen', 'League Rules', content, 0
FROM league_rules
WHERE content IS NOT NULL AND content <> ''
  AND NOT EXISTS (SELECT 1 FROM rules_sections);
