-- Create GM user account for Michael Hlinka (Team Orange)
-- Password: gmpassword (must change on first login)
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('michael_hlinka', 'hlinkam@yahoo.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 25, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;
