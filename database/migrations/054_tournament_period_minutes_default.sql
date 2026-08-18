-- The Conley Classic plays two 20-minute periods, not 15.
--
-- 048 created period_minutes with DEFAULT 15, which was a guess. Checked against the schedules from
-- previous years: 2 x 20 is correct. Existing rows are left alone -- the column is per-tournament
-- and any row that already exists has been configured by hand -- so this only changes what a newly
-- created tournament starts at.
--
-- The entity supplies the value on every insert, so this default is close to dead code in practice.
-- It is corrected anyway because the schema should not describe the tournament wrongly for whoever
-- reads it next.
--
-- Idempotent: setting a column default is unconditional and safe to re-run.

ALTER TABLE tournaments ALTER COLUMN period_minutes SET DEFAULT 20;

COMMENT ON COLUMN tournaments.period_minutes IS
    'Length of one regulation period in minutes. The Classic runs 2 x 20.';
