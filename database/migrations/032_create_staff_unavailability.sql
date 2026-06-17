-- Migration: Create staff_unavailability table
-- Version: 032
-- Description: Generalized availability tracking for staff roles (referees now,
-- scorekeepers later), mirroring the existing goalie_unavailability table.
-- Goalies keep using goalie_unavailability; the StaffAvailabilityService
-- dispatches by role so goalie flows are untouched.

CREATE TABLE IF NOT EXISTS staff_unavailability (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    unavailable_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_staff_user_role_date UNIQUE (user_id, role, unavailable_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_unavailability_user_role ON staff_unavailability(user_id, role);
CREATE INDEX IF NOT EXISTS idx_staff_unavailability_date ON staff_unavailability(unavailable_date);
