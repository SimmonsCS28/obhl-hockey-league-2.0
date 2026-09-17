-- Migration 067: staff pay — referee / scorekeeper rates, per-season pay periods, and the
-- confirm-your-totals workflow behind the rink's end-of-season pay report.
--
-- (066 is taken by the goalie-open-spot-alerts branch; numbering skips it on purpose.)
--
-- Every table here is also declared as a JPA entity because api-gateway runs ddl-auto=update:
-- if the service boots before this file is applied, Hibernate creates the tables from the
-- entities and the CREATE TABLE IF NOT EXISTS below no-ops. Unique constraints are therefore
-- declared in both places; the foreign keys only exist when this file runs first (same as
-- every other gateway-owned table).

-- One pay rate per person per role. Refs are tiered ($20 no training / $30 rink clinic /
-- $40 USA Hockey certified); scorekeepers are a flat $15. Stored in cents. A person can
-- hold both roles and be paid at both rates.
CREATE TABLE IF NOT EXISTS staff_pay_rates (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL,           -- REF | SCOREKEEPER
    rate_cents  INTEGER NOT NULL,               -- 0 is a valid, deliberate "does not want to be paid"
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by  BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pay_rates_user_role ON staff_pay_rates (user_id, role);

-- One pay period per season. DRAFT until the admin finalizes staffing; FINALIZED while
-- confirmations are collected; SENT once the workbook has gone to the rink. Re-finalizing
-- after SENT drops it back to FINALIZED so a corrected report can be sent again.
CREATE TABLE IF NOT EXISTS staff_pay_periods (
    id                      BIGSERIAL PRIMARY KEY,
    season_id               BIGINT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',   -- DRAFT | FINALIZED | SENT
    title                   VARCHAR(200),
    finalized_at            TIMESTAMP,
    finalized_by            BIGINT,
    confirmations_sent_at   TIMESTAMP,
    report_sent_at          TIMESTAMP,
    report_sent_to          VARCHAR(255),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pay_periods_season ON staff_pay_periods (season_id);

-- Snapshot of one person's totals for one role at the moment of finalizing. games already
-- counts a solo-reffed game twice (that is how the rink's sheet expresses double pay);
-- solo_games is how many of those there were, for the person's own email.
CREATE TABLE IF NOT EXISTS staff_pay_lines (
    id                  BIGSERIAL PRIMARY KEY,
    period_id           BIGINT NOT NULL REFERENCES staff_pay_periods(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL,
    games               INTEGER NOT NULL DEFAULT 0,
    solo_games          INTEGER NOT NULL DEFAULT 0,
    rate_cents          INTEGER NOT NULL DEFAULT 0,
    total_cents         INTEGER NOT NULL DEFAULT 0,
    -- PENDING | CONFIRMED | DISPUTED | ADMIN_CONFIRMED
    confirm_status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    confirm_token_hash  VARCHAR(255),
    token_expires_at    TIMESTAMP,
    email_sent_at       TIMESTAMP,
    responded_at        TIMESTAMP,
    dispute_note        TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pay_lines_period_user_role
    ON staff_pay_lines (period_id, user_id, role);
CREATE INDEX IF NOT EXISTS idx_staff_pay_lines_period ON staff_pay_lines (period_id);

-- The games behind a line, so the confirmation email can list dates without re-deriving
-- them after assignments have moved on.
CREATE TABLE IF NOT EXISTS staff_pay_line_games (
    id          BIGSERIAL PRIMARY KEY,
    line_id     BIGINT NOT NULL REFERENCES staff_pay_lines(id) ON DELETE CASCADE,
    game_id     BIGINT NOT NULL,
    game_date   TIMESTAMP,                      -- UTC, like games.game_date
    matchup     VARCHAR(200),
    solo        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_staff_pay_line_games_line ON staff_pay_line_games (line_id);

-- League-wide key/value settings. First key: finance_report_email, the rink contact the
-- pay workbook is emailed to. Column names avoid the reserved-ish KEY / VALUE.
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key     VARCHAR(80) PRIMARY KEY,
    setting_value   TEXT,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by      BIGINT
);

-- ---------------------------------------------------------------------------------------
-- Seed: current referee rates, matched to accounts by full name. Names with no account are
-- silently skipped (the admin sets those by hand on the Staff Pay page, which also refuses
-- to finalize a season while anyone who worked a game has no rate). Apostrophes and runs
-- of whitespace are normalised on both sides. A few known alternate spellings are listed
-- alongside the canonical ones; an alias that matches nobody is harmless.
-- ---------------------------------------------------------------------------------------
INSERT INTO staff_pay_rates (user_id, role, rate_cents, updated_at)
SELECT u.id, 'REF', v.rate_cents, now()
FROM (VALUES
    ('adam rogers', 3000), ('aiden white', 4000), ('alex arnn', 3000), ('andy winn', 3000),
    ('barry edison', 3000), ('brett jackson', 3000), ('brett rojec', 3000), ('bruce breunig', 3000),
    ('bryce loken', 3000), ('chris cameron', 3000), ('cody james', 3000), ('cole simmons', 4000),
    ('danny martin', 2000), ('drew guelzow', 2000), ('dylan howard', 3000), ('eric osterhaus', 2000),
    ('gary eddy', 3000), ('gavin goeppinger', 4000), ('george botts', 2000), ('jason kent', 3000),
    ('jay lodholz', 4000), ('jeff thornton', 3000), ('jeff vincent', 3000), ('joe goldfine', 2000),
    ('joe schumacher', 2000), ('jon rogers', 3000), ('justin luck', 3000),
    ('justin paunkner', 2000), ('justin paukner', 2000),
    ('kevin mcconnaughay', 2000), ('tony gackstetter', 2000), ('anthony gackstetter', 2000), ('maggie glatzel', 2000),
    ('matthew taylor', 3000), ('michael diedrich', 3000), ('michael doucette', 2000),
    ('mike o''connell', 3000), ('michael o''connell', 3000),
    ('nick reese', 3000), ('ryan hebgen', 4000),
    ('stefan davidison', 3000), ('stefan davidson', 3000),
    ('steve braun', 3000), ('josh lind', 3000),
    ('tedd marshall', 3000), ('ted marshall', 3000),
    ('thomas behnke', 3000), ('tom behnke', 3000),
    ('tim callahan', 4000), ('tim hebgen', 3000), ('tom lee', 4000), ('john steinbergs', 2000),
    ('zak barnetzke', 2000), ('zachary barnetzke', 2000), ('tanner schafer', 4000), ('cole lodholz', 4000), ('erik schuette', 4000),
    ('owen meyer', 3000), ('evan luxford', 3000), ('tim williams', 2000), ('timothy williams', 2000), ('avi stein', 3000),
    ('eric twilegar', 4000), ('joe seidl', 4000), ('joseph seidl', 4000), ('weston gerke', 3000), ('larry clemens', 3000),
    ('julian scalcucci', 4000), ('eric horein', 4000), ('gage hill', 4000)
) AS v(full_name, rate_cents)
JOIN users u
  -- chr(8217) is the curly apostrophe (U+2019) that Word/Excel-sourced names carry.
  ON regexp_replace(lower(trim(replace(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''), chr(8217), ''''))), '\s+', ' ', 'g')
     = v.full_name
ON CONFLICT (user_id, role) DO UPDATE
    SET rate_cents = EXCLUDED.rate_cents, updated_at = now();

-- Scorekeeping is a flat $15 for everyone, so every account holding the role gets it.
-- DO NOTHING keeps any rate the admin has already set by hand.
INSERT INTO staff_pay_rates (user_id, role, rate_cents, updated_at)
SELECT DISTINCT u.id, 'SCOREKEEPER', 1500, now()
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id AND r.name = 'SCOREKEEPER'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verification: refs on the list above who did NOT get a rate (no matching account).
--
--   SELECT u.first_name, u.last_name, u.email
--   FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
--   WHERE r.name = 'REF' AND NOT EXISTS (
--       SELECT 1 FROM staff_pay_rates p WHERE p.user_id = u.id AND p.role = 'REF')
--   ORDER BY u.last_name;
