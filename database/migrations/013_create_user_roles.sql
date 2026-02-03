-- Create roles lookup table for referential integrity
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    description TEXT
);

-- Insert standard roles
INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Full system access'),
    ('GM', 'Team management access'),
    ('PLAYER', 'Player access'),
    ('REFEREE', 'Referee scheduling and assignment'),
    ('SCOREKEEPER', 'Scorekeeper scheduling and game scoring'),
    ('GOALIE', 'Goalie scheduling and assignment'),
    ('COORDINATOR', 'League coordination access'),
    ('USER', 'Basic user access');

-- Create junction table for many-to-many user-role relationship
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- Migrate existing single-role data to junction table
-- This ensures all existing users maintain their current role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = u.role
WHERE u.role IS NOT NULL;

-- Add comments
COMMENT ON TABLE roles IS 'Lookup table for available user roles';
COMMENT ON TABLE user_roles IS 'Junction table for many-to-many user-role relationships';
COMMENT ON COLUMN user_roles.assigned_at IS 'Timestamp when the role was assigned to the user';
