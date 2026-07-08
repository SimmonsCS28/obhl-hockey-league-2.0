-- Migration: Create shift_assignments table
-- Version: 033
-- Description: Coordinator proposal/confirmation workflow. A shift_assignment is a
-- PROPOSED staff assignment to a specific game slot that the goalie/ref confirms or
-- declines. When the coordinator publishes, CONFIRMED rows are written onto the
-- game's goalie1_id/goalie2_id/referee1_id/referee2_id columns (game-service).

CREATE TABLE IF NOT EXISTS shift_assignments (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL,
    season_id BIGINT,
    role VARCHAR(20) NOT NULL,              -- GOALIE | REF
    slot SMALLINT NOT NULL,                 -- 1 or 2
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',  -- PROPOSED | CONFIRMED | DECLINED
    published BOOLEAN NOT NULL DEFAULT false,
    confirm_token_hash VARCHAR(255),
    token_expires_at TIMESTAMP,
    decline_reason VARCHAR(500),
    assigned_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    CONSTRAINT unique_game_role_slot UNIQUE (game_id, role, slot)
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_game ON shift_assignments(game_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_season_role ON shift_assignments(season_id, role);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_status ON shift_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_token ON shift_assignments(confirm_token_hash);
