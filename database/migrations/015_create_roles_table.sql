-- Migration: Create roles table and add foreign key to users table
-- This migration is SAFE and backward-compatible
-- Existing users will continue to work without any changes

-- Step 1: Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Insert all existing distinct roles from users table
-- This ensures we have entries for every role currently in use
INSERT INTO roles (name, description, is_system_role)
SELECT DISTINCT 
    role,
    CASE role
        WHEN 'ADMIN' THEN 'Full system administrator access'
        WHEN 'SCOREKEEPER' THEN 'Can manage game scores and events'
        WHEN 'GM' THEN 'General Manager - team management access'
        WHEN 'REF' THEN 'Referee access'
        WHEN 'COORDINATOR' THEN 'League coordinator access'
        WHEN 'USER' THEN 'Basic user access'
        ELSE 'Custom role'
    END as description,
    CASE role
        WHEN 'ADMIN' THEN true
        WHEN 'SCOREKEEPER' THEN true
        WHEN 'GM' THEN true
        WHEN 'REF' THEN true
        WHEN 'USER' THEN true
        ELSE false
    END as is_system_role
FROM users
WHERE role IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Step 3: Ensure USER role exists (default role)
INSERT INTO roles (name, description, is_system_role)
VALUES ('USER', 'Basic user access', true)
ON CONFLICT (name) DO NOTHING;

-- Step 4: Add foreign key constraint with ON UPDATE CASCADE
-- This will:
-- 1. Validate all existing user.role values exist in roles table
-- 2. Automatically update user.role when role.name changes
-- 3. Prevent deletion of roles that have users
ALTER TABLE users
    ADD CONSTRAINT fk_users_role
    FOREIGN KEY (role)
    REFERENCES roles(name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system_role ON roles(is_system_role);

-- Add comments for documentation
COMMENT ON TABLE roles IS 'User roles for authorization and access control';
COMMENT ON COLUMN roles.name IS 'Unique role name (referenced by users.role)';
COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be deleted and require warnings when edited';
COMMENT ON COLUMN roles.description IS 'Human-readable description of role permissions';

-- Verification query (uncomment to run after migration)
-- SELECT r.name, r.description, r.is_system_role, COUNT(u.id) as user_count
-- FROM roles r
-- LEFT JOIN users u ON u.role = r.name
-- GROUP BY r.id, r.name, r.description, r.is_system_role
-- ORDER BY user_count DESC;
