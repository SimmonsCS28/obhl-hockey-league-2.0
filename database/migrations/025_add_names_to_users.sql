-- Migration: Add first_name and last_name to users table
-- Description: Allows users to have a display name (first + last) for dashboards, schedules, etc.
-- Date: 2026-03-04

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Add comments
COMMENT ON COLUMN users.first_name IS 'User first name for display purposes';
COMMENT ON COLUMN users.last_name IS 'User last name for display purposes';
