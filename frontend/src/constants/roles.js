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

const ROLE_COLORS = {
    ADMIN: '#e53e3e',
    GM: '#d69e2e',
    PLAYER: '#3182ce',
    REFEREE: '#805ad5',
    REF: '#805ad5',
    SCOREKEEPER: '#38a169',
    GOALIE: '#dd6b20',
    GOALIE_COORDINATOR: '#2c7a7b',
    REF_COORDINATOR: '#6b46c1',
    COORDINATOR: '#718096',
    USER: '#a0aec0',
};

// Stable color for a role name, with a sensible default for unknown/new roles.
export const roleColor = (name) => ROLE_COLORS[name] || '#718096';

// Normalize an api.getRoles() response into { name, description } picker options,
// falling back to the static list when empty/unavailable.
export const toRoleOptions = (roles) => {
    if (!roles || roles.length === 0) return FALLBACK_ROLES;
    return roles.map(r => ({ name: r.name, description: r.description }));
};
