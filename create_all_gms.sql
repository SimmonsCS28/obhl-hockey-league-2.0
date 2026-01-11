-- Create GM user accounts with temporary password
-- Password for all GMs: gmpassword (they must change on first login)
-- BCrypt hash for "gmpassword": $2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO

-- Black Magic - Jon Rogers
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('jon_rogers', 'jon_rogers@trekbikes.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 23, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Blue Ballers - Chris Culver
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('chris_culver', 'chrsculver@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 21, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Emerald Elders - Jake Ruesch
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('jake_ruesch', 'jsruesch@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 22, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Grey Busch - Joshua Lind
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('joshua_lind', 'jtlind@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 18, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Licks So Good - Brian Stephenson
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('brian_stephenson', 'bstephenson014@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 20, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Purple Cobras - Tom Poole
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('tom_poole', 'tpoole95@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 15, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Red - Kyle Stephenson
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('kyle_stephenson', 'kstephenson93@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 19, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Snow Blinds - Alex Hohlstein
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('alex_hohlstein', 'alexhohlstein@yahoo.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 16, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Tancouver Tanucks - Kevin McConnaughay
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('kevin_mcconnaughay', 'kevin.mcconnaughay@gmail.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 24, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;

-- Thee Lt. Blue - Tom Behnke
INSERT INTO users (username, email, password_hash, role, team_id, is_active, must_change_password, created_at, updated_at)
VALUES ('tom_behnke', 'tbehnks11@yahoo.com', '$2a$10$jIAqogaM3c2.lHqqkGKlV.xpl02ZD/A4fRWJYesmP5jFUZpZnBrKO', 'GM', 17, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = TRUE;
