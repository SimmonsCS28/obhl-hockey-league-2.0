/**
 * Determines the appropriate route for a user based on their shift-related roles
 * @param {Array} roles - Array of role names the user has
 * @returns {string} - The route path to redirect to
 */
export const getShiftRoute = (roles) => {
    if (!roles || roles.length === 0) {
        return '/';
    }

    const shiftRoles = roles.filter(role =>
        ['GOALIE', 'REF', 'SCOREKEEPER'].includes(role)
    );

    // No shift roles → home
    if (shiftRoles.length === 0) {
        return '/';
    }

    // Single shift role → direct to that role's page
    if (shiftRoles.length === 1) {
        const role = shiftRoles[0];
        if (role === 'GOALIE') return '/user/goalie';
        if (role === 'REF') return '/user/referee';
        if (role === 'SCOREKEEPER') return '/user/scorekeeper';
    }

    // Multiple shift roles → dashboard
    return '/user';
};
