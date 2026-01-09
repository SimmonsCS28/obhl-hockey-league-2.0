--
-- PostgreSQL database dump
--

\restrict TYoQx4unLi0VodBvkgZUtNBqcqQsGTxkYIHUwktrQG3lxPPoJMjfgNuvgXPkXwI

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.users DROP CONSTRAINT users_team_id_fkey;
ALTER TABLE ONLY public.player_stats DROP CONSTRAINT fk_pstats_team;
ALTER TABLE ONLY public.player_stats DROP CONSTRAINT fk_pstats_season;
ALTER TABLE ONLY public.player_stats DROP CONSTRAINT fk_pstats_player;
ALTER TABLE ONLY public.players DROP CONSTRAINT fk_player_team;
ALTER TABLE ONLY public.penalty_tracking DROP CONSTRAINT fk_penalty_player;
ALTER TABLE ONLY public.penalty_tracking DROP CONSTRAINT fk_penalty_game;
ALTER TABLE ONLY public.leagues DROP CONSTRAINT fk_league_season;
ALTER TABLE ONLY public.goalie_stats DROP CONSTRAINT fk_gstats_team;
ALTER TABLE ONLY public.goalie_stats DROP CONSTRAINT fk_gstats_season;
ALTER TABLE ONLY public.goalie_stats DROP CONSTRAINT fk_gstats_player;
ALTER TABLE ONLY public.games DROP CONSTRAINT fk_game_season;
ALTER TABLE ONLY public.games DROP CONSTRAINT fk_game_league;
ALTER TABLE ONLY public.games DROP CONSTRAINT fk_game_home_team;
ALTER TABLE ONLY public.games DROP CONSTRAINT fk_game_away_team;
ALTER TABLE ONLY public.game_events DROP CONSTRAINT fk_event_team;
ALTER TABLE ONLY public.game_events DROP CONSTRAINT fk_event_player;
ALTER TABLE ONLY public.game_events DROP CONSTRAINT fk_event_game;
ALTER TABLE ONLY public.game_events DROP CONSTRAINT fk_event_assist2;
ALTER TABLE ONLY public.game_events DROP CONSTRAINT fk_event_assist1;
DROP INDEX public.idx_users_username;
DROP INDEX public.idx_users_team_id;
DROP INDEX public.idx_users_role;
DROP INDEX public.idx_users_email;
DROP INDEX public.idx_teams_season;
DROP INDEX public.idx_teams_points;
DROP INDEX public.idx_teams_active;
DROP INDEX public.idx_seasons_status;
DROP INDEX public.idx_seasons_active;
DROP INDEX public.idx_pstats_team;
DROP INDEX public.idx_pstats_season;
DROP INDEX public.idx_pstats_points;
DROP INDEX public.idx_pstats_player;
DROP INDEX public.idx_pstats_goals;
DROP INDEX public.idx_players_team;
DROP INDEX public.idx_players_position;
DROP INDEX public.idx_players_name;
DROP INDEX public.idx_players_active;
DROP INDEX public.idx_penalty_suspended;
DROP INDEX public.idx_penalty_player;
DROP INDEX public.idx_penalty_game;
DROP INDEX public.idx_penalty_ejected;
DROP INDEX public.idx_leagues_type;
DROP INDEX public.idx_leagues_season;
DROP INDEX public.idx_gstats_team;
DROP INDEX public.idx_gstats_season;
DROP INDEX public.idx_gstats_save_pct;
DROP INDEX public.idx_gstats_player;
DROP INDEX public.idx_gstats_gaa;
DROP INDEX public.idx_games_week;
DROP INDEX public.idx_games_type;
DROP INDEX public.idx_games_status;
DROP INDEX public.idx_games_season_week;
DROP INDEX public.idx_games_season;
DROP INDEX public.idx_games_league;
DROP INDEX public.idx_games_home_team;
DROP INDEX public.idx_games_date;
DROP INDEX public.idx_games_away_team;
DROP INDEX public.idx_events_type;
DROP INDEX public.idx_events_team;
DROP INDEX public.idx_events_player;
DROP INDEX public.idx_events_period;
DROP INDEX public.idx_events_game;
DROP INDEX public.idx_draft_saves_status;
DROP INDEX public.idx_draft_saves_created_at;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_username_key;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_key;
ALTER TABLE ONLY public.player_stats DROP CONSTRAINT uq_player_season;
ALTER TABLE ONLY public.leagues DROP CONSTRAINT uq_league_season_name;
ALTER TABLE ONLY public.goalie_stats DROP CONSTRAINT uq_goalie_season;
ALTER TABLE ONLY public.penalty_tracking DROP CONSTRAINT unique_player_game;
ALTER TABLE ONLY public.teams DROP CONSTRAINT uknv0mkd6nfxdo4dnnko61e94xj;
ALTER TABLE ONLY public.players DROP CONSTRAINT ukco6ldxed51gm1elmpk5anlusa;
ALTER TABLE ONLY public.teams DROP CONSTRAINT ukaqy97bpx5mar150vkteybwf52;
ALTER TABLE ONLY public.teams DROP CONSTRAINT teams_pkey;
ALTER TABLE ONLY public.teams DROP CONSTRAINT teams_name_season_unique;
ALTER TABLE ONLY public.seasons DROP CONSTRAINT seasons_pkey;
ALTER TABLE ONLY public.seasons DROP CONSTRAINT seasons_name_key;
ALTER TABLE ONLY public.players DROP CONSTRAINT players_pkey;
ALTER TABLE ONLY public.player_stats DROP CONSTRAINT player_stats_pkey;
ALTER TABLE ONLY public.penalty_tracking DROP CONSTRAINT penalty_tracking_pkey;
ALTER TABLE ONLY public.leagues DROP CONSTRAINT leagues_pkey;
ALTER TABLE ONLY public.goalie_stats DROP CONSTRAINT goalie_stats_pkey;
ALTER TABLE ONLY public.games DROP CONSTRAINT games_pkey;
ALTER TABLE ONLY public.game_events DROP CONSTRAINT game_events_pkey;
ALTER TABLE ONLY public.draft_saves DROP CONSTRAINT draft_saves_pkey;
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.teams ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.seasons ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.players ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.player_stats ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.penalty_tracking ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.leagues ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.goalie_stats ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.games ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.game_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.draft_saves ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE public.users_id_seq;
DROP TABLE public.users;
DROP SEQUENCE public.teams_id_seq;
DROP TABLE public.teams;
DROP SEQUENCE public.seasons_id_seq;
DROP TABLE public.seasons;
DROP SEQUENCE public.players_id_seq;
DROP TABLE public.players;
DROP SEQUENCE public.player_stats_id_seq;
DROP TABLE public.player_stats;
DROP SEQUENCE public.penalty_tracking_id_seq;
DROP TABLE public.penalty_tracking;
DROP SEQUENCE public.leagues_id_seq;
DROP TABLE public.leagues;
DROP SEQUENCE public.goalie_stats_id_seq;
DROP TABLE public.goalie_stats;
DROP SEQUENCE public.games_id_seq;
DROP TABLE public.games;
DROP SEQUENCE public.game_events_id_seq;
DROP TABLE public.game_events;
DROP SEQUENCE public.draft_saves_id_seq;
DROP TABLE public.draft_saves;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: draft_saves; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.draft_saves (
    id bigint NOT NULL,
    season_name character varying(255) NOT NULL,
    status character varying(20) NOT NULL,
    draft_data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT draft_saves_status_check CHECK (((status)::text = ANY ((ARRAY['saved'::character varying, 'complete'::character varying])::text[])))
);


ALTER TABLE public.draft_saves OWNER TO obhl_admin;

--
-- Name: TABLE draft_saves; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.draft_saves IS 'Stores draft state for save/resume functionality';


--
-- Name: COLUMN draft_saves.season_name; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.draft_saves.season_name IS 'Name of the season for this draft';


--
-- Name: COLUMN draft_saves.status; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.draft_saves.status IS 'Draft status: saved (in-progress) or complete (finalized)';


--
-- Name: COLUMN draft_saves.draft_data; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.draft_saves.draft_data IS 'JSON data containing teams, players, colors, and sort options';


--
-- Name: COLUMN draft_saves.created_at; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.draft_saves.created_at IS 'Timestamp when draft was first created';


--
-- Name: COLUMN draft_saves.updated_at; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.draft_saves.updated_at IS 'Timestamp when draft was last updated';


--
-- Name: draft_saves_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.draft_saves_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.draft_saves_id_seq OWNER TO obhl_admin;

--
-- Name: draft_saves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.draft_saves_id_seq OWNED BY public.draft_saves.id;


--
-- Name: game_events; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.game_events (
    id bigint NOT NULL,
    game_id bigint NOT NULL,
    team_id bigint NOT NULL,
    player_id bigint,
    event_type character varying(20) NOT NULL,
    period integer NOT NULL,
    time_minutes integer NOT NULL,
    time_seconds integer NOT NULL,
    description text,
    assist1_player_id bigint,
    assist2_player_id bigint,
    penalty_minutes integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_event_type CHECK (((event_type)::text = ANY ((ARRAY['goal'::character varying, 'penalty'::character varying, 'save'::character varying, 'shot'::character varying, 'hit'::character varying, 'faceoff'::character varying])::text[]))),
    CONSTRAINT chk_penalty_minutes CHECK (((penalty_minutes IS NULL) OR (penalty_minutes > 0))),
    CONSTRAINT chk_period CHECK (((period > 0) AND (period <= 5))),
    CONSTRAINT chk_time_minutes CHECK (((time_minutes >= 0) AND (time_minutes < 60))),
    CONSTRAINT chk_time_seconds CHECK (((time_seconds >= 0) AND (time_seconds < 60)))
);


ALTER TABLE public.game_events OWNER TO obhl_admin;

--
-- Name: TABLE game_events; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.game_events IS 'In-game events tracking';


--
-- Name: COLUMN game_events.event_type; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.game_events.event_type IS 'Event type: goal, penalty, save, shot, hit, faceoff';


--
-- Name: COLUMN game_events.period; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.game_events.period IS 'Period number (1-3 regular, 4+ overtime)';


--
-- Name: game_events_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.game_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.game_events_id_seq OWNER TO obhl_admin;

