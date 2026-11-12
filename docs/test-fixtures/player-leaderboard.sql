BEGIN;
DO $$
DECLARE
    season_key bigint;
    gold_key bigint;
    navy_key bigint;
    player_key bigint;
    team_key bigint;
    season_index integer;
    n integer;
    total integer;
    first_names text[] := ARRAY['Alex','Jordan','Taylor','Casey','Morgan','Riley','Jamie','Sam','Drew','Avery','Reese','Cameron','Quinn','Parker'];
    last_names text[] := ARRAY['Bennett','Carter','Davis','Ellis','Foster','Garcia','Hayes','Irving','Jensen','Kelly','Lane'];
    season_name text;
    goals integer;
    assists integer;
BEGIN
    FOR season_index IN 0..1 LOOP
        season_name := CASE season_index WHEN 0 THEN 'Demo 2026–27' ELSE 'Demo 2025–26' END;
        IF EXISTS (SELECT 1 FROM seasons WHERE name=season_name) THEN CONTINUE; END IF;
        INSERT INTO seasons(name,start_date,end_date,status,type,is_active,created_at)
        VALUES (season_name, CASE WHEN season_index=1 THEN DATE '2025-09-01' ELSE DATE '2026-09-01' END,
            CASE WHEN season_index=1 THEN DATE '2026-04-01' ELSE DATE '2027-04-01' END,
            CASE season_index WHEN 0 THEN 'active' ELSE 'completed' END,
            'LEAGUE', season_index=0, CURRENT_TIMESTAMP) RETURNING id INTO season_key;
        INSERT INTO teams(name,abbreviation,season_id,team_color,eliminated)
            VALUES ('Demo Gold ' || (2026-season_index), 'DG' || season_index, season_key, '#F6A91C', false) RETURNING id INTO gold_key;
        INSERT INTO teams(name,abbreviation,season_id,team_color,eliminated)
            VALUES ('Demo Navy ' || (2026-season_index), 'DN' || season_index, season_key, '#6D9FC5', false) RETURNING id INTO navy_key;
        total := CASE WHEN season_index=0 THEN 154 ELSE 32 END;
        FOR n IN 1..total LOOP
            team_key := CASE WHEN n%2=0 THEN gold_key ELSE navy_key END;
            INSERT INTO players(team_id,season_id,first_name,last_name,email,jersey_number,position,is_active,skill_rating)
                VALUES(team_key,season_key,first_names[1+(n-1)%14],last_names[1+((n-1)/14)%11],
                    'obhl-demo-'||season_index||'-'||n||'@example.invalid', 1+(n-1)%99,
                    CASE WHEN n>total-4 THEN 'G' WHEN n%3=0 THEN 'D' ELSE 'F' END, true, 5)
                RETURNING id INTO player_key;
            IF n<=total-4 THEN
                -- Leave two rostered skaters without statistics to exercise the distinction.
                IF n<=total-6 THEN
                    goals := CASE WHEN season_index=1 THEN n%5 ELSE (n*7)%26 END;
                    assists := CASE WHEN season_index=1 THEN n%4 ELSE (n*3)%23 END;
                    INSERT INTO player_stats(player_id,season_id,team_id,games_played,goals,assists,points,penalty_minutes)
                    VALUES(player_key,season_key,team_key,CASE WHEN season_index=1 THEN 16 ELSE 8 END,goals,assists,goals+assists,(n*2)%18);
                END IF;
            ELSE
                INSERT INTO goalie_stats(player_id,season_id,team_id,games_played,games_started,wins,losses,overtime_losses,
                    saves,shots_against,goals_against,save_percentage,goals_against_average,shutouts,minutes_played)
                VALUES(player_key,season_key,team_key,CASE WHEN n=total THEN 0 ELSE 8 END,0,
                    CASE WHEN n=total THEN 0 ELSE 4 END,CASE WHEN n=total THEN 0 ELSE 3 END,CASE WHEN n=total THEN 0 ELSE 1 END,
                    CASE WHEN n=total THEN 0 ELSE 180+(n%3)*10 END,CASE WHEN n=total THEN 0 ELSE 220 END,
                    CASE WHEN n=total THEN 0 ELSE 40-(n%3)*10 END,
                    CASE WHEN n=total THEN 0 ELSE (180+(n%3)*10)/220.0 END,
                    CASE WHEN n=total THEN 0 ELSE (40-(n%3)*10)/8.0 END,0,CASE WHEN n=total THEN 0 ELSE 360 END);
            END IF;
        END LOOP;
    END LOOP;
END $$;
COMMIT;
SELECT name, (SELECT count(*) FROM players WHERE season_id=seasons.id) AS demo_players FROM seasons WHERE name LIKE 'Demo %' ORDER BY id;
