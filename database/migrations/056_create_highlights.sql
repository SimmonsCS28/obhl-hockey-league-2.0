-- Migration: Create highlights table
-- Version: 056
-- Description: Weekly video highlight shown on the public home page. Clips are 30s
-- mp4s downloaded from Live Barn and uploaded through the admin console.
--
-- This is the first feature in the app that PERSISTS an uploaded file. The bytes do
-- NOT live in this table — only a storage_key (a server-generated UUID filename).
-- The actual mp4 and its poster image live on disk in the api-gateway container at
-- ${app.media.root} (a named Docker volume, `highlight_media`). Two consequences:
--   1. A pg_dump does NOT back up the videos. They need their own backup step.
--   2. Deleting a row must also delete the file — see HighlightStorageService.
--
-- The feature is owned by api-gateway rather than league-service on purpose:
-- multipart bodies cannot traverse the gateway's proxy controllers (they read
-- bodies as String — see TECHNICAL_DEBT.md), so the gateway has to be the origin.
--
-- youtube_url is nullable and unused at launch. It exists so a clip can carry a
-- companion link once the league starts mirroring highlights to a YouTube channel,
-- without needing another migration.

CREATE TABLE IF NOT EXISTS highlights (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    season_id BIGINT REFERENCES seasons(id) ON DELETE SET NULL,
    week INTEGER,

    -- Video: server-generated UUID filename, never the client's filename.
    storage_key VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    content_type VARCHAR(100),
    file_size_bytes BIGINT,

    -- Poster: the still frame shown before playback. Usually captured from the
    -- video client-side at upload time, but an admin can override with their own
    -- image. Nullable — a highlight without one falls back to the browser's
    -- first-frame preview.
    poster_key VARCHAR(255),
    poster_content_type VARCHAR(100),
    poster_size_bytes BIGINT,

    youtube_url VARCHAR(500),

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by BIGINT,
    created_by_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The public home page asks exactly one question: "newest active highlight?"
CREATE INDEX IF NOT EXISTS idx_highlights_active_created
    ON highlights (is_active, created_at DESC);
