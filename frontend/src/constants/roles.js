// Roles are loaded live from the DB via api.getRoles() so newly-added roles are
// automatically available to admins. This list is only a fallback for instant
// render and in case the /roles request fails.
export const FALLBACK_ROLES = [
    { name: 'ADMIN', description: 'Full system access' },
    { name: 'GM', description: 'Team management' },
    { name: 'REF', description: 'Referee scheduling' },
    { name: 'SCOREKEEPER', description: 'Game scoring' },
    { name: 'GOALIE', description: 'Goalie scheduling' },
    { name: 'GOALIE_COORDINATOR', description: 'Assigns & confirms goalie shifts' },
    { name: 'REF_COORDINATOR', description: 'Assigns & confirms referee shifts' },
    { name: 'USER', description: 'Basic access' },
];

// OBHL dark-theme palette (matches the redesign's role chips).
const ROLE_COLORS = {
    ADMIN: '#E08A8A',
    GM: '#E8C26A',
    PLAYER: '#9DB9CD',
    REFEREE: '#b09ef0',
    REF: '#b09ef0',
    SCOREKEEPER: '#7FB59A',
    GOALIE: '#e8956a',
    GOALIE_COORDINATOR: '#5fb3b3',
    REF_COORDINATOR: '#b09ef0',
    COORDINATOR: '#7E8A94',
    USER: '#5E6872',
};

// Stable color for a role name, with a sensible default for unknown/new roles.
export const roleColor = (name) => ROLE_COLORS[name] || '#7E8A94';

// Normalize an api.getRoles() response into { name, description } picker options,
// falling back to the static list when empty/unavailable.
export const toRoleOptions = (roles) => {
    if (!roles || roles.length === 0) return FALLBACK_ROLES;
    return roles.map(r => ({ name: r.name, description: r.description }));
};
