-- Migration 044: Enforce case-insensitive uniqueness of users.email / users.username.
--
-- Login resolves accounts case-insensitively (findAllByUsernameIgnoreCaseOrEmailIgnoreCase),
-- but the only uniqueness guarantee was Postgres' case-SENSITIVE UNIQUE constraint from
-- migration 012. Anything that created users with a differently-cased address therefore
-- produced a second account for the same person -- after which the login lookup matched two
-- rows and every attempt failed with a generic "Username or password is incorrect".
--
-- Found in production 2026-07-26: three members (Andrew Bernath, Jason Kent, Toby Garrod) had
-- a capitalised row from the Feb 2026 import and a lowercased row from the Jun 2026
-- generate-users run, and had never once been able to log in.
--
-- This migration retires the stale duplicate rows, then adds functional unique indexes so the
-- database enforces what the application now assumes.

BEGIN;

-- Retiring a duplicate rewrites its username, and roles.created_by is an FK to users(username)
-- (migration 016). Nothing should be caught by this, but fail loudly rather than break the FK.
DO $$
DECLARE
    blocked TEXT;
BEGIN
    SELECT string_agg(r.created_by, ', ')
    INTO blocked
    FROM roles r
    WHERE r.created_by IN (
        SELECT u.username
        FROM users u
        WHERE EXISTS (
            SELECT 1 FROM users o
            WHERE lower(o.email) = lower(u.email) AND o.id <> u.id
        )
    );

    IF blocked IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot retire duplicate users: roles.created_by still references %. Reassign first.',
            blocked;
    END IF;
END $$;

-- Pick a survivor per case-insensitive email and retire the rest.
--
-- Survivor order matters: "newest row wins" is wrong. In production, Jason Kent's OLDER
-- (February) row carried 20 shift_assignments while the newer June row had none, so picking by
-- id would have stranded all his history on a deactivated account. Rank by real usage instead:
-- a row that has been logged into, then the row carrying the most referencing records, and
-- only then fall back to the newest.
--
-- Retired rows are deactivated and their identity columns namespaced, NOT deleted: users(id)
-- is referenced by user_roles, goalie_profiles, shift_assignments, announcements and more, and
-- a soft retire keeps every one of those references intact and the change reversible.
WITH activity AS (
    SELECT u.id,
           (SELECT count(*) FROM shift_assignments    s WHERE s.user_id   = u.id)
         + (SELECT count(*) FROM goalie_availability  g WHERE g.user_id   = u.id)
         + (SELECT count(*) FROM staff_unavailability t WHERE t.user_id   = u.id)
         + (SELECT count(*) FROM goalie_profiles      p WHERE p.user_id   = u.id)
         + (SELECT count(*) FROM announcements        a WHERE a.author_id = u.id)
         + (SELECT count(*) FROM user_roles           r WHERE r.user_id   = u.id) AS refs
    FROM users u
),
ranked AS (
    SELECT u.id,
           row_number() OVER (
               PARTITION BY lower(u.email)
               ORDER BY (u.last_login IS NOT NULL) DESC,
                        u.last_login DESC NULLS LAST,
                        a.refs DESC,
                        u.id DESC
           ) AS rn
    FROM users u
    JOIN activity a ON a.id = u.id
)
UPDATE users u
SET email      = 'retired+' || u.id || '+' || u.email,
    username   = 'retired+' || u.id || '+' || u.username,
    is_active  = FALSE
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

-- Same pass for usernames that collide independently of email, same survivor rule.
WITH activity AS (
    SELECT u.id,
           (SELECT count(*) FROM shift_assignments    s WHERE s.user_id   = u.id)
         + (SELECT count(*) FROM goalie_availability  g WHERE g.user_id   = u.id)
         + (SELECT count(*) FROM staff_unavailability t WHERE t.user_id   = u.id)
         + (SELECT count(*) FROM goalie_profiles      p WHERE p.user_id   = u.id)
         + (SELECT count(*) FROM announcements        a WHERE a.author_id = u.id)
         + (SELECT count(*) FROM user_roles           r WHERE r.user_id   = u.id) AS refs
    FROM users u
),
ranked AS (
    SELECT u.id,
           row_number() OVER (
               PARTITION BY lower(u.username)
               ORDER BY (u.last_login IS NOT NULL) DESC,
                        u.last_login DESC NULLS LAST,
                        a.refs DESC,
                        u.id DESC
           ) AS rn
    FROM users u
    JOIN activity a ON a.id = u.id
)
UPDATE users u
SET username  = 'retired+' || u.id || '+' || u.username,
    is_active = FALSE
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
    ON users (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique
    ON users (lower(username));

COMMIT;