--
-- Name: game_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.game_events_id_seq OWNED BY public.game_events.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.games (
    id bigint NOT NULL,
    season_id bigint NOT NULL,
    league_id bigint,
    home_team_id bigint NOT NULL,
    away_team_id bigint NOT NULL,
    game_date timestamp without time zone NOT NULL,
    venue character varying(200),
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    home_score integer DEFAULT 0,
    away_score integer DEFAULT 0,
    overtime boolean DEFAULT false,
    shootout boolean DEFAULT false,
    period integer DEFAULT 1,
    game_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    game_type character varying(20) DEFAULT 'REGULAR_SEASON'::character varying NOT NULL,
    ended_in_ot boolean DEFAULT false,
    home_team_points integer DEFAULT 0,
    away_team_points integer DEFAULT 0,
    week integer,
    rink character varying(20),
    CONSTRAINT chk_different_teams CHECK ((home_team_id <> away_team_id)),
    CONSTRAINT chk_game_status CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'postponed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_game_type CHECK (((game_type)::text = ANY ((ARRAY['REGULAR_SEASON'::character varying, 'PLAYOFF'::character varying])::text[]))),
    CONSTRAINT chk_points CHECK (((home_team_points >= '-1'::integer) AND (away_team_points >= '-1'::integer))),
    CONSTRAINT chk_scores CHECK (((home_score >= 0) AND (away_score >= 0)))
);


ALTER TABLE public.games OWNER TO obhl_admin;

--
-- Name: TABLE games; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.games IS 'Hockey games schedule and results';


--
-- Name: COLUMN games.status; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.games.status IS 'Game status: scheduled, in_progress, completed, postponed, cancelled';


--
-- Name: COLUMN games.game_type; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.games.game_type IS 'Type of game: REGULAR_SEASON or PLAYOFF';


--
-- Name: COLUMN games.ended_in_ot; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.games.ended_in_ot IS 'Whether the game ended in overtime (for tied games)';


--
-- Name: COLUMN games.home_team_points; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.games.home_team_points IS 'Points awarded to home team (2=win, 1=tie/OT loss, 0=loss, -1=7+ penalties)';


--
-- Name: COLUMN games.away_team_points; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.games.away_team_points IS 'Points awarded to away team (2=win, 1=tie/OT loss, 0=loss, -1=7+ penalties)';


--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.games_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.games_id_seq OWNER TO obhl_admin;

--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: goalie_stats; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.goalie_stats (
    id bigint NOT NULL,
    player_id bigint NOT NULL,
    season_id bigint NOT NULL,
    team_id bigint NOT NULL,
    games_played integer DEFAULT 0 NOT NULL,
    games_started integer DEFAULT 0 NOT NULL,
    wins integer DEFAULT 0 NOT NULL,
    losses integer DEFAULT 0 NOT NULL,
    overtime_losses integer DEFAULT 0 NOT NULL,
    shutouts integer DEFAULT 0 NOT NULL,
    saves integer DEFAULT 0 NOT NULL,
    shots_against integer DEFAULT 0 NOT NULL,
    goals_against integer DEFAULT 0 NOT NULL,
    save_percentage numeric(5,3) DEFAULT 0.000,
    goals_against_average numeric(4,2) DEFAULT 0.00,
    minutes_played integer DEFAULT 0 NOT NULL,
    penalty_minutes integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_gaa CHECK ((goals_against_average >= (0)::numeric)),
    CONSTRAINT chk_games_played CHECK ((games_played >= 0)),
    CONSTRAINT chk_games_started CHECK (((games_started >= 0) AND (games_started <= games_played))),
    CONSTRAINT chk_goals_against CHECK ((goals_against >= 0)),
    CONSTRAINT chk_losses CHECK ((losses >= 0)),
    CONSTRAINT chk_save_pct CHECK (((save_percentage >= (0)::numeric) AND (save_percentage <= (1)::numeric))),
    CONSTRAINT chk_saves CHECK ((saves >= 0)),
    CONSTRAINT chk_shots_against CHECK ((shots_against >= 0)),
    CONSTRAINT chk_wins CHECK ((wins >= 0))
);


ALTER TABLE public.goalie_stats OWNER TO obhl_admin;

--
-- Name: TABLE goalie_stats; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.goalie_stats IS 'Goalie statistics per season';


--
-- Name: COLUMN goalie_stats.save_percentage; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.goalie_stats.save_percentage IS 'Save percentage (0.000 to 1.000)';


--
-- Name: COLUMN goalie_stats.goals_against_average; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.goalie_stats.goals_against_average IS 'Goals against average per game';


--
-- Name: goalie_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.goalie_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.goalie_stats_id_seq OWNER TO obhl_admin;

--
-- Name: goalie_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.goalie_stats_id_seq OWNED BY public.goalie_stats.id;


--
-- Name: leagues; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.leagues (
    id bigint NOT NULL,
    season_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    abbreviation character varying(10) NOT NULL,
    description text,
    league_type character varying(20) DEFAULT 'division'::character varying NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_league_type CHECK (((league_type)::text = ANY ((ARRAY['division'::character varying, 'conference'::character varying, 'league'::character varying])::text[])))
);


ALTER TABLE public.leagues OWNER TO obhl_admin;

--
-- Name: TABLE leagues; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.leagues IS 'League divisions and conferences';


--
-- Name: COLUMN leagues.league_type; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.leagues.league_type IS 'Type: division, conference, or league';


--
-- Name: leagues_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.leagues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leagues_id_seq OWNER TO obhl_admin;

--
-- Name: leagues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.leagues_id_seq OWNED BY public.leagues.id;


--
-- Name: penalty_tracking; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.penalty_tracking (
    id bigint NOT NULL,
    player_id bigint NOT NULL,
    game_id bigint NOT NULL,
    penalty_count integer DEFAULT 0 NOT NULL,
    is_ejected boolean DEFAULT false,
    is_suspended_next_game boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_penalty_count CHECK ((penalty_count >= 0))
);


ALTER TABLE public.penalty_tracking OWNER TO obhl_admin;

--
-- Name: TABLE penalty_tracking; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.penalty_tracking IS 'Tracks player penalties for ejection (3 in game) and suspension (4 in 2 games) rules';


--
-- Name: COLUMN penalty_tracking.penalty_count; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.penalty_tracking.penalty_count IS 'Number of penalties player has received in this game';


--
-- Name: COLUMN penalty_tracking.is_ejected; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.penalty_tracking.is_ejected IS 'Whether player was ejected from this game';


--
-- Name: COLUMN penalty_tracking.is_suspended_next_game; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.penalty_tracking.is_suspended_next_game IS 'Whether player is suspended for the next game';


--
-- Name: penalty_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.penalty_tracking_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.penalty_tracking_id_seq OWNER TO obhl_admin;

--
-- Name: penalty_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.penalty_tracking_id_seq OWNED BY public.penalty_tracking.id;


--
-- Name: player_stats; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.player_stats (
    id bigint NOT NULL,
    player_id bigint NOT NULL,
    season_id bigint NOT NULL,
    team_id bigint NOT NULL,
    games_played integer DEFAULT 0 NOT NULL,
    goals integer DEFAULT 0 NOT NULL,
    assists integer DEFAULT 0 NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    plus_minus integer DEFAULT 0 NOT NULL,
    penalty_minutes integer DEFAULT 0 NOT NULL,
    power_play_goals integer DEFAULT 0 NOT NULL,
    power_play_assists integer DEFAULT 0 NOT NULL,
    short_handed_goals integer DEFAULT 0 NOT NULL,
    short_handed_assists integer DEFAULT 0 NOT NULL,
    game_winning_goals integer DEFAULT 0 NOT NULL,
    shots integer DEFAULT 0 NOT NULL,
    shooting_percentage numeric(5,2) DEFAULT 0.00,
    faceoff_wins integer DEFAULT 0 NOT NULL,
    faceoff_losses integer DEFAULT 0 NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    blocked_shots integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_assists CHECK ((assists >= 0)),
    CONSTRAINT chk_games_played CHECK ((games_played >= 0)),
    CONSTRAINT chk_goals CHECK ((goals >= 0)),
    CONSTRAINT chk_points CHECK ((points >= 0)),
    CONSTRAINT chk_shooting_pct CHECK (((shooting_percentage >= (0)::numeric) AND (shooting_percentage <= (100)::numeric)))
);


ALTER TABLE public.player_stats OWNER TO obhl_admin;

--
-- Name: TABLE player_stats; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.player_stats IS 'Skater statistics per season';


--
-- Name: COLUMN player_stats.points; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.player_stats.points IS 'Total points (goals + assists)';


--
-- Name: COLUMN player_stats.plus_minus; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.player_stats.plus_minus IS 'Plus/minus rating';


--
-- Name: player_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.player_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.player_stats_id_seq OWNER TO obhl_admin;

--
-- Name: player_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.player_stats_id_seq OWNED BY public.player_stats.id;


--
-- Name: players; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.players (
    id bigint NOT NULL,
    team_id bigint,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    jersey_number integer,
    "position" character varying(10) NOT NULL,
    shoots character varying(5),
    height_inches integer,
    weight_lbs integer,
    birth_date date,
    hometown character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    skill_rating integer DEFAULT 5 NOT NULL,
    email character varying(255) NOT NULL,
    is_veteran boolean,
    season_id bigint,
    CONSTRAINT chk_jersey_number CHECK (((jersey_number > 0) AND (jersey_number < 100))),
    CONSTRAINT chk_position CHECK ((("position")::text = ANY ((ARRAY['F'::character varying, 'D'::character varying, 'G'::character varying])::text[]))),
    CONSTRAINT chk_shoots CHECK ((((shoots)::text = ANY ((ARRAY['L'::character varying, 'R'::character varying, 'N/A'::character varying])::text[])) OR (shoots IS NULL))),
    CONSTRAINT chk_skill_rating CHECK (((skill_rating >= 1) AND (skill_rating <= 10)))
);


ALTER TABLE public.players OWNER TO obhl_admin;

--
-- Name: TABLE players; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.players IS 'Hockey players roster';


--
-- Name: COLUMN players."position"; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.players."position" IS 'Position: F (Forward), D (Defense), G (Goalie)';


--
-- Name: COLUMN players.shoots; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.players.shoots IS 'Shooting hand: L (Left), R (Right), N/A (for goalies who catch)';


--
-- Name: COLUMN players.skill_rating; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.players.skill_rating IS 'Player skill rating (1-10). Skill 9+ have 2 goal limit, others have 3 goal limit';


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.players_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.players_id_seq OWNER TO obhl_admin;

