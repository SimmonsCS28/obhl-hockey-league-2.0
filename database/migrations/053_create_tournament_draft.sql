-- The Conley Classic draft.
--
-- Operator-directed with NO pick order: one person runs the whole thing off one screen, so there is
-- no snake, no rounds, no clock and no "can this team pick yet". That removes most of what a draft
-- tool usually needs -- and it is why pick_number below carries no turn semantics.

-- ---------------------------------------------------------------------------------------------
-- Draft state. One per tournament.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_drafts (
    id              BIGSERIAL PRIMARY KEY,
    tournament_id   BIGINT NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,

    -- setup: entrants being imported and linked
    -- live:  assignment board in use
    -- committed: players rows created; the board is frozen
    status          VARCHAR(20) NOT NULL DEFAULT 'setup',

    committed_at    TIMESTAMP,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tournament_drafts DROP CONSTRAINT IF EXISTS chk_tournament_draft_status;
ALTER TABLE tournament_drafts ADD CONSTRAINT chk_tournament_draft_status
    CHECK (status IN ('setup', 'live', 'committed'));

-- ---------------------------------------------------------------------------------------------
-- Entrants: everyone who signed up, before they are anybody's player.
--
-- Deliberately separate from `players` rather than creating player rows up front. The board must
-- stay freely mutable -- reassign, unassign, undo, re-import -- and doing that against `players`
-- would churn real rows and fight the UNIQUE(email, season_id) constraint mid-draft. Player rows
-- are created once, at commit.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_draft_entrants (
    id              BIGSERIAL PRIMARY KEY,
    tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,

    -- Nullable here, unlike players.email which is required. Plenty of entrants sign up on paper
    -- with no address; commit generates a stable placeholder rather than inventing one at import.
    email           VARCHAR(255),
    phone           VARCHAR(40),

    position        VARCHAR(10),
    jersey_number   INTEGER,
    skill_rating    INTEGER,

    -- GMs are designated before the draft and seated by the "Place GMs" action, one per team,
    -- before the pool is drafted from.
    is_gm           BOOLEAN NOT NULL DEFAULT false,

    paid            BOOLEAN NOT NULL DEFAULT false,

    -- Resolved account link. NULL means unlinked, which is a permanent, normal state -- the
    -- tournament works with zero linked accounts. Set only by explicit operator confirmation:
    -- an ambiguous match is never linked automatically.
    user_id         BIGINT,
    -- unmatched | matched | ambiguous | confirmed | none
    -- Kept distinct from user_id so "we looked and found nothing" is distinguishable from
    -- "we have not looked yet".
    link_status     VARCHAR(20) NOT NULL DEFAULT 'unmatched',

    notes           VARCHAR(280),

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tournament_draft_entrants DROP CONSTRAINT IF EXISTS chk_entrant_link_status;
ALTER TABLE tournament_draft_entrants ADD CONSTRAINT chk_entrant_link_status
    CHECK (link_status IN ('unmatched', 'matched', 'ambiguous', 'confirmed', 'none'));

-- One entrant per email per tournament, case-insensitively.
--
-- Migration 044 gave `users` case-insensitive identity but `players.email` never got it, so
-- 'Bob@x.com' and 'bob@x.com' can still become two player rows for one person in a season, with
-- their stats split. Catching it HERE, at import, keeps that from ever reaching players -- which is
-- also why the app normalises to lower(trim(email)) on every write in this path.
-- Partial: entrants without an email are legitimate and must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tdraft_entrant_email
    ON tournament_draft_entrants (tournament_id, lower(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tdraft_entrants_tournament
    ON tournament_draft_entrants (tournament_id);

-- ---------------------------------------------------------------------------------------------
-- Picks: entrant -> team.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_draft_picks (
    id              BIGSERIAL PRIMARY KEY,
    tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    entrant_id      BIGINT NOT NULL REFERENCES tournament_draft_entrants(id) ON DELETE CASCADE,
    team_id         BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Monotonic sequence, for undo and audit ONLY. There is no pick order in this draft, so this
    -- says when someone was assigned, never whose turn it was.
    pick_number     INTEGER NOT NULL,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An entrant is on at most one team. Reassignment updates the row rather than adding a second,
-- so a player cannot silently end up on two rosters.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tdraft_pick_entrant
    ON tournament_draft_picks (tournament_id, entrant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tdraft_pick_number
    ON tournament_draft_picks (tournament_id, pick_number);

CREATE INDEX IF NOT EXISTS idx_tdraft_picks_team
    ON tournament_draft_picks (team_id);

COMMENT ON TABLE tournament_draft_entrants IS
    'Tournament sign-ups, before commit turns them into players rows. Separate from players so the '
    'board stays mutable and re-importable without churning real rows.';
COMMENT ON COLUMN tournament_draft_picks.pick_number IS
    'Monotonic sequence for undo/audit. This draft has no pick order -- it carries no turn meaning.';
