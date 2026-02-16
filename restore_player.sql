INSERT INTO players (id, team_id, season_id, first_name, last_name, email, jersey_number, position, shoots, is_veteran, is_active, created_at, updated_at)
VALUES (16, 9, 12, 'Matt', 'Coobac', 'coobacmz@me.com', NULL, 'D', NULL, true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
