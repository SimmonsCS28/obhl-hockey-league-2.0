-- Migration 061: give this season's team GMs the GM role
--
-- Naming somebody a team's GM writes teams.gm_id and nothing else. gm_id points at a
-- players row, not a users row, so the role that actually opens the GM portal was never
-- granted -- and /gm, "My Team" and the GM Dashboard button on the member dashboard are
-- all gated on that role. Returning GMs never noticed, because they were still carrying
-- the role from a previous season; every GM the draft introduced was locked out.
--
-- Matching is by email, which is the only link between a player and a user in this schema.
-- A GM with no account yet is skipped here and picked up by Generate Users plus the
-- role-grant that api-gateway's TeamService now performs whenever gm_id is written.
--
-- Additive and idempotent: it only ever inserts the GM role, never removes one, and
-- ON CONFLICT DO NOTHING makes a re-run a no-op. The deprecated users.role column is
-- deliberately left alone -- role checks read the roles[] set first, and rewriting the
-- single-role column would drop whatever it currently names (REF, USER, ...).

INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT u.id, r.id
FROM teams t
JOIN seasons s ON s.id = t.season_id AND s.is_active = true
JOIN players p ON p.id = t.gm_id
JOIN users u ON lower(u.email) = lower(p.email)
CROSS JOIN roles r
WHERE r.name = 'GM'
  AND t.gm_id IS NOT NULL
  AND u.is_active = true
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Verification: every active-season GM should come back with has_gm_role = true.
--
--   SELECT p.first_name || ' ' || p.last_name AS gm, u.username,
--          bool_or(r.name = 'GM') AS has_gm_role
--   FROM teams t
--   JOIN seasons s ON s.id = t.season_id AND s.is_active = true
--   JOIN players p ON p.id = t.gm_id
--   LEFT JOIN users u ON lower(u.email) = lower(p.email)
--   LEFT JOIN user_roles ur ON ur.user_id = u.id
--   LEFT JOIN roles r ON r.id = ur.role_id
--   GROUP BY gm, u.username ORDER BY gm;
--
-- Affected GMs must log out and back in: the frontend reads roles from the user object
-- cached in localStorage at login, so an existing session keeps the old role list.
