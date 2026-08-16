-- The Conley Classic: one row per annual tournament.
--
-- Each tournament owns a seasons row (type='TOURNAMENT') so its teams, players and games are
-- ordinary season-scoped rows. Everything here is the tournament-specific configuration that has
-- nowhere sensible to live on a season.

CREATE TABLE IF NOT EXISTS tournaments (
    id                      BIGSERIAL PRIMARY KEY,

    -- The backing season. UNIQUE because the relationship is strictly one-to-one: a tournament
    -- season exists to hold exactly this tournament's rows. CASCADE so deleting the season (which
    -- already cascades to its teams and games) cannot leave an orphan tournament behind.
    season_id               BIGINT NOT NULL UNIQUE REFERENCES seasons(id) ON DELETE CASCADE,

    -- URL identity: /tournaments/conley-classic-2026. Stable and human-readable, unlike an id, and
    -- unlike the team-name query params the design prototype used.
    slug                    VARCHAR(80) NOT NULL UNIQUE,
    name                    VARCHAR(150) NOT NULL,
    year                    INTEGER NOT NULL,
    tagline                 VARCHAR(200),

    ---------------------------------------------------------------------------------------------
    -- Format, modelled as three independent stages rather than one enum.
    --
    -- The obvious design is a single format column of 'single-elim' | 'pools-bracket' |
    -- 'round-robin'. It was rejected: the shape actually wanted for eight teams is two 4-team
    -- divisions, then a semifinal/final bracket for the top two of each, a placement game between
    -- the semifinal losers, AND consolation games for the bottom four. That is a fourth value, and
    -- the year after would want a fifth. Composing three stages covers every combination -- and
    -- next year's -- without new generator code each time.
    ---------------------------------------------------------------------------------------------

    -- NONE | ROUND_ROBIN (one group, everyone plays everyone) | DIVISIONS
    group_stage             VARCHAR(20) NOT NULL DEFAULT 'ROUND_ROBIN',
    pool_count              INTEGER,
    advance_per_pool        INTEGER DEFAULT 2,

    -- NONE | SINGLE_ELIM
    championship_stage      VARCHAR(20) NOT NULL DEFAULT 'SINGLE_ELIM',
    -- One extra game between the two semifinal losers.
    placement_game          BOOLEAN NOT NULL DEFAULT false,

    -- NONE | SINGLE_ROUND | BRACKET.
    -- SINGLE_ROUND pairs the non-qualifiers so each plays exactly ONE game (N teams -> N/2 games),
    -- not one game total -- nobody drives to the rink on day two to watch.
    consolation_stage       VARCHAR(20) NOT NULL DEFAULT 'NONE',
    consolation_team_count  INTEGER,

    -- Derived from the stage config when the schedule is generated, and stored only so the public
    -- Bracket page can pick one of its three layouts. The stage columns above are the source of
    -- truth; this is a rendering hint and must never be read as configuration.
    display_format          VARCHAR(20),

    ---------------------------------------------------------------------------------------------
    -- Weekend details. All of these change year to year.
    ---------------------------------------------------------------------------------------------
    team_count              INTEGER NOT NULL DEFAULT 8,
    start_date              DATE,
    end_date                DATE,
    venue                   VARCHAR(150) DEFAULT 'Sun Prairie Ice Arena',
    entry_fee_cents         INTEGER,
    entry_deadline          DATE,
    draft_date              DATE,

    -- Game format. Two 15-minute periods, unlike the league's three 20s. Stored per tournament
    -- rather than hardcoded because it is exactly the sort of thing that changes when the ice
    -- schedule is tight, and Live Score Entry reads it to build its period list.
    period_count            SMALLINT NOT NULL DEFAULT 2,
    period_minutes          SMALLINT NOT NULL DEFAULT 15,

    -- Names a TournamentScoringProfile in code rather than storing the rules as columns. Changing
    -- the formula is then a new profile constant with a new name, which leaves already-played
    -- tournaments scoring the way they actually scored.
    scoring_profile         VARCHAR(40) NOT NULL DEFAULT 'conley-v1',

    -- setup -> draft -> scheduled -> in_progress -> completed -> archived.
    -- The tournament's lifecycle lives HERE, never on seasons.is_active: a tournament season is
    -- forbidden from being active by chk_tournament_never_active (migration 046).
    status                  VARCHAR(20) NOT NULL DEFAULT 'setup',

    -- Lets a tournament be built up in the admin without appearing on the public site.
    is_published            BOOLEAN NOT NULL DEFAULT false,

    champion_team_id        BIGINT,
    crest_image_url         VARCHAR(500),
    trophy_image_url        VARCHAR(500),

    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_group_stage;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_group_stage
    CHECK (group_stage IN ('NONE', 'ROUND_ROBIN', 'DIVISIONS'));

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_championship_stage;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_championship_stage
    CHECK (championship_stage IN ('NONE', 'SINGLE_ELIM'));

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_consolation_stage;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_consolation_stage
    CHECK (consolation_stage IN ('NONE', 'SINGLE_ROUND', 'BRACKET'));

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_status;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_status
    CHECK (status IN ('setup', 'draft', 'scheduled', 'in_progress', 'completed', 'archived'));

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_team_count;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_team_count
    CHECK (team_count BETWEEN 2 AND 32);

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_periods;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_periods
    CHECK (period_count BETWEEN 1 AND 5 AND period_minutes BETWEEN 1 AND 60);

-- DIVISIONS is meaningless without knowing how many divisions there are.
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournament_pool_count;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_pool_count
    CHECK (group_stage <> 'DIVISIONS' OR (pool_count IS NOT NULL AND pool_count >= 2));

-- The archive lists tournaments newest first.
CREATE INDEX IF NOT EXISTS idx_tournaments_year ON tournaments(year DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_published ON tournaments(is_published) WHERE is_published = true;

COMMENT ON TABLE tournaments IS
    'One row per annual tournament (The Conley Classic). Owns a seasons row of type TOURNAMENT '
    'whose teams/players/games hold the actual tournament data.';
