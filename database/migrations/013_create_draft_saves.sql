-- Migration: Create draft_saves table for storing draft state
-- Description: Stores draft progress with status tracking for save/resume functionality

CREATE TABLE IF NOT EXISTS draft_saves (
    id BIGSERIAL PRIMARY KEY,
    season_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('saved', 'complete')),
    draft_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_draft_saves_status ON draft_saves(status);
CREATE INDEX IF NOT EXISTS idx_draft_saves_created_at ON draft_saves(created_at DESC);

-- Add comment to table
COMMENT ON TABLE draft_saves IS 'Stores draft state for save/resume functionality';
COMMENT ON COLUMN draft_saves.season_name IS 'Name of the season for this draft';
COMMENT ON COLUMN draft_saves.status IS 'Draft status: saved (in-progress) or complete (finalized)';
COMMENT ON COLUMN draft_saves.draft_data IS 'JSON data containing teams, players, colors, and sort options';
COMMENT ON COLUMN draft_saves.created_at IS 'Timestamp when draft was first created';
COMMENT ON COLUMN draft_saves.updated_at IS 'Timestamp when draft was last updated';
