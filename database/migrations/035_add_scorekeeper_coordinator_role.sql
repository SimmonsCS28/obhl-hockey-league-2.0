-- Migration: Add scorekeeper coordinator role
-- Version: 035
-- Description: Add SCOREKEEPER_COORDINATOR (its own role, parallel to GOALIE_COORDINATOR
-- and REF_COORDINATOR). Admin-assigned only (NOT part of the self-service allowlist).

INSERT INTO roles (name, description, is_system_role)
VALUES
    ('SCOREKEEPER_COORDINATOR', 'Schedules and confirms scorekeeper shift assignments', true)
ON CONFLICT (name) DO NOTHING;
