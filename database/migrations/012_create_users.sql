-- Create users table for authentication
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    team_id BIGINT REFERENCES teams(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_team_id ON users(team_id);

-- Add comments
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON COLUMN users.role IS 'User role: ADMIN (full access), GM (team management), USER (read-only)';
COMMENT ON COLUMN users.team_id IS 'For GM role: which team they manage';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
