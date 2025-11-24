-- Seed Data for OBHL Database
-- Description: Sample data for testing and development

-- Insert sample seasons
INSERT INTO seasons (name, start_date, end_date, status, is_active) VALUES
('2024-2025 Season', '2024-09-01', '2025-04-30', 'active', true),
('2023-2024 Season', '2023-09-01', '2024-04-30', 'completed', false),
('2025-2026 Season', '2025-09-01', '2026-04-30', 'upcoming', false);

-- Insert sample leagues
INSERT INTO leagues (season_id, name, abbreviation, description, league_type, display_order) VALUES
(1, 'Eastern Conference', 'EAST', 'Eastern Conference teams', 'conference', 1),
(1, 'Western Conference', 'WEST', 'Western Conference teams', 'conference', 2),
(1, 'Atlantic Division', 'ATL', 'Atlantic Division', 'division', 1),
(1, 'Central Division', 'CEN', 'Central Division', 'division', 2);

-- Insert sample teams (extending what might already exist)
INSERT INTO teams (name, abbreviation, season_id, team_color, active, points, wins, losses, ties, overtime_wins, overtime_losses, goals_for, goals_against)
VALUES
('Toronto Maple Leafs', 'TOR', 1, '#003E7E', true, 45, 20, 8, 2, 3, 1, 95, 72),
('Montreal Canadiens', 'MTL', 1, '#AF1E2D', true, 42, 19, 9, 2, 2, 2, 88, 75),
('Boston Bruins', 'BOS', 1, '#FFB81C', true, 48, 22, 6, 2, 4, 0, 102, 68),
('Detroit Red Wings', 'DET', 1, '#CE1126', true, 38, 17, 11, 2, 1, 3, 82, 85)
ON CONFLICT (name) DO NOTHING;

-- Insert sample players
INSERT INTO players (team_id, first_name, last_name, jersey_number, position, shoots, height_inches, weight_lbs, birth_date, hometown, is_active)
SELECT 
    t.id,
    'Connor',
    'McDavid',
    97,
    'F',
    'L',
    73,
    193,
    '1997-01-13',
    'Richmond Hill, ON',
    true
FROM teams t WHERE t.abbreviation = 'TOR' LIMIT 1;

INSERT INTO players (team_id, first_name, last_name, jersey_number, position, shoots, height_inches, weight_lbs, birth_date, hometown, is_active)
SELECT 
    t.id,
    'Auston',
    'Matthews',
    34,
    'F',
    'L',
    75,
    208,
    '1997-09-17',
    'San Ramon, CA',
    true
FROM teams t WHERE t.abbreviation = 'TOR' LIMIT 1;

INSERT INTO players (team_id, first_name, last_name, jersey_number, position, shoots, height_inches, weight_lbs, birth_date, hometown, is_active)
SELECT 
    t.id,
    'Carey',
    'Price',
    31,
    'G',
    'L',
    75,
    216,
    '1987-08-16',
    'Anahim Lake, BC',
    true
FROM teams t WHERE t.abbreviation = 'MTL' LIMIT 1;

INSERT INTO players (team_id, first_name, last_name, jersey_number, position, shoots, height_inches, weight_lbs, birth_date, hometown, is_active)
SELECT 
    t.id,
    'Brad',
    'Marchand',
    63,
    'F',
    'L',
    69,
    181,
    '1988-05-11',
    'Halifax, NS',
    true
FROM teams t WHERE t.abbreviation = 'BOS' LIMIT 1;

INSERT INTO players (team_id, first_name, last_name, jersey_number, position, shoots, height_inches, weight_lbs, birth_date, hometown, is_active)
SELECT 
    t.id,
    'Dylan',
    'Larkin',
    71,
    'F',
    'L',
    73,
    198,
    '1996-07-30',
    'Waterford, MI',
    true
FROM teams t WHERE t.abbreviation = 'DET' LIMIT 1;

-- Insert sample games
INSERT INTO games (season_id, league_id, home_team_id, away_team_id, game_date, venue, status, home_score, away_score, overtime, shootout)
SELECT 
    1,
    l.id,
    ht.id,
    at.id,
    '2024-10-15 19:00:00',
    'Scotiabank Arena',
    'completed',
    4,
    3,
    true,
    false
FROM teams ht, teams at, leagues l
WHERE ht.abbreviation = 'TOR' 
  AND at.abbreviation = 'MTL'
  AND l.abbreviation = 'EAST'
LIMIT 1;

INSERT INTO games (season_id, league_id, home_team_id, away_team_id, game_date, venue, status, home_score, away_score, overtime, shootout)
SELECT 
    1,
    l.id,
    ht.id,
    at.id,
    '2024-10-20 19:30:00',
    'TD Garden',
    'completed',
    5,
    2,
    false,
    false
FROM teams ht, teams at, leagues l
WHERE ht.abbreviation = 'BOS' 
  AND at.abbreviation = 'DET'
  AND l.abbreviation = 'EAST'
LIMIT 1;

-- Insert sample player stats
INSERT INTO player_stats (player_id, season_id, team_id, games_played, goals, assists, points, plus_minus, penalty_minutes, power_play_goals, shots, shooting_percentage)
SELECT 
    p.id,
    1,
    p.team_id,
    30,
    25,
    35,
    60,
    15,
    12,
    8,
    120,
    20.83
FROM players p
WHERE p.last_name = 'McDavid'
LIMIT 1;

INSERT INTO player_stats (player_id, season_id, team_id, games_played, goals, assists, points, plus_minus, penalty_minutes, power_play_goals, shots, shooting_percentage)
SELECT 
    p.id,
    1,
    p.team_id,
    30,
    28,
    22,
    50,
    12,
    8,
    10,
    150,
    18.67
FROM players p
WHERE p.last_name = 'Matthews'
LIMIT 1;

-- Insert sample goalie stats
INSERT INTO goalie_stats (player_id, season_id, team_id, games_played, games_started, wins, losses, overtime_losses, shutouts, saves, shots_against, goals_against, save_percentage, goals_against_average, minutes_played)
SELECT 
    p.id,
    1,
    p.team_id,
    25,
    25,
    15,
    8,
    2,
    3,
    750,
    800,
    50,
    0.938,
    2.00,
    1500
FROM players p
WHERE p.last_name = 'Price'
LIMIT 1;

-- Success message
SELECT 'Seed data inserted successfully!' as message;
