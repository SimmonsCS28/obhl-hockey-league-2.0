-- Tournament rules, editable in the admin like the league's rules_sections (migration 036).
--
-- A separate table rather than a tournament_id column on rules_sections. Reusing that table would
-- add one more place the league Rules page has to remember to filter -- another leakage surface of
-- exactly the kind migration 046 exists to close -- and it would do so for about six rows. The
-- editor UI reuses the league Rules editor's patterns; only the table differs.
--
-- Scoped per tournament, not global, because these rules change with the format: the tiebreakers
-- and overtime rules for a round-robin year are not the ones for a bracket year.

CREATE TABLE IF NOT EXISTS tournament_rules_sections (
    id              BIGSERIAL PRIMARY KEY,
    tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The public Rules page reads one tournament's sections in display order.
CREATE INDEX IF NOT EXISTS idx_tournament_rules_order
    ON tournament_rules_sections(tournament_id, sort_order);

COMMENT ON TABLE tournament_rules_sections IS
    'Tournament-specific rules, layered on top of the standard OBHL rulebook. Deliberately separate '
    'from rules_sections so league rules queries never need a tournament filter.';