--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.seasons (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'upcoming'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_season_dates CHECK ((end_date > start_date)),
    CONSTRAINT chk_season_status CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'active'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.seasons OWNER TO obhl_admin;

--
-- Name: TABLE seasons; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.seasons IS 'Hockey league seasons';


--
-- Name: COLUMN seasons.status; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.seasons.status IS 'Season status: upcoming, active, completed, cancelled';


--
-- Name: seasons_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.seasons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seasons_id_seq OWNER TO obhl_admin;

--
-- Name: seasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.seasons_id_seq OWNED BY public.seasons.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.teams (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    abbreviation character varying(10) NOT NULL,
    season_id bigint NOT NULL,
    logo_url character varying(500),
    team_color character varying(30),
    gm_id bigint,
    active boolean DEFAULT true NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    wins integer DEFAULT 0 NOT NULL,
    losses integer DEFAULT 0 NOT NULL,
    ties integer DEFAULT 0 NOT NULL,
    overtime_wins integer DEFAULT 0 NOT NULL,
    overtime_losses integer DEFAULT 0 NOT NULL,
    goals_for integer DEFAULT 0 NOT NULL,
    goals_against integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_goals_against CHECK ((goals_against >= 0)),
    CONSTRAINT chk_goals_for CHECK ((goals_for >= 0)),
    CONSTRAINT chk_losses CHECK ((losses >= 0)),
    CONSTRAINT chk_overtime_losses CHECK ((overtime_losses >= 0)),
    CONSTRAINT chk_overtime_wins CHECK ((overtime_wins >= 0)),
    CONSTRAINT chk_points CHECK ((points >= 0)),
    CONSTRAINT chk_ties CHECK ((ties >= 0)),
    CONSTRAINT chk_wins CHECK ((wins >= 0))
);


ALTER TABLE public.teams OWNER TO obhl_admin;

--
-- Name: TABLE teams; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.teams IS 'Hockey teams with standings and statistics';


--
-- Name: COLUMN teams.team_color; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.teams.team_color IS 'Team color in hex format (#RRGGBB)';


--
-- Name: COLUMN teams.points; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.teams.points IS 'Total points in standings';


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO obhl_admin;

--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: obhl_admin
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'USER'::character varying NOT NULL,
    team_id bigint,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO obhl_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON TABLE public.users IS 'User accounts for authentication and authorization';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.users.role IS 'User role: ADMIN (full access), GM (team management), USER (read-only)';


--
-- Name: COLUMN users.team_id; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.users.team_id IS 'For GM role: which team they manage';


--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON COLUMN public.users.is_active IS 'Whether the user account is active';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: obhl_admin
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO obhl_admin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: obhl_admin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: draft_saves id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.draft_saves ALTER COLUMN id SET DEFAULT nextval('public.draft_saves_id_seq'::regclass);


--
-- Name: game_events id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events ALTER COLUMN id SET DEFAULT nextval('public.game_events_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: goalie_stats id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.goalie_stats ALTER COLUMN id SET DEFAULT nextval('public.goalie_stats_id_seq'::regclass);


--
-- Name: leagues id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.leagues ALTER COLUMN id SET DEFAULT nextval('public.leagues_id_seq'::regclass);


--
-- Name: penalty_tracking id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.penalty_tracking ALTER COLUMN id SET DEFAULT nextval('public.penalty_tracking_id_seq'::regclass);


--
-- Name: player_stats id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.player_stats ALTER COLUMN id SET DEFAULT nextval('public.player_stats_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: seasons id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.seasons ALTER COLUMN id SET DEFAULT nextval('public.seasons_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: draft_saves; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.draft_saves (id, season_name, status, draft_data, created_at, updated_at) FROM stdin;
1	2026 Winter C League	complete	{"teams": [{"id": 5, "name": "White", "color": "White", "players": [{"isGm": true, "email": "alexhohlstein@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Hohlstein", "position": "Forward", "buddyPick": "Zack Fyler, Jacob Lavigne", "firstName": "Alex", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "zfyler1@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Fyler", "position": "Forward", "buddyPick": "Alex Hohlstein, Jacob Lavine", "firstName": "Zack", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "lavignejr15@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Lavigne", "position": "Forward", "buddyPick": "Kenny Wollersheim, Zack Fyler, Alex Hohlstein", "firstName": "Jacob", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "coobacmz@me.com", "isRef": false, "status": "Veteran", "lastName": "Coobac", "position": "Defense", "buddyPick": "Goodwin Lyons", "firstName": "Matt", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "brianacronk@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Cronk", "position": "Defense", "buddyPick": " ", "firstName": "Briana", "isVeteran": true, "buddyEmail": null, "skillRating": 4}, {"isGm": false, "email": "jamesertel04@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Ertel", "position": "Defense", "buddyPick": " ", "firstName": "Jim", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "mdunk@chorus.net", "isRef": false, "status": "Veteran", "lastName": "Dunk", "position": "Forward", "buddyPick": "Michael Hughes", "firstName": "Mike", "isVeteran": true, "buddyEmail": null, "skillRating": 2}, {"isGm": false, "email": "bnnitram@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Martin", "position": "Forward", "buddyPick": "Cody Gill", "firstName": "Ben", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "thecodster@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Gill", "position": "Forward", "buddyPick": "Ben Martin", "firstName": "Cody", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "brockwschupp@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Schupp", "position": "Forward", "buddyPick": " ", "firstName": "Brock", "isVeteran": false, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "josephjohnsiv@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Johns", "position": "Forward", "buddyPick": "Matt Severson", "firstName": "Joseph", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "chrislewis8843@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Lewis", "position": "Forward", "buddyPick": " ", "firstName": "Christopher", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "bloken21@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Loken", "position": "Forward", "buddyPick": " ", "firstName": "Bryce", "isVeteran": true, "buddyEmail": null, "skillRating": 6}], "sortOption": "Position + Rating"}, {"id": 2, "name": "Lt. Blue", "color": "Lt. Blue", "players": [{"isGm": true, "email": "tbehnks11@yahoo.com", "isRef": true, "status": "Veteran", "lastName": "Behnke", "position": "Defense", "buddyPick": "Joe Goldfine, Andy Winn", "firstName": "Tom", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "josephbgoldfine@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Goldfine", "position": "Forward", "buddyPick": "Tom Behnke", "firstName": "Joe", "isVeteran": true, "buddyEmail": null, "skillRating": 10}, {"isGm": false, "email": "johndoconnell5@gmail.com", "isRef": false, "status": "Rookie", "lastName": "O’Connell", "position": "Defense", "buddyPick": "Andy Bernath", "firstName": "JD", "isVeteran": false, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "A_bernath@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Bernath", "position": "Forward", "buddyPick": "JD O'Connell", "firstName": "Andrew", "isVeteran": true, "buddyEmail": null, "skillRating": 4}, {"isGm": false, "email": "btempleton123@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Templeton", "position": "Defense", "buddyPick": " ", "firstName": "Bradley", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "hpflieger@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Pflieger", "position": "Defense", "buddyPick": "Amy May", "firstName": "Hans", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "mamyay@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "May", "position": "Forward", "buddyPick": "Hans Pflieger", "firstName": "Amy", "isVeteran": true, "buddyEmail": null, "skillRating": 3}, {"isGm": false, "email": "cjbruns10910@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Bruns", "position": "Forward", "buddyPick": "Jesse Sherman", "firstName": "Chris", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "thunder56082@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Sherman", "position": "Forward", "buddyPick": "Chris Bruns", "firstName": "Jesse", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "gembotts@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Botts", "position": "Forward", "buddyPick": "Ben Bouche", "firstName": "George", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "bbouche@findorff.com", "isRef": false, "status": "Veteran", "lastName": "Bouche", "position": "Forward", "buddyPick": "George Botts", "firstName": "Benjamin", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "sccrhockylax@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Wood-Doughty", "position": "Forward", "buddyPick": " ", "firstName": "Alex", "isVeteran": false, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "winnap@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Winn", "position": "Forward", "buddyPick": " ", "firstName": "Andy", "isVeteran": true, "buddyEmail": null, "skillRating": 5}], "sortOption": "Rating: High to Low"}, {"id": 8, "name": "Gray", "color": "Gray", "players": [{"isGm": true, "email": "jtlind@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Lind", "position": "Forward", "buddyPick": "Greg Lind", "firstName": "Joshua ", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "gm_lind@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Lind", "position": "Forward", "buddyPick": "Joshua Lind", "firstName": "Greg", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "cjduli@yahoo.com", "isRef": true, "status": "Veteran", "lastName": "James", "position": "Defense", "buddyPick": " ", "firstName": "Cody", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "ausmanella@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Ausman", "position": "Defense", "buddyPick": "Logan Williams", "firstName": "Ella", "isVeteran": false, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "logstogs@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Williams", "position": "Forward", "buddyPick": "Ella Ausmen", "firstName": "Logan", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "abwhitedesign@gmail.com", "isRef": false, "status": "Veteran", "lastName": "White", "position": "Defense", "buddyPick": " ", "firstName": "Aaron", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "tdubbs2@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Williams", "position": "Forward", "buddyPick": "Cole Simmons", "firstName": "Timothy", "isVeteran": true, "buddyEmail": null, "skillRating": 3}, {"isGm": false, "email": "simmonscs28@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Simmons", "position": "Forward", "buddyPick": "Tim Williams", "firstName": "Cole", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "ntstapelfeldt@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Stapelfeldt", "position": "Forward", "buddyPick": " ", "firstName": "Nolan", "isVeteran": false, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "geiger_brian@rocketmail.com", "isRef": false, "status": "Veteran", "lastName": "Geiger", "position": "Forward", "buddyPick": "Joel Anderson", "firstName": "Brian", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "andersjoel@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Anderson", "position": "Forward", "buddyPick": "Brian Geiger", "firstName": "Joel", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "cougartreasurer2019@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Cumming", "position": "Forward", "buddyPick": " ", "firstName": "Scott", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "krehwen@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Krehbiel", "position": "Forward", "buddyPick": " ", "firstName": "Aaron", "isVeteran": true, "buddyEmail": null, "skillRating": 5}], "sortOption": "Position + Rating"}, {"id": 10, "name": "Maroon", "color": "Maroon", "players": [{"isGm": true, "email": "pedracine_phillip@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Pedracine", "position": "Forward", "buddyPick": "Peter Bormann", "firstName": "Phillip", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "pmbormann@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Bormann", "position": "Forward", "buddyPick": "Phil Pedrecine", "firstName": "Peter", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "winn.lyons94@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Lyons", "position": "Defense", "buddyPick": "Matt Muzzy, Gage Hill", "firstName": "Goodwin", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "mcmuzzcm@icloud.com", "isRef": false, "status": "Veteran", "lastName": "Muzzy", "position": "Forward", "buddyPick": "Goodwin Lyons", "firstName": "Matt", "isVeteran": true, "buddyEmail": null, "skillRating": 3}, {"isGm": false, "email": "zbarnetzke@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Barnetzke", "position": "Defense", "buddyPick": "Jason Kent", "firstName": "Zachary", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "Jasonkent24@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Kent", "position": "Forward", "buddyPick": "Zachary Barnetzke", "firstName": "Jason", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "purpleice25@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Schmidt", "position": "Defense", "buddyPick": " ", "firstName": "Jeffrey", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "sotnar@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Stone", "position": "Defense", "buddyPick": " ", "firstName": "Steven", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "bwaterman2323@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Waterman", "position": "Forward", "buddyPick": "Brian Kehoe", "firstName": "Bret", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "jfriedle96@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Friedle", "position": "Forward", "buddyPick": " ", "firstName": "Jimmy", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "jjrschneid@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Schneider", "position": "Forward", "buddyPick": " ", "firstName": "Jeff", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "mruff12@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Ruff", "position": "Forward", "buddyPick": " ", "firstName": "Michael", "isVeteran": false, "buddyEmail": null, "skillRating": 7}], "sortOption": "Position + Rating"}, {"id": 6, "name": "Team 6", "color": "Red", "players": [{"isGm": true, "email": "bstephenson014@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Stephenson", "position": "Forward", "buddyPick": "Kyle Stephenson, John Podgorski", "firstName": "Brian", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "kstephenson93@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Stephenson", "position": "Forward", "buddyPick": "Brian Stephenson", "firstName": "Kyle", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "pod526@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Podgorski", "position": "Defense", "buddyPick": "John Steinbergs, Brian Stevenson", "firstName": "John", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "jarsteinbergs@proton.me", "isRef": true, "status": "Veteran", "lastName": "Steinbergs", "position": "Defense", "buddyPick": "John Podgorski", "firstName": "John", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "robinson.peter.c@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Robinson", "position": "Defense", "buddyPick": " ", "firstName": "Peter", "isVeteran": false, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "tjhaglind@mac.com", "isRef": false, "status": "Veteran", "lastName": "Haglind", "position": "Defense", "buddyPick": " ", "firstName": "Todd", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "ishimurazero@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Hogan", "position": "Forward", "buddyPick": " ", "firstName": "Casey", "isVeteran": true, "buddyEmail": null, "skillRating": 3}, {"isGm": false, "email": "ryanolstad44@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Olstad", "position": "Forward", "buddyPick": "Kyle Stephenson, Drew Arvold", "firstName": "Ryan", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "darvold88@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Arvold", "position": "Forward", "buddyPick": "Ryan Olstad", "firstName": "Drew", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "bryanschreiter@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Schreiter", "position": "Forward", "buddyPick": "Toby Garrod", "firstName": "Bryan", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "Toby.garrod24@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Garrod", "position": "Forward", "buddyPick": "Derek Parker", "firstName": "Toby", "isVeteran": false, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "jakestamas@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Stamas", "position": "Forward", "buddyPick": " ", "firstName": "Jacob", "isVeteran": true, "buddyEmail": null, "skillRating": 5}], "sortOption": "Position + Rating"}, {"id": 9, "name": "Team 9", "color": "Blue", "players": [{"isGm": true, "email": "chrsculver@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Culver", "position": "Forward", "buddyPick": "Alexander Suchon", "firstName": "Chris", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "alexandersuchon@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Suchon", "position": "Forward", "buddyPick": "Chris Culver", "firstName": "Alexander", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "gteeiguy@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Iordachescu", "position": "Forward", "buddyPick": "Chris Culver", "firstName": "Andrew", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "spfdklahn@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Klahn", "position": "Forward", "buddyPick": "Andrew Iordachescu", "firstName": "Mike", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "tim.williams.wi@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Williams", "position": "Defense", "buddyPick": " ", "firstName": "Timothy", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "bryantimothypierce@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Pierce", "position": "Defense", "buddyPick": "Mark Gernetzke", "firstName": "Bryan", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "mag1_46@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Gernetzke", "position": "Forward", "buddyPick": "Chris Bruns", "firstName": "Mark", "isVeteran": true, "buddyEmail": null, "skillRating": 10}, {"isGm": false, "email": "sullivanrp2@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Sullivan", "position": "Defense", "buddyPick": "Daniel Wilson", "firstName": "Richard", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "yzzi19@msn.com", "isRef": true, "status": "Veteran", "lastName": "Rogers", "position": "Forward", "buddyPick": " ", "firstName": "Adam", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "dadman0901@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Diedrich", "position": "Defense", "buddyPick": " ", "firstName": "Michael", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "lilkoltes@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Koltes", "position": "Forward", "buddyPick": "Michael Diedrich", "firstName": "Ryan", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "tmrshll1@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Marshall", "position": "Forward", "buddyPick": " ", "firstName": "Ted", "isVeteran": true, "buddyEmail": null, "skillRating": 6}], "sortOption": "Position + Rating"}, {"id": 3, "name": "Team 3", "color": "Green", "players": [{"isGm": true, "email": "jsruesch@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Ruesch", "position": "Forward", "buddyPick": "Matthew Ralph", "firstName": "Jake", "isVeteran": true, "buddyEmail": null, "skillRating": 10}, {"isGm": false, "email": "mralph1009@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Ralph", "position": "Defense", "buddyPick": "Jake Ruesch", "firstName": "Matthew", "isVeteran": true, "buddyEmail": null, "skillRating": 10}, {"isGm": false, "email": "mralph@live.com", "isRef": false, "status": "Veteran", "lastName": "Ralph", "position": "Forward", "buddyPick": "Jeff Vincent", "firstName": "Michael", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "fuoco911@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Vincent", "position": "Defense", "buddyPick": "Mike Ralph", "firstName": "Jeff", "isVeteran": true, "buddyEmail": null, "skillRating": 4}, {"isGm": false, "email": "jeff@wilcenski.com", "isRef": false, "status": "Veteran", "lastName": "Wilcenski", "position": "Defense", "buddyPick": "Chris Van Syckle, Jesse Sherman", "firstName": "Jeff", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "zamdriver3@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Van Syckel", "position": "Forward", "buddyPick": "Jeff Wilcenski", "firstName": "Chris", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "thornton.jeffw@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Thornton", "position": "Forward", "buddyPick": "Rob Malkovich", "firstName": "Jeff", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "jedimalkovich@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Malkovich", "position": "Forward", "buddyPick": "Jeff Thornton", "firstName": "Rob", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "tophermartin55@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Martin", "position": "Forward", "buddyPick": "Jeff Thornton", "firstName": "Christopher", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "austinsteinbach@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Steinbach", "position": "Forward", "buddyPick": "Ryan Brigowatz", "firstName": "Austin", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "kball2297@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Kreiter", "position": "Forward", "buddyPick": " ", "firstName": "Luke", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "stevenlascola@gmail.com", "isRef": false, "status": "Rookie", "lastName": "LaScola", "position": "Forward", "buddyPick": " ", "firstName": "Steven", "isVeteran": false, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "jjgrailer@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Grailer", "position": "Forward", "buddyPick": " ", "firstName": "Jamison", "isVeteran": true, "buddyEmail": null, "skillRating": 5}], "sortOption": "Position + Rating"}, {"id": 1, "name": "Team 1", "color": "Black", "players": [{"isGm": true, "email": "jon_rogers@trekbikes.com", "isRef": true, "status": "Veteran", "lastName": "Rogers", "position": "Defense", "buddyPick": "Matt Severson", "firstName": "Jon", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "mattjseverson@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Severson", "position": "Forward", "buddyPick": "Jon Rogers", "firstName": "Matt", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "gbradleydavenport@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Davenport", "position": "Defense", "buddyPick": "Tony Gackstetter", "firstName": "Brad", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "tonygackstetter@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Gackstetter", "position": "Forward", "buddyPick": "Brad Davenport", "firstName": "Anthony", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "yzee4@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Weisensel", "position": "Defense", "buddyPick": "Rob Karsten", "firstName": "Nick", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "karstenrob@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Karsten", "position": "Forward", "buddyPick": "Nick Weisensel", "firstName": "Robert", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "hockeybob64@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Gould", "position": "Forward", "buddyPick": " ", "firstName": "Robert", "isVeteran": true, "buddyEmail": null, "skillRating": 1}, {"isGm": false, "email": "kachan.victor@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Kachan", "position": "Forward", "buddyPick": "Nikolas Ludzenieks", "firstName": "Victor", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "nikolastreecare@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Ludzenieks", "position": "Forward", "buddyPick": "Victor Kachan", "firstName": "Nikolas", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "m_labron@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Labron", "position": "Forward", "buddyPick": "Derek Parker", "firstName": "Matt", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "parker.dere@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Parker", "position": "Forward", "buddyPick": " ", "firstName": "Derek", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "hsotsai@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Sotsaikich", "position": "Forward", "buddyPick": " ", "firstName": "Henry", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "ryanhavilandsullivan3@gmail.com", "isRef": false, "status": "Rooke", "lastName": "Sullivan", "position": "Forward", "buddyPick": " ", "firstName": "Ryan", "isVeteran": false, "buddyEmail": null, "skillRating": 6}], "sortOption": "Position + Rating"}, {"id": 7, "name": "Team 7", "color": "Tan", "players": [{"isGm": true, "email": "kevin.mcconnaughay@gmail.com", "isRef": false, "status": "Veteran", "lastName": "McConnaughay", "position": "Defense", "buddyPick": "Andy Schlieve", "firstName": "Kevin", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "andythearborist@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Schlieve", "position": "Forward", "buddyPick": "Kevin McConaughay", "firstName": "Andy", "isVeteran": true, "buddyEmail": null, "skillRating": 4}, {"isGm": false, "email": "nandriacchi@hotmail.com", "isRef": false, "status": "Veteran", "lastName": "Andriacchi", "position": "Forward", "buddyPick": "Andy Schleive", "firstName": "Nick", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "trevor.greissinger@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Greissinger", "position": "Defense", "buddyPick": " ", "firstName": "Trevor", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "stefandavidson14@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Davidson", "position": "Defense", "buddyPick": " ", "firstName": "Stefan", "isVeteran": true, "buddyEmail": null, "skillRating": 4}, {"isGm": false, "email": "chargerhemi06@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Michel", "position": "Defense", "buddyPick": " ", "firstName": "Mike", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "stein.osu.293@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Stein", "position": "Forward", "buddyPick": " ", "firstName": "Avi", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "cmicon@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Micon", "position": "Forward", "buddyPick": " ", "firstName": "Craig", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "bwurtz@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Wurtz", "position": "Forward", "buddyPick": "Kevin McConnaughay", "firstName": "Robert", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "nickpwhite@gmail.com", "isRef": false, "status": "Veteran", "lastName": "White", "position": "Forward", "buddyPick": "Justin Luck", "firstName": "Nick", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "jrl9215@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Luck", "position": "Forward", "buddyPick": "Nick White", "firstName": "Justin", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "dbgauder@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Gauder", "position": "Forward", "buddyPick": " ", "firstName": "David", "isVeteran": true, "buddyEmail": null, "skillRating": 7}], "sortOption": "Position + Rating"}, {"id": 4, "name": "Team 4", "color": "Orange", "players": [{"isGm": true, "email": "hlinkam@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Hlinka", "position": "Defense", "buddyPick": "Daniel Wilson", "firstName": "Michael", "isVeteran": true, "buddyEmail": null, "skillRating": 10}, {"isGm": false, "email": "ticonderoga19@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Wilson", "position": "Defense", "buddyPick": "Cassidy Dabbs", "firstName": "Daniel", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "casdabbs34@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Dabbs", "position": "Forward", "buddyPick": "Daniel Wilson", "firstName": "Cassidy", "isVeteran": true, "buddyEmail": null, "skillRating": 4}, {"isGm": false, "email": "corylyle@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Peterson", "position": "Defense", "buddyPick": "Jesse Druckenbrod", "firstName": "Cory", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "wheeler.chris86@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Wheeler", "position": "Forward", "buddyPick": "Cory Peterson", "firstName": "Christopher", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "klaus839@yahoo.com", "isRef": false, "status": "Veteran", "lastName": "Klaus", "position": "Defense", "buddyPick": "Steve Baumann, Tom Fredrick", "firstName": "Michael", "isVeteran": true, "buddyEmail": null, "skillRating": 6}, {"isGm": false, "email": "hockeyphil65@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Baumann", "position": "Forward", "buddyPick": "Mike Klaus", "firstName": "Steve", "isVeteran": true, "buddyEmail": null, "skillRating": 5}, {"isGm": false, "email": "tannermschafer@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Schafer", "position": "Forward", "buddyPick": " ", "firstName": "Tanner", "isVeteran": false, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "gagehill0717@gmail.com", "isRef": true, "status": "Veteran", "lastName": "Hill", "position": "Forward", "buddyPick": "Tanner Schafer", "firstName": "Gage", "isVeteran": true, "buddyEmail": null, "skillRating": 9}, {"isGm": false, "email": "emmettherr@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Herr", "position": "Forward", "buddyPick": " ", "firstName": "Emmett", "isVeteran": true, "buddyEmail": null, "skillRating": 8}, {"isGm": false, "email": "kylejsteinberg@gmail.com", "isRef": false, "status": "Veteran", "lastName": "Steinberg", "position": "Forward", "buddyPick": " ", "firstName": "Kyle", "isVeteran": true, "buddyEmail": null, "skillRating": 7}, {"isGm": false, "email": "rogermdarling@gmail.com", "isRef": false, "status": "Rookie", "lastName": "Darling", "position": "Forward", "buddyPick": " ", "firstName": "Mason", "isVeteran": false, "buddyEmail": null, "skillRating": 6}], "sortOption": "Position + Rating"}], "isLive": true, "teamCount": 10, "playerPool": [], "seasonName": "2026 Winter C League"}	2026-01-06 00:06:48.074508	2026-01-06 06:08:27.413526
\.


--
-- Data for Name: game_events; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.game_events (id, game_id, team_id, player_id, event_type, period, time_minutes, time_seconds, description, assist1_player_id, assist2_player_id, penalty_minutes, created_at) FROM stdin;
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.games (id, season_id, league_id, home_team_id, away_team_id, game_date, venue, status, home_score, away_score, overtime, shootout, period, game_notes, created_at, updated_at, game_type, ended_in_ot, home_team_points, away_team_points, week, rink) FROM stdin;
241	12	\N	16	24	2026-01-10 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.596732	2026-01-09 15:46:09.596823	REGULAR_SEASON	f	0	0	1	Cardinal
242	12	\N	23	18	2026-01-10 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.699031	2026-01-09 15:46:09.69906	REGULAR_SEASON	f	0	0	1	Tubbs
243	12	\N	25	17	2026-01-10 04:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.7486	2026-01-09 15:46:09.748635	REGULAR_SEASON	f	0	0	1	Cardinal
244	12	\N	19	22	2026-01-10 04:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.801294	2026-01-09 15:46:09.801336	REGULAR_SEASON	f	0	0	1	Tubbs
245	12	\N	20	21	2026-01-10 02:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.848951	2026-01-09 15:46:09.848982	REGULAR_SEASON	f	0	0	1	Cardinal
248	12	\N	25	18	2026-01-17 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.001593	2026-01-09 15:46:10.001627	REGULAR_SEASON	f	0	0	2	Cardinal
249	12	\N	23	21	2026-01-17 03:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.049463	2026-01-09 15:46:10.0495	REGULAR_SEASON	f	0	0	2	Tubbs
250	12	\N	20	17	2026-01-17 04:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.096851	2026-01-09 15:46:10.096882	REGULAR_SEASON	f	0	0	2	Cardinal
254	12	\N	20	18	2026-01-31 03:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.300287	2026-01-09 15:46:10.300319	REGULAR_SEASON	f	0	0	3	Tubbs
256	12	\N	25	16	2026-02-07 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.395878	2026-01-09 15:46:10.395916	REGULAR_SEASON	f	0	0	4	Cardinal
257	12	\N	22	21	2026-02-07 01:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.449264	2026-01-09 15:46:10.449315	REGULAR_SEASON	f	0	0	4	Tubbs
258	12	\N	20	23	2026-02-07 02:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.499427	2026-01-09 15:46:10.499469	REGULAR_SEASON	f	0	0	4	Cardinal
259	12	\N	24	17	2026-02-07 03:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.554375	2026-01-09 15:46:10.554423	REGULAR_SEASON	f	0	0	4	Tubbs
260	12	\N	19	18	2026-02-07 04:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.609505	2026-01-09 15:46:10.609543	REGULAR_SEASON	f	0	0	4	Cardinal
262	12	\N	20	25	2026-02-14 01:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.7139	2026-01-09 15:46:10.713945	REGULAR_SEASON	f	0	0	5	Tubbs
263	12	\N	22	17	2026-02-14 03:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.765072	2026-01-09 15:46:10.765114	REGULAR_SEASON	f	0	0	5	Tubbs
265	12	\N	24	18	2026-02-14 04:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.858097	2026-01-09 15:46:10.858148	REGULAR_SEASON	f	0	0	5	Tubbs
266	12	\N	20	16	2026-02-21 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.903964	2026-01-09 15:46:10.903995	REGULAR_SEASON	f	0	0	6	Tubbs
267	12	\N	21	17	2026-02-21 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.949277	2026-01-09 15:46:10.949312	REGULAR_SEASON	f	0	0	6	Tubbs
268	12	\N	19	25	2026-02-21 02:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.995765	2026-01-09 15:46:10.9958	REGULAR_SEASON	f	0	0	6	Cardinal
269	12	\N	22	18	2026-02-21 04:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.044047	2026-01-09 15:46:11.044086	REGULAR_SEASON	f	0	0	6	Tubbs
270	12	\N	24	23	2026-02-21 04:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.088636	2026-01-09 15:46:11.088667	REGULAR_SEASON	f	0	0	6	Cardinal
271	12	\N	16	17	2026-02-28 00:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.135958	2026-01-09 15:46:11.135996	REGULAR_SEASON	f	0	0	7	Cardinal
272	12	\N	19	20	2026-02-28 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.186119	2026-01-09 15:46:11.186175	REGULAR_SEASON	f	0	0	7	Tubbs
273	12	\N	21	18	2026-02-28 02:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.231344	2026-01-09 15:46:11.231384	REGULAR_SEASON	f	0	0	7	Cardinal
274	12	\N	24	25	2026-02-28 02:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.27808	2026-01-09 15:46:11.27811	REGULAR_SEASON	f	0	0	7	Tubbs
275	12	\N	22	23	2026-02-28 03:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.324691	2026-01-09 15:46:11.324723	REGULAR_SEASON	f	0	0	7	Cardinal
276	12	\N	19	16	2026-03-07 00:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.370547	2026-01-09 15:46:11.37058	REGULAR_SEASON	f	0	0	8	Cardinal
277	12	\N	17	18	2026-03-07 01:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.414479	2026-01-09 15:46:11.414515	REGULAR_SEASON	f	0	0	8	Tubbs
278	12	\N	24	20	2026-03-07 02:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.470414	2026-01-09 15:46:11.470457	REGULAR_SEASON	f	0	0	8	Cardinal
279	12	\N	21	23	2026-03-07 03:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.542018	2026-01-09 15:46:11.542074	REGULAR_SEASON	f	0	0	8	Tubbs
280	12	\N	22	25	2026-03-07 03:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.604717	2026-01-09 15:46:11.60476	REGULAR_SEASON	f	0	0	8	Cardinal
281	12	\N	16	18	2026-03-13 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.658007	2026-01-09 15:46:11.658049	REGULAR_SEASON	f	0	0	9	Cardinal
282	12	\N	24	19	2026-03-14 00:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.715072	2026-01-09 15:46:11.715114	REGULAR_SEASON	f	0	0	9	Tubbs
283	12	\N	17	23	2026-03-14 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.767066	2026-01-09 15:46:11.767106	REGULAR_SEASON	f	0	0	9	Cardinal
284	12	\N	22	20	2026-03-14 02:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.819712	2026-01-09 15:46:11.81975	REGULAR_SEASON	f	0	0	9	Tubbs
285	12	\N	21	25	2026-03-14 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.870893	2026-01-09 15:46:11.870931	REGULAR_SEASON	f	0	0	9	Cardinal
286	12	\N	24	16	2026-03-20 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.922217	2026-01-09 15:46:11.922258	REGULAR_SEASON	f	0	0	10	Cardinal
287	12	\N	18	23	2026-03-21 00:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:11.969524	2026-01-09 15:46:11.969554	REGULAR_SEASON	f	0	0	10	Tubbs
288	12	\N	22	19	2026-03-21 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.01627	2026-01-09 15:46:12.016301	REGULAR_SEASON	f	0	0	10	Cardinal
289	12	\N	17	25	2026-03-21 02:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.062034	2026-01-09 15:46:12.062078	REGULAR_SEASON	f	0	0	10	Tubbs
247	12	\N	24	19	2026-01-17 02:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.951247	2026-01-09 15:49:32.109932	REGULAR_SEASON	f	0	0	2	Tubbs
251	12	\N	25	22	2026-01-24 03:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.147688	2026-01-09 15:49:32.15684	REGULAR_SEASON	f	0	0	3	Cardinal
252	12	\N	16	23	2026-01-24 04:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.204624	2026-01-09 15:49:32.201587	REGULAR_SEASON	f	0	0	3	Tubbs
253	12	\N	19	17	2026-01-30 03:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.253025	2026-01-09 15:57:44.835281	REGULAR_SEASON	f	0	0	3	Tubbs
255	12	\N	24	21	2026-01-31 04:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.3456	2026-01-09 15:57:44.884626	REGULAR_SEASON	f	0	0	3	Cardinal
261	12	\N	19	23	2026-02-13 03:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.662691	2026-01-09 15:57:44.934617	REGULAR_SEASON	f	0	0	5	Cardinal
264	12	\N	16	21	2026-02-14 03:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:10.812514	2026-01-09 15:57:44.983815	REGULAR_SEASON	f	0	0	5	Cardinal
290	12	\N	21	20	2026-03-21 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.106987	2026-01-09 15:46:12.107018	REGULAR_SEASON	f	0	0	10	Cardinal
291	12	\N	16	23	2026-03-27 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.150798	2026-01-09 15:46:12.150842	REGULAR_SEASON	f	0	0	11	Cardinal
292	12	\N	22	24	2026-03-27 23:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.193991	2026-01-09 15:46:12.194025	REGULAR_SEASON	f	0	0	11	Tubbs
293	12	\N	18	25	2026-03-28 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.239555	2026-01-09 15:46:12.239587	REGULAR_SEASON	f	0	0	11	Cardinal
294	12	\N	21	19	2026-03-28 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.288071	2026-01-09 15:46:12.288103	REGULAR_SEASON	f	0	0	11	Tubbs
295	12	\N	17	20	2026-03-28 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.336146	2026-01-09 15:46:12.336186	REGULAR_SEASON	f	0	0	11	Cardinal
296	12	\N	22	16	2026-04-03 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.379271	2026-01-09 15:46:12.379301	REGULAR_SEASON	f	0	0	12	Cardinal
297	12	\N	23	25	2026-04-03 23:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.422055	2026-01-09 15:46:12.4221	REGULAR_SEASON	f	0	0	12	Tubbs
298	12	\N	21	24	2026-04-04 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.469383	2026-01-09 15:46:12.469413	REGULAR_SEASON	f	0	0	12	Cardinal
299	12	\N	18	20	2026-04-04 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.512516	2026-01-09 15:46:12.512547	REGULAR_SEASON	f	0	0	12	Tubbs
300	12	\N	17	19	2026-04-04 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.555781	2026-01-09 15:46:12.555811	REGULAR_SEASON	f	0	0	12	Cardinal
301	12	\N	16	25	2026-04-10 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.599017	2026-01-09 15:46:12.599047	REGULAR_SEASON	f	0	0	13	Cardinal
302	12	\N	21	22	2026-04-10 23:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.642927	2026-01-09 15:46:12.642965	REGULAR_SEASON	f	0	0	13	Tubbs
303	12	\N	23	20	2026-04-11 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.688942	2026-01-09 15:46:12.688973	REGULAR_SEASON	f	0	0	13	Cardinal
304	12	\N	17	24	2026-04-11 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.735683	2026-01-09 15:46:12.735714	REGULAR_SEASON	f	0	0	13	Tubbs
305	12	\N	18	19	2026-04-11 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.782078	2026-01-09 15:46:12.782107	REGULAR_SEASON	f	0	0	13	Cardinal
306	12	\N	21	16	2026-04-17 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.830058	2026-01-09 15:46:12.83009	REGULAR_SEASON	f	0	0	14	Cardinal
307	12	\N	25	20	2026-04-17 23:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.878881	2026-01-09 15:46:12.878913	REGULAR_SEASON	f	0	0	14	Tubbs
308	12	\N	17	22	2026-04-18 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.925484	2026-01-09 15:46:12.925515	REGULAR_SEASON	f	0	0	14	Cardinal
309	12	\N	23	19	2026-04-18 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:12.969539	2026-01-09 15:46:12.969569	REGULAR_SEASON	f	0	0	14	Tubbs
310	12	\N	18	24	2026-04-18 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.013004	2026-01-09 15:46:13.013034	REGULAR_SEASON	f	0	0	14	Cardinal
311	12	\N	16	20	2026-04-24 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.055793	2026-01-09 15:46:13.055829	REGULAR_SEASON	f	0	0	15	Cardinal
312	12	\N	17	21	2026-04-24 23:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.100935	2026-01-09 15:46:13.100965	REGULAR_SEASON	f	0	0	15	Tubbs
313	12	\N	25	19	2026-04-25 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.144814	2026-01-09 15:46:13.144844	REGULAR_SEASON	f	0	0	15	Cardinal
314	12	\N	18	22	2026-04-25 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.188179	2026-01-09 15:46:13.188213	REGULAR_SEASON	f	0	0	15	Tubbs
315	12	\N	23	24	2026-04-25 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.23261	2026-01-09 15:46:13.232643	REGULAR_SEASON	f	0	0	15	Cardinal
316	12	\N	17	16	2026-05-01 23:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.27566	2026-01-09 15:46:13.275705	REGULAR_SEASON	f	0	0	16	Cardinal
317	12	\N	20	19	2026-05-01 23:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.31931	2026-01-09 15:46:13.319336	REGULAR_SEASON	f	0	0	16	Tubbs
318	12	\N	18	21	2026-05-02 01:00:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.363813	2026-01-09 15:46:13.36384	REGULAR_SEASON	f	0	0	16	Cardinal
319	12	\N	25	24	2026-05-02 01:15:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.406897	2026-01-09 15:46:13.406924	REGULAR_SEASON	f	0	0	16	Tubbs
320	12	\N	23	22	2026-05-02 02:30:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:13.451536	2026-01-09 15:46:13.451563	REGULAR_SEASON	f	0	0	16	Cardinal
246	12	\N	22	16	2026-01-16 03:45:00	\N	scheduled	0	0	f	f	1	\N	2026-01-09 15:46:09.901438	2026-01-09 15:49:32.047977	REGULAR_SEASON	f	0	0	2	Cardinal
\.


--
-- Data for Name: goalie_stats; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.goalie_stats (id, player_id, season_id, team_id, games_played, games_started, wins, losses, overtime_losses, shutouts, saves, shots_against, goals_against, save_percentage, goals_against_average, minutes_played, penalty_minutes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: leagues; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.leagues (id, season_id, name, abbreviation, description, league_type, display_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: penalty_tracking; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.penalty_tracking (id, player_id, game_id, penalty_count, is_ejected, is_suspended_next_game, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: player_stats; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.player_stats (id, player_id, season_id, team_id, games_played, goals, assists, points, plus_minus, penalty_minutes, power_play_goals, power_play_assists, short_handed_goals, short_handed_assists, game_winning_goals, shots, shooting_percentage, faceoff_wins, faceoff_losses, hits, blocked_shots, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.players (id, team_id, first_name, last_name, jersey_number, "position", shoots, height_inches, weight_lbs, birth_date, hometown, is_active, created_at, updated_at, skill_rating, email, is_veteran, season_id) FROM stdin;
127	16	Alex	Hohlstein	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.208578	2026-01-06 06:08:24.208609	8	alexhohlstein@yahoo.com	t	12
128	16	Zack	Fyler	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.254404	2026-01-06 06:08:24.254438	8	zfyler1@gmail.com	t	12
129	16	Jacob	Lavigne	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.284339	2026-01-06 06:08:24.284368	8	lavignejr15@gmail.com	t	12
130	16	Matt	Coobac	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.302036	2026-01-06 06:08:24.302069	9	coobacmz@me.com	t	12
131	16	Briana	Cronk	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.32152	2026-01-06 06:08:24.321551	4	brianacronk@gmail.com	t	12
132	16	Jim	Ertel	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.337722	2026-01-06 06:08:24.337749	7	jamesertel04@gmail.com	t	12
133	16	Mike	Dunk	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.359789	2026-01-06 06:08:24.359821	2	mdunk@chorus.net	t	12
134	16	Ben	Martin	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.377575	2026-01-06 06:08:24.377615	7	bnnitram@yahoo.com	t	12
135	16	Cody	Gill	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.396494	2026-01-06 06:08:24.396522	5	thecodster@gmail.com	t	12
136	16	Brock	Schupp	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.414707	2026-01-06 06:08:24.414734	9	brockwschupp@gmail.com	f	12
137	16	Joseph	Johns	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.432124	2026-01-06 06:08:24.432156	7	josephjohnsiv@gmail.com	t	12
138	16	Christopher	Lewis	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.461976	2026-01-06 06:08:24.462013	6	chrislewis8843@gmail.com	t	12
139	16	Bryce	Loken	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.495887	2026-01-06 06:08:24.495917	6	bloken21@gmail.com	t	12
140	17	Tom	Behnke	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.605755	2026-01-06 06:08:24.605787	8	tbehnks11@yahoo.com	t	12
141	17	Joe	Goldfine	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.633016	2026-01-06 06:08:24.633059	10	josephbgoldfine@gmail.com	t	12
142	17	JD	O’Connell	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.657414	2026-01-06 06:08:24.657451	8	johndoconnell5@gmail.com	f	12
143	17	Andrew	Bernath	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.69257	2026-01-06 06:08:24.692605	4	A_bernath@hotmail.com	t	12
144	17	Bradley	Templeton	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.7276	2026-01-06 06:08:24.72764	6	btempleton123@gmail.com	t	12
145	17	Hans	Pflieger	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.773709	2026-01-06 06:08:24.773749	5	hpflieger@yahoo.com	t	12
146	17	Amy	May	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.810864	2026-01-06 06:08:24.810896	3	mamyay@hotmail.com	t	12
147	17	Chris	Bruns	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.838995	2026-01-06 06:08:24.839031	9	cjbruns10910@gmail.com	t	12
148	17	Jesse	Sherman	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.859355	2026-01-06 06:08:24.859389	5	thunder56082@yahoo.com	t	12
149	17	George	Botts	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.888586	2026-01-06 06:08:24.888628	8	gembotts@gmail.com	t	12
150	17	Benjamin	Bouche	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.920073	2026-01-06 06:08:24.920108	7	bbouche@findorff.com	t	12
151	17	Alex	Wood-Doughty	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.953484	2026-01-06 06:08:24.953511	8	sccrhockylax@gmail.com	f	12
152	17	Andy	Winn	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:24.981063	2026-01-06 06:08:24.981093	5	winnap@gmail.com	t	12
153	18	Joshua 	Lind	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.108193	2026-01-06 06:08:25.108225	6	jtlind@gmail.com	t	12
154	18	Greg	Lind	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.142026	2026-01-06 06:08:25.142062	6	gm_lind@yahoo.com	t	12
155	18	Cody	James	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.16611	2026-01-06 06:08:25.166146	9	cjduli@yahoo.com	t	12
156	18	Ella	Ausman	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.192026	2026-01-06 06:08:25.192059	8	ausmanella@gmail.com	f	12
157	18	Logan	Williams	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.213049	2026-01-06 06:08:25.213078	8	logstogs@gmail.com	t	12
158	18	Aaron	White	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.234034	2026-01-06 06:08:25.234065	6	abwhitedesign@gmail.com	t	12
159	18	Timothy	Williams	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.252358	2026-01-06 06:08:25.252389	3	tdubbs2@gmail.com	t	12
160	18	Cole	Simmons	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.275084	2026-01-06 06:08:25.275125	7	simmonscs28@gmail.com	t	12
161	18	Nolan	Stapelfeldt	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.293872	2026-01-06 06:08:25.293903	9	ntstapelfeldt@gmail.com	f	12
162	18	Brian	Geiger	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.313341	2026-01-06 06:08:25.313371	8	geiger_brian@rocketmail.com	t	12
163	18	Joel	Anderson	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.332989	2026-01-06 06:08:25.333022	7	andersjoel@gmail.com	t	12
164	18	Scott	Cumming	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.350556	2026-01-06 06:08:25.350581	5	cougartreasurer2019@gmail.com	t	12
165	18	Aaron	Krehbiel	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.372709	2026-01-06 06:08:25.372751	5	krehwen@gmail.com	t	12
166	19	Phillip	Pedracine	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.445092	2026-01-06 06:08:25.445122	8	pedracine_phillip@hotmail.com	t	12
167	19	Peter	Bormann	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.460722	2026-01-06 06:08:25.460753	8	pmbormann@hotmail.com	t	12
168	19	Goodwin	Lyons	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.480441	2026-01-06 06:08:25.480475	9	winn.lyons94@gmail.com	t	12
169	19	Matt	Muzzy	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.498772	2026-01-06 06:08:25.498804	3	mcmuzzcm@icloud.com	t	12
170	19	Zachary	Barnetzke	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.515905	2026-01-06 06:08:25.515936	5	zbarnetzke@gmail.com	t	12
171	19	Jason	Kent	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.537265	2026-01-06 06:08:25.537297	9	Jasonkent24@yahoo.com	t	12
172	19	Jeffrey	Schmidt	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.556751	2026-01-06 06:08:25.556783	7	purpleice25@yahoo.com	t	12
173	19	Steven	Stone	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.581448	2026-01-06 06:08:25.581482	7	sotnar@gmail.com	t	12
174	19	Bret	Waterman	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.603139	2026-01-06 06:08:25.603171	6	bwaterman2323@gmail.com	t	12
175	19	Jimmy	Friedle	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.623819	2026-01-06 06:08:25.623853	7	jfriedle96@gmail.com	t	12
176	19	Jeff	Schneider	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.64701	2026-01-06 06:08:25.647053	5	jjrschneid@gmail.com	t	12
177	19	Michael	Ruff	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.670014	2026-01-06 06:08:25.67004	7	mruff12@gmail.com	f	12
178	20	Brian	Stephenson	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.739418	2026-01-06 06:08:25.739445	9	bstephenson014@gmail.com	t	12
179	20	Kyle	Stephenson	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.752764	2026-01-06 06:08:25.752803	9	kstephenson93@gmail.com	t	12
180	20	John	Podgorski	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.768115	2026-01-06 06:08:25.768137	7	pod526@hotmail.com	t	12
181	20	John	Steinbergs	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.793268	2026-01-06 06:08:25.793298	9	jarsteinbergs@proton.me	t	12
182	20	Peter	Robinson	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.814717	2026-01-06 06:08:25.814744	6	robinson.peter.c@gmail.com	f	12
183	20	Todd	Haglind	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.834967	2026-01-06 06:08:25.835017	6	tjhaglind@mac.com	t	12
184	20	Casey	Hogan	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.854893	2026-01-06 06:08:25.85492	3	ishimurazero@gmail.com	t	12
185	20	Ryan	Olstad	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.873802	2026-01-06 06:08:25.873829	7	ryanolstad44@gmail.com	t	12
186	20	Drew	Arvold	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.891993	2026-01-06 06:08:25.89202	5	darvold88@gmail.com	t	12
187	20	Bryan	Schreiter	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.922571	2026-01-06 06:08:25.9226	8	bryanschreiter@yahoo.com	t	12
188	20	Toby	Garrod	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.944146	2026-01-06 06:08:25.944175	7	Toby.garrod24@gmail.com	f	12
189	20	Jacob	Stamas	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:25.959875	2026-01-06 06:08:25.959907	5	jakestamas@gmail.com	t	12
190	21	Chris	Culver	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.034578	2026-01-06 06:08:26.034607	7	chrsculver@gmail.com	t	12
191	21	Alexander	Suchon	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.063649	2026-01-06 06:08:26.063678	7	alexandersuchon@gmail.com	t	12
192	21	Andrew	Iordachescu	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.098461	2026-01-06 06:08:26.098526	7	gteeiguy@yahoo.com	t	12
193	21	Mike	Klahn	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.130382	2026-01-06 06:08:26.13046	5	spfdklahn@gmail.com	t	12
194	21	Timothy	Williams	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.15654	2026-01-06 06:08:26.156568	9	tim.williams.wi@gmail.com	t	12
195	21	Bryan	Pierce	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.185122	2026-01-06 06:08:26.185151	5	bryantimothypierce@gmail.com	t	12
196	21	Mark	Gernetzke	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.209691	2026-01-06 06:08:26.209717	10	mag1_46@hotmail.com	t	12
197	21	Richard	Sullivan	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.234886	2026-01-06 06:08:26.234913	7	sullivanrp2@gmail.com	t	12
198	21	Adam	Rogers	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.258847	2026-01-06 06:08:26.258872	5	yzzi19@msn.com	t	12
199	21	Michael	Diedrich	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.281863	2026-01-06 06:08:26.28189	7	dadman0901@gmail.com	t	12
200	21	Ryan	Koltes	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.309666	2026-01-06 06:08:26.30969	6	lilkoltes@gmail.com	t	12
201	21	Ted	Marshall	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.334193	2026-01-06 06:08:26.334238	6	tmrshll1@gmail.com	t	12
202	22	Jake	Ruesch	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.41939	2026-01-06 06:08:26.419421	10	jsruesch@gmail.com	t	12
203	22	Matthew	Ralph	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.446913	2026-01-06 06:08:26.449389	10	mralph1009@gmail.com	t	12
204	22	Michael	Ralph	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.470756	2026-01-06 06:08:26.470782	7	mralph@live.com	t	12
205	22	Jeff	Vincent	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.499127	2026-01-06 06:08:26.499169	4	fuoco911@gmail.com	t	12
206	22	Jeff	Wilcenski	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.517363	2026-01-06 06:08:26.517399	8	jeff@wilcenski.com	t	12
207	22	Chris	Van Syckel	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.538065	2026-01-06 06:08:26.5381	5	zamdriver3@yahoo.com	t	12
208	22	Jeff	Thornton	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.563334	2026-01-06 06:08:26.56336	5	thornton.jeffw@gmail.com	t	12
209	22	Rob	Malkovich	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.578228	2026-01-06 06:08:26.578253	8	jedimalkovich@gmail.com	t	12
210	22	Christopher	Martin	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.593707	2026-01-06 06:08:26.593734	6	tophermartin55@gmail.com	t	12
211	22	Austin	Steinbach	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.612668	2026-01-06 06:08:26.612697	8	austinsteinbach@gmail.com	t	12
212	22	Luke	Kreiter	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.631607	2026-01-06 06:08:26.631633	7	kball2297@gmail.com	t	12
213	22	Steven	LaScola	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.647884	2026-01-06 06:08:26.647909	5	stevenlascola@gmail.com	f	12
214	22	Jamison	Grailer	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.660618	2026-01-06 06:08:26.660644	5	jjgrailer@gmail.com	t	12
215	23	Jon	Rogers	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.714095	2026-01-06 06:08:26.714115	6	jon_rogers@trekbikes.com	t	12
216	23	Matt	Severson	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.7254	2026-01-06 06:08:26.725421	7	mattjseverson@gmail.com	t	12
217	23	Brad	Davenport	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.737449	2026-01-06 06:08:26.737469	9	gbradleydavenport@gmail.com	t	12
218	23	Anthony	Gackstetter	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.749648	2026-01-06 06:08:26.749674	7	tonygackstetter@gmail.com	t	12
219	23	Nick	Weisensel	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.764562	2026-01-06 06:08:26.764587	8	yzee4@yahoo.com	t	12
220	23	Robert	Karsten	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.776541	2026-01-06 06:08:26.776567	8	karstenrob@yahoo.com	t	12
221	23	Robert	Gould	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.799665	2026-01-06 06:08:26.799695	1	hockeybob64@gmail.com	t	12
222	23	Victor	Kachan	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.826461	2026-01-06 06:08:26.826496	9	kachan.victor@gmail.com	t	12
223	23	Nikolas	Ludzenieks	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.84213	2026-01-06 06:08:26.842155	5	nikolastreecare@gmail.com	t	12
224	23	Matt	Labron	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.86119	2026-01-06 06:08:26.861213	9	m_labron@hotmail.com	t	12
225	23	Derek	Parker	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.875191	2026-01-06 06:08:26.875214	6	parker.dere@gmail.com	t	12
226	23	Henry	Sotsaikich	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.894393	2026-01-06 06:08:26.894429	7	hsotsai@gmail.com	t	12
227	23	Ryan	Sullivan	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.907571	2026-01-06 06:08:26.907594	6	ryanhavilandsullivan3@gmail.com	f	12
228	24	Kevin	McConnaughay	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.963253	2026-01-06 06:08:26.963273	8	kevin.mcconnaughay@gmail.com	t	12
229	24	Andy	Schlieve	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.977394	2026-01-06 06:08:26.977415	4	andythearborist@gmail.com	t	12
230	24	Nick	Andriacchi	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:26.988846	2026-01-06 06:08:26.988872	7	nandriacchi@hotmail.com	t	12
231	24	Trevor	Greissinger	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.003842	2026-01-06 06:08:27.003865	9	trevor.greissinger@gmail.com	t	12
232	24	Stefan	Davidson	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.019359	2026-01-06 06:08:27.019402	4	stefandavidson14@gmail.com	t	12
233	24	Mike	Michel	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.035605	2026-01-06 06:08:27.035629	7	chargerhemi06@yahoo.com	t	12
234	24	Avi	Stein	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.048476	2026-01-06 06:08:27.048495	9	stein.osu.293@gmail.com	t	12
235	24	Craig	Micon	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.060598	2026-01-06 06:08:27.060618	8	cmicon@gmail.com	t	12
236	24	Robert	Wurtz	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.078788	2026-01-06 06:08:27.078808	6	bwurtz@gmail.com	t	12
237	24	Nick	White	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.0899	2026-01-06 06:08:27.089923	8	nickpwhite@gmail.com	t	12
238	24	Justin	Luck	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.110341	2026-01-06 06:08:27.110369	5	jrl9215@gmail.com	t	12
239	24	David	Gauder	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.124163	2026-01-06 06:08:27.12419	7	dbgauder@yahoo.com	t	12
240	25	Michael	Hlinka	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.18513	2026-01-06 06:08:27.18515	10	hlinkam@yahoo.com	t	12
241	25	Daniel	Wilson	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.201249	2026-01-06 06:08:27.201272	8	ticonderoga19@gmail.com	t	12
242	25	Cassidy	Dabbs	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.219505	2026-01-06 06:08:27.219528	4	casdabbs34@gmail.com	t	12
243	25	Cory	Peterson	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.233346	2026-01-06 06:08:27.233371	5	corylyle@gmail.com	t	12
244	25	Christopher	Wheeler	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.24508	2026-01-06 06:08:27.245102	5	wheeler.chris86@gmail.com	t	12
245	25	Michael	Klaus	\N	D	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.26665	2026-01-06 06:08:27.266672	6	klaus839@yahoo.com	t	12
246	25	Steve	Baumann	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.28021	2026-01-06 06:08:27.280235	5	hockeyphil65@gmail.com	t	12
247	25	Tanner	Schafer	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.293182	2026-01-06 06:08:27.293204	9	tannermschafer@gmail.com	f	12
248	25	Gage	Hill	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.307209	2026-01-06 06:08:27.307232	9	gagehill0717@gmail.com	t	12
249	25	Emmett	Herr	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.323216	2026-01-06 06:08:27.323238	8	emmettherr@gmail.com	t	12
250	25	Kyle	Steinberg	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.343674	2026-01-06 06:08:27.3437	7	kylejsteinberg@gmail.com	t	12
251	25	Mason	Darling	\N	F	\N	\N	\N	\N	\N	t	2026-01-06 06:08:27.364567	2026-01-06 06:08:27.364593	6	rogermdarling@gmail.com	f	12
\.


--
-- Data for Name: seasons; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.seasons (id, name, start_date, end_date, status, is_active, created_at, updated_at) FROM stdin;
12	2026 Winter C League	2026-01-09	2026-05-22	active	t	2026-01-06 06:08:24.048696	2026-01-06 22:36:17.566163
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.teams (id, name, abbreviation, season_id, logo_url, team_color, gm_id, active, points, wins, losses, ties, overtime_wins, overtime_losses, goals_for, goals_against, created_at, updated_at) FROM stdin;
16	White	WHI	12	\N	White	127	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:24.126963	2026-01-06 06:08:24.519868
18	Gray	GRA	12	\N	Gray	153	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:25.069976	2026-01-06 06:08:25.396324
19	Maroon	MAR	12	\N	Maroon	166	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:25.426897	2026-01-06 06:08:25.683755
17	Thee Lt. Blue	LB	12	\N	Lt. Blu	140	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:24.567373	2026-01-06 22:23:14.139204
20	Red	T6	12	\N	#FF0000	178	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:25.711525	2026-01-06 22:27:53.694899
21	Blue	BL	12	\N	#0000FF	190	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:26.003847	2026-01-06 22:28:26.766445
25	Orange	OR	12	\N	#FFA500	240	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:27.159786	2026-01-06 22:29:13.792649
22	Green	GR	12	\N	#008000	202	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:26.391238	2026-01-06 22:29:34.144457
23	Black	BK	12	\N	#000000	215	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:26.697576	2026-01-06 22:31:38.039583
24	Tan	TN	12	\N	#D2B48C	228	t	0	0	0	0	0	0	0	0	2026-01-06 06:08:26.946408	2026-01-06 22:34:43.8734
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: obhl_admin
--

COPY public.users (id, username, email, password_hash, role, team_id, is_active, created_at, updated_at) FROM stdin;
1	simmonscs28	simmonscs28@gmail.com	$2b$12$ebChXcYS.pjSP8Dd9q7TZebaCdQ9mw8HSQbciWg9WTRPkdGuJiAGq	ADMIN	\N	t	2026-01-05 06:12:02.217203	2026-01-05 06:12:02.217203
\.


--
-- Name: draft_saves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.draft_saves_id_seq', 1, true);


--
-- Name: game_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.game_events_id_seq', 1, false);


--
-- Name: games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.games_id_seq', 320, true);


--
-- Name: goalie_stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.goalie_stats_id_seq', 1, false);


--
-- Name: leagues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.leagues_id_seq', 1, false);


--
-- Name: penalty_tracking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.penalty_tracking_id_seq', 1, false);


--
-- Name: player_stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.player_stats_id_seq', 1, false);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.players_id_seq', 251, true);


--
-- Name: seasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.seasons_id_seq', 12, true);


--
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.teams_id_seq', 25, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: obhl_admin
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: draft_saves draft_saves_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.draft_saves
    ADD CONSTRAINT draft_saves_pkey PRIMARY KEY (id);


--
-- Name: game_events game_events_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT game_events_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: goalie_stats goalie_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.goalie_stats
    ADD CONSTRAINT goalie_stats_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);


--
-- Name: penalty_tracking penalty_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.penalty_tracking
    ADD CONSTRAINT penalty_tracking_pkey PRIMARY KEY (id);


--
-- Name: player_stats player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_pkey PRIMARY KEY (id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_name_key; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_name_key UNIQUE (name);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: teams teams_name_season_unique; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_season_unique UNIQUE (name, season_id);


--
-- Name: CONSTRAINT teams_name_season_unique ON teams; Type: COMMENT; Schema: public; Owner: obhl_admin
--

COMMENT ON CONSTRAINT teams_name_season_unique ON public.teams IS 'Team names must be unique within a season';


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: teams ukaqy97bpx5mar150vkteybwf52; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT ukaqy97bpx5mar150vkteybwf52 UNIQUE (abbreviation, season_id);


--
-- Name: players ukco6ldxed51gm1elmpk5anlusa; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT ukco6ldxed51gm1elmpk5anlusa UNIQUE (email, season_id);


--
-- Name: teams uknv0mkd6nfxdo4dnnko61e94xj; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT uknv0mkd6nfxdo4dnnko61e94xj UNIQUE (name, season_id);


--
-- Name: penalty_tracking unique_player_game; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.penalty_tracking
    ADD CONSTRAINT unique_player_game UNIQUE (player_id, game_id);


--
-- Name: goalie_stats uq_goalie_season; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.goalie_stats
    ADD CONSTRAINT uq_goalie_season UNIQUE (player_id, season_id);


--
-- Name: leagues uq_league_season_name; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT uq_league_season_name UNIQUE (season_id, name);


--
-- Name: player_stats uq_player_season; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT uq_player_season UNIQUE (player_id, season_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_draft_saves_created_at; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_draft_saves_created_at ON public.draft_saves USING btree (created_at DESC);


--
-- Name: idx_draft_saves_status; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_draft_saves_status ON public.draft_saves USING btree (status);


--
-- Name: idx_events_game; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_events_game ON public.game_events USING btree (game_id);


--
-- Name: idx_events_period; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_events_period ON public.game_events USING btree (period);


--
-- Name: idx_events_player; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_events_player ON public.game_events USING btree (player_id);


--
-- Name: idx_events_team; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_events_team ON public.game_events USING btree (team_id);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_events_type ON public.game_events USING btree (event_type);


--
-- Name: idx_games_away_team; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_away_team ON public.games USING btree (away_team_id);


--
-- Name: idx_games_date; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_date ON public.games USING btree (game_date);


--
-- Name: idx_games_home_team; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_home_team ON public.games USING btree (home_team_id);


--
-- Name: idx_games_league; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_league ON public.games USING btree (league_id);


--
-- Name: idx_games_season; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_season ON public.games USING btree (season_id);


--
-- Name: idx_games_season_week; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_season_week ON public.games USING btree (season_id, week);


--
-- Name: idx_games_status; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_status ON public.games USING btree (status);


--
-- Name: idx_games_type; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_type ON public.games USING btree (game_type);


--
-- Name: idx_games_week; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_games_week ON public.games USING btree (week);


--
-- Name: idx_gstats_gaa; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_gstats_gaa ON public.goalie_stats USING btree (goals_against_average);


--
-- Name: idx_gstats_player; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_gstats_player ON public.goalie_stats USING btree (player_id);


--
-- Name: idx_gstats_save_pct; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_gstats_save_pct ON public.goalie_stats USING btree (save_percentage DESC);


--
-- Name: idx_gstats_season; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_gstats_season ON public.goalie_stats USING btree (season_id);


--
-- Name: idx_gstats_team; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_gstats_team ON public.goalie_stats USING btree (team_id);


--
-- Name: idx_leagues_season; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_leagues_season ON public.leagues USING btree (season_id);


--
-- Name: idx_leagues_type; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_leagues_type ON public.leagues USING btree (league_type);


--
-- Name: idx_penalty_ejected; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_penalty_ejected ON public.penalty_tracking USING btree (is_ejected);


--
-- Name: idx_penalty_game; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_penalty_game ON public.penalty_tracking USING btree (game_id);


--
-- Name: idx_penalty_player; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_penalty_player ON public.penalty_tracking USING btree (player_id);


--
-- Name: idx_penalty_suspended; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_penalty_suspended ON public.penalty_tracking USING btree (is_suspended_next_game);


--
-- Name: idx_players_active; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_players_active ON public.players USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_players_name; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_players_name ON public.players USING btree (last_name, first_name);


--
-- Name: idx_players_position; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_players_position ON public.players USING btree ("position");


--
-- Name: idx_players_team; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_players_team ON public.players USING btree (team_id);


--
-- Name: idx_pstats_goals; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_pstats_goals ON public.player_stats USING btree (goals DESC);


--
-- Name: idx_pstats_player; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_pstats_player ON public.player_stats USING btree (player_id);


--
-- Name: idx_pstats_points; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_pstats_points ON public.player_stats USING btree (points DESC);


--
-- Name: idx_pstats_season; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_pstats_season ON public.player_stats USING btree (season_id);


--
-- Name: idx_pstats_team; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_pstats_team ON public.player_stats USING btree (team_id);


--
-- Name: idx_seasons_active; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_seasons_active ON public.seasons USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_seasons_status; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_seasons_status ON public.seasons USING btree (status);


--
-- Name: idx_teams_active; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_teams_active ON public.teams USING btree (active) WHERE (active = true);


--
-- Name: idx_teams_points; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_teams_points ON public.teams USING btree (points DESC);


--
-- Name: idx_teams_season; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_teams_season ON public.teams USING btree (season_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_team_id; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_users_team_id ON public.users USING btree (team_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: obhl_admin
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: game_events fk_event_assist1; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT fk_event_assist1 FOREIGN KEY (assist1_player_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: game_events fk_event_assist2; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT fk_event_assist2 FOREIGN KEY (assist2_player_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: game_events fk_event_game; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT fk_event_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: game_events fk_event_player; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT fk_event_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: game_events fk_event_team; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT fk_event_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: games fk_game_away_team; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT fk_game_away_team FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: games fk_game_home_team; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT fk_game_home_team FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: games fk_game_league; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT fk_game_league FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE SET NULL;


--
-- Name: games fk_game_season; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT fk_game_season FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: goalie_stats fk_gstats_player; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.goalie_stats
    ADD CONSTRAINT fk_gstats_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: goalie_stats fk_gstats_season; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.goalie_stats
    ADD CONSTRAINT fk_gstats_season FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: goalie_stats fk_gstats_team; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.goalie_stats
    ADD CONSTRAINT fk_gstats_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: leagues fk_league_season; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT fk_league_season FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: penalty_tracking fk_penalty_game; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.penalty_tracking
    ADD CONSTRAINT fk_penalty_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: penalty_tracking fk_penalty_player; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.penalty_tracking
    ADD CONSTRAINT fk_penalty_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: players fk_player_team; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT fk_player_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: player_stats fk_pstats_player; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT fk_pstats_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_stats fk_pstats_season; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT fk_pstats_season FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: player_stats fk_pstats_team; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT fk_pstats_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: users users_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: obhl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- PostgreSQL database dump complete
--

\unrestrict TYoQx4unLi0VodBvkgZUtNBqcqQsGTxkYIHUwktrQG3lxPPoJMjfgNuvgXPkXwI

