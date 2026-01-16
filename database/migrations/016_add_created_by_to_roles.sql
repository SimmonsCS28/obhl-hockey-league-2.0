-- Add created_by column to roles table
ALTER TABLE roles
    ADD COLUMN created_by VARCHAR(50);

-- Add foreign key to users table
ALTER TABLE roles
    ADD CONSTRAINT fk_roles_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(username)
    ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_roles_created_by ON roles(created_by);

-- Add comment
COMMENT ON COLUMN roles.created_by IS 'Username of the user who created this role';
