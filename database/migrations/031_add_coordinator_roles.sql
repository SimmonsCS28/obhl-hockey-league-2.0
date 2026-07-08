-- Migration: Add coordinator roles
-- Version: 031
-- Description: Add GOALIE_COORDINATOR and REF_COORDINATOR roles. These are
-- admin-assigned only (NOT part of the self-service Account Settings allowlist).

INSERT INTO roles (name, description, is_system_role)
VALUES
    ('GOALIE_COORDINATOR', 'Schedules and confirms goalie shift assignments', true),
    ('REF_COORDINATOR', 'Schedules and confirms referee shift assignments', true)
ON CONFLICT (name) DO NOTHING;
