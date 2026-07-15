-- Migration: Create chicken_licks_orders + chicken_licks_order_items tables
-- Version: 042
-- Description: Team/personal food ordering feature (Chicken Licks Bar & Grill).
-- A user can have one OPEN personal order and their team can have one OPEN team
-- order at a time (enforced by partial unique indexes below); both independent
-- and can be open simultaneously. team_id is snapshotted on BOTH order types
-- (personal orders included) so a player's individual order still counts toward
-- their team's season Chicken Licks total on the public Standings page. Users
-- with no team association (e.g. referees/scorekeepers/goalies with no roster
-- spot) get a NULL team_id and never contribute to any team's total.
--
-- "Counted"/finalized definition used by all aggregate totals:
--   (order_type = 'PERSONAL' AND status = 'PLACED') OR (order_type = 'TEAM' AND status = 'CLOSED')
-- OPEN and CANCELLED orders of either type never count toward a total.

CREATE TABLE IF NOT EXISTS chicken_licks_orders (
    id BIGSERIAL PRIMARY KEY,
    order_type VARCHAR(20) NOT NULL,              -- PERSONAL | TEAM
    season_id BIGINT NOT NULL,
    team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    team_name VARCHAR(255),
    initiator_email VARCHAR(255) NOT NULL,
    initiator_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',   -- OPEN | PLACED | CLOSED | CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chicken_licks_order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES chicken_licks_orders(id) ON DELETE CASCADE,
    person_email VARCHAR(255) NOT NULL,
    person_name VARCHAR(255),
    item_key VARCHAR(50) NOT NULL,
    item_label VARCHAR(255) NOT NULL,
    detail VARCHAR(500),
    unit_price NUMERIC(6,2) NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One OPEN personal order per person, one OPEN team order per team.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cl_orders_open_personal
    ON chicken_licks_orders (initiator_email)
    WHERE order_type = 'PERSONAL' AND status = 'OPEN';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cl_orders_open_team
    ON chicken_licks_orders (team_id)
    WHERE order_type = 'TEAM' AND status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_cl_orders_season_team ON chicken_licks_orders(season_id, team_id);
CREATE INDEX IF NOT EXISTS idx_cl_orders_initiator ON chicken_licks_orders(initiator_email);
CREATE INDEX IF NOT EXISTS idx_cl_order_items_order ON chicken_licks_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cl_order_items_person ON chicken_licks_order_items(person_email);
