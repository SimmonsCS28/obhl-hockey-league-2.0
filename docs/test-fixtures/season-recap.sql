-- Opt-in fictional recap fixture. Run only against an isolated development database.
BEGIN;
DO $$
DECLARE
    sid bigint; gold bigint; navy bigint; gid bigint; gp bigint; np bigint;
    n integer; hs integer; aws integer;
BEGIN
    IF EXISTS (SELECT 1 FROM seasons WHERE name='Demo 2024–25 recap') THEN RETURN; END IF;
    INSERT INTO seasons(name,start_date,end_date,status,type,is_active,created_at)
      VALUES ('Demo 2024–25 recap','2024-09-01','2025-04-01','completed','LEAGUE',false,CURRENT_TIMESTAMP) RETURNING id INTO sid;
    INSERT INTO teams(name,abbreviation,season_id,team_color,eliminated)
      VALUES ('Demo Copper','DCP',sid,'#B87333',false) RETURNING id INTO gold;
    INSERT INTO teams(name,abbreviation,season_id,team_color,eliminated)
      VALUES ('Demo Silver','DSV',sid,'#9DB9CD',false) RETURNING id INTO navy;
    INSERT INTO players(team_id,season_id,first_name,last_name,email,position,is_active)
      VALUES(gold,sid,'Alex','Demo','recap-alex@example.invalid','F',true) RETURNING id INTO gp;
    INSERT INTO players(team_id,season_id,first_name,last_name,email,position,is_active)
      VALUES(navy,sid,'Sam','Demo','recap-sam@example.invalid','F',true) RETURNING id INTO np;
    FOR n IN 1..7 LOOP
      hs := (ARRAY[5,2,7,1,4,3,9])[n]; aws := (ARRAY[3,4,6,3,2,0,9])[n];
      INSERT INTO games(season_id,home_team_id,away_team_id,game_date,status,home_score,away_score,game_type,playoff_round,forfeit_team_id,venue,week)
        VALUES(sid,gold,navy,TIMESTAMP '2025-02-08 20:00:00' + (n * INTERVAL '7 days'),CASE WHEN n=7 THEN 'scheduled' ELSE 'completed' END,hs,aws,
          CASE WHEN n=5 THEN 'PLAYOFF' ELSE 'REGULAR_SEASON' END,
          CASE WHEN n=5 THEN 'FINAL' ELSE NULL END,CASE WHEN n=6 THEN navy ELSE NULL END,'Demo rink',n) RETURNING id INTO gid;
      IF n<=5 THEN
        INSERT INTO game_events(game_id,team_id,player_id,event_type,period,time_minutes,time_seconds)
          SELECT gid,gold,gp,'goal',1,gs,0 FROM generate_series(1,hs) gs;
        INSERT INTO game_events(game_id,team_id,player_id,event_type,period,time_minutes,time_seconds)
          SELECT gid,navy,np,'goal',2,gs,0 FROM generate_series(1,aws) gs;
        INSERT INTO game_events(game_id,team_id,player_id,event_type,period,time_minutes,time_seconds,penalty_minutes,description)
          VALUES(gid,gold,gp,'penalty',2,12,0,2,'Demo penalty');
        IF n=3 THEN
          INSERT INTO game_events(game_id,team_id,player_id,event_type,period,time_minutes,time_seconds,penalty_minutes,description)
            VALUES(gid,navy,np,'penalty',2,14,0,5,'Demo major penalty');
        END IF;
      END IF;
    END LOOP;
END $$;
COMMIT;
