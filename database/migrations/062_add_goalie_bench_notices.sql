-- Migration: Create goalie_bench_notices table
-- Version: 062
-- Description: Records that a week's "you're not scheduled" notice has gone out to the
-- full-time goalies who drew no slot. Sending it was previously inferred from the week's
-- assignment statuses ("no row is PROPOSED/CONFIRMED yet"), which any single manual
-- propose or per-row send before the bulk Send Confirmations silently defeated -- the
-- bench was then never told, with no error (Season 15 week 1, 2026-09-09). One row per
-- (season, week) makes the fact explicit, so a top-up send is idempotent regardless of
-- how the slots were filled.
-- Idempotent: safe to re-run (this migration runner re-executes every file each run).

CREATE TABLE IF NOT EXISTS goalie_bench_notices (
    id              BIGSERIAL PRIMARY KEY,
    season_id       BIGINT  NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    week            INTEGER NOT NULL,
    sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_by         BIGINT  REFERENCES users(id) ON DELETE SET NULL,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_goalie_bench_notice UNIQUE (season_id, week)
);

COMMENT ON TABLE goalie_bench_notices IS 'One row per (season, week) once the unassigned full-time goalies have been emailed that they are not playing; gates the bench notice so it is sent exactly once per week.';

-- Backfill: any week whose confirmations already went out under the old code is treated as
-- told. This is exactly what the old inference would have concluded for these weeks, frozen
-- here so the switch-over can't fire a late "you're not scheduled" for a week that has already
-- been announced (or played). To have a top-up send tell a week's bench after all, delete
-- that week's row. recipient_count is 0 because nothing is known about what was sent.
INSERT INTO goalie_bench_notices (season_id, week, recipient_count)
SELECT DISTINCT g.season_id, g.week, 0
FROM shift_assignments sa
JOIN games g ON g.id = sa.game_id
WHERE sa.role = 'GOALIE'
  AND sa.status IN ('PROPOSED', 'CONFIRMED')
  AND g.week IS NOT NULL
ON CONFLICT (season_id, week) DO NOTHING;
