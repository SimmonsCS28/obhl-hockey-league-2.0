INSERT INTO users (username, email, password_hash, role, team_id, is_active, created_at, updated_at) 
SELECT 'testgm', 'testgm@example.com', password_hash, 'GM', 20, true, NOW(), NOW() 
FROM users WHERE id = 1
AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'testgm');
