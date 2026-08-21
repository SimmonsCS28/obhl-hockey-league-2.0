-- Chocolate Milk Player of the Game.
--
-- A long-standing tournament tradition: after every game, each team's captain names one player
-- from the OTHER bench who showed the best sportsmanship, and a carton of chocolate milk is
-- delivered to them. It is a first-class feature of the site, not a footnote.

CREATE TABLE IF NOT EXISTS tournament_awards (
    id                  BIGSERIAL PRIMARY KEY,

    game_id             BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    -- Denormalised from the game so the tournament's award list is a single-table read and does not
    -- need a join back through games on every page load.
    season_id           BIGINT NOT NULL,

    -- Only one kind today. A column rather than a second table because a placement/MVP/best-goalie
    -- award would differ by nothing but its name.
    award_type          VARCHAR(30) NOT NULL DEFAULT 'CHOCOLATE_MILK',

    -- Who received it.
    player_id           BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id             BIGINT,

    -- Which bench gave it. Part of the unique key below, and the thing that makes "one per captain,
    -- to the other team" expressible rather than merely documented.
    awarded_by_team_id  BIGINT,

    note                VARCHAR(280),

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Each bench gives exactly one award of a given type per game. Re-picking updates that row rather
-- than adding a second, so a captain changing their mind cannot produce two winners.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_award_per_bench
    ON tournament_awards (game_id, award_type, awarded_by_team_id);

-- The home page and player pages list a tournament's awards.
CREATE INDEX IF NOT EXISTS idx_tournament_awards_season ON tournament_awards(season_id);
CREATE INDEX IF NOT EXISTS idx_tournament_awards_player ON tournament_awards(player_id);

ALTER TABLE tournament_awards DROP CONSTRAINT IF EXISTS chk_tournament_award_type;
ALTER TABLE tournament_awards ADD CONSTRAINT chk_tournament_award_type
    CHECK (award_type IN ('CHOCOLATE_MILK'));

COMMENT ON TABLE tournament_awards IS
    'Per-game tournament awards. Chocolate Milk Player of the Game: each captain names one player '
    'on the opposing bench, hence the unique key on (game, type, awarding team).';
