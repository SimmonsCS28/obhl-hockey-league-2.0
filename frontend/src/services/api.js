const API_BASE_URL = '/api/v1';

// Helper to get auth token
const getAuthToken = () => localStorage.getItem('token');

// Helper to add auth header
const getAuthHeaders = () => {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Centralized request helper
const request = async (url, options = {}) => {
    // List prefixes that shouldn't be prepended with API_BASE_URL
    const PROXY_PREFIXES = ['/games-api', '/stats-api'];
    const isProxyPath = PROXY_PREFIXES.some(prefix => url.startsWith(prefix));

    const fullUrl = url.startsWith('http') 
        ? url 
        : (url.startsWith(API_BASE_URL) || isProxyPath ? url : `${API_BASE_URL}${url}`);

    const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        ...options.headers
    };

    try {
        const response = await fetch(fullUrl, {
            ...options,
            headers
        });

        if (!response.ok) {
            // Handle session expiration/authorization errors
            if (response.status === 401 || response.status === 403) {
                console.warn(`Auth error (${response.status}) for ${url}`);
                if (!url.includes('/auth/login')) {
                    window.dispatchEvent(new Event('auth-error'));
                    throw new Error('Your session has expired. Please log in again.');
                }
            }

            const errorBody = await response.text();
            throw new Error(errorBody || `Request failed with status ${response.status}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        if (error.name === 'SyntaxError') {
            return {}; // Handle cases where response might not be JSON
        }
        throw error;
    }
};

// API client for backend services
const api = {
    // ============================================
    // AUTHENTICATION API
    // ============================================
    async signup(data) {
        return request('/users/signup', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getSecurityQuestion(username) {
        return request(`/auth/security-question?username=${encodeURIComponent(username)}`);
    },

    async resetPassword(data) {
        return request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async login(usernameOrEmail, password) {
        // Special case for login as we don't want auth headers yet usually, 
        // but the request helper adds them safely if available.
        return request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ usernameOrEmail, password })
        });
    },

    async changePassword(oldPassword, newPassword, token) {
        return request('/auth/change-password', {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: JSON.stringify({ oldPassword, newPassword })
        });
    },

    async logout() {
        try {
            await request('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    // ============================================
    // GENERIC HTTP METHODS
    // ============================================
    async get(url) {
        return request(url);
    },

    async post(url, data = null) {
        return request(url, {
            method: 'POST',
            body: data ? JSON.stringify(data) : null
        });
    },

    async put(url, data) {
        return request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(url) {
        return request(url, { method: 'DELETE' });
    },

    // ============================================
    // PLAYERS API (Proxied to Stats Service)
    // ============================================
    async getPlayers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `/players${queryString ? '?' + queryString : ''}`;
        return request(url);
    },

    // ============================================
    // TEAMS API
    // ============================================
    async getTeams() {
        return request('/teams');
    },

    async getTeam(id) {
        return request(`/teams/${id}`);
    },

    async updateTeam(id, data) {
        return request(`/teams/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    // ============================================
    // USERS API
    // ============================================
    async getUserPublicName(userId) {
        if (!userId) return null;
        try {
            const data = await request(`/users/${userId}/name`);
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            return name || null;
        } catch {
            return null;
        }
    },

    // ============================================
    // GAMES API (Game Service on port 8002)
    // ============================================
    async getGames(seasonId = null) {
        const GAME_SERVICE_URL = '/games-api';
        let url = `${GAME_SERVICE_URL}/games?_t=${Date.now()}`;
        if (seasonId) {
            url += `&seasonId=${seasonId}`;
        }
        return request(url, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
    },

    async getGame(gameId) {
        const GAME_SERVICE_URL = '/games-api';
        return request(`${GAME_SERVICE_URL}/games/${gameId}`);
    },

    async updateGame(gameId, data) {
        const GAME_SERVICE_URL = '/games-api';
        return request(`${GAME_SERVICE_URL}/games/${gameId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    async updateGameScore(gameId, homeScore, awayScore) {
        return request(`/games/${gameId}/score`, {
            method: 'PATCH',
            body: JSON.stringify({ homeScore, awayScore })
        });
    },

    async saveGameEvent(gameId, event) {
        return request(`/games/${gameId}/events`, {
            method: 'POST',
            body: JSON.stringify(event)
        });
    },

    async getGameEvents(gameId) {
        return request(`/games/${gameId}/events`);
    },

    async finalizeGame(gameId, homeScore, awayScore, endedInOT = false) {
        return request(`/games/${gameId}/finalize`, {
            method: 'POST',
            body: JSON.stringify({ homeScore, awayScore, endedInOT })
        });
    },

    async unfinalizeGame(gameId) {
        return request(`/games/${gameId}/unfinalize`, {
            method: 'POST'
        });
    },

    // ============================================
    // PENALTY VALIDATION API
    //Connect to Game Service penalty validation endpoint
    // ============================================
    async validatePenalty(playerId, gameId, teamId) {
        try {
            return await request(`/games/${gameId}/penalties/validate`, {
                method: 'POST',
                body: JSON.stringify({ playerId, teamId })
            });
        } catch (error) {
            console.warn('Penalty validation endpoint failed, falling back to default');
            return {
                shouldEject: false,
                shouldSuspendNextGame: false,
                penaltyCount: 1,
                warningMessage: null,
                warningType: 'NORMAL'
            };
        }
    },

    // ============================================
    // PLAYERS API
    // TODO: Add when backend is ready
    // ============================================
    async getPlayersByGame(gameId) {
        // TODO: Implement real API call to get players for a specific game
        // const response = await fetch(`${API_BASE_URL}/games/${gameId}/players`);
        // if (!response.ok) throw new Error('Failed to fetch players');
        // return response.json();

        console.warn('getPlayersByGame not yet implemented');
        return Promise.resolve([]);
    },

    async getPlayersByTeam(teamId) {
        // TODO: Implement real API call to get players for a specific team
        // const response = await fetch(`${API_BASE_URL}/teams/${teamId}/players`);
        // if (!response.ok) throw new Error('Failed to fetch players');
        // return response.json();

        console.warn('getPlayersByTeam not yet implemented');
        return Promise.resolve([]);
    },

    // ============================================
    // TEAM CRUD OPERATIONS
    // ============================================
    async createTeam(data) {
        const response = await fetch(`${API_BASE_URL}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to create team');
        }
        return response.json();
    },

    async deleteTeam(id) {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete team');
        return response.ok;
    },

    // ============================================
    // SEASON CRUD OPERATIONS
    // ============================================
    async getSeasons() {
        const response = await fetch(`${API_BASE_URL}/seasons`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch seasons');
        return response.json();
    },

    // ============================================
    // PLAYER CRUD OPERATIONS
    // ============================================
    async createPlayer(data) {
        return request('/players', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updatePlayer(id, data) {
        return request(`/players/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    async deletePlayer(id) {
        return request(`/players/${id}`, { method: 'DELETE' });
    },

    // ============================================
    // SEASON CRUD OPERATIONS
    // ============================================
    async getSeasons() {
        return request('/seasons');
    },

    async createSeason(data) {
        return request('/seasons', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateSeason(id, data) {
        return request(`/seasons/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    async deleteSeason(id) {
        return request(`/seasons/${id}`, { method: 'DELETE' });
    },

    // User Management
    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return request(`/users${queryString ? `?${queryString}` : ''}`);
    },

    async getUserById(id) {
        return request(`/users/${id}`);
    },

    async createUser(userData) {
        return request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async updateUser(id, userData) {
        return request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },

    async deleteUser(id) {
        return request(`/users/${id}`, { method: 'DELETE' });
    },

    // User Role Management
    async getUserRoles(userId) {
        return request(`/users/${userId}/roles`);
    },

    async updateUserRoles(userId, roles) {
        return request(`/users/${userId}/roles`, {
            method: 'PUT',
            body: JSON.stringify({ roles })
        });
    },

    // Role Management
    async getRoles() {
        return request('/roles');
    },

    async createRole(roleData) {
        return request('/roles', {
            method: 'POST',
            body: JSON.stringify(roleData)
        });
    },

    async updateRole(id, roleData) {
        return request(`/roles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(roleData)
        });
    },

    async deleteRole(id) {
        return request(`/roles/${id}`, { method: 'DELETE' });
    },

    // ============================================
    // GOALIE SHIFTS API
    // ============================================
    async getAllGoalieUnavailability() {
        return request('/shifts/goalie/all-unavailability');
    },

    async getMyAssignments() {
        return request('/shifts/goalie/my-assignments');
    },

    async getMyShifts() {
        return request('/shifts/my-shifts');
    },

    async goalieSignup(data) {
        return request('/staff/goalie/signup', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async removeGoalieUnavailability(date) {
        return request(`/shifts/goalie/unavailable/${date}`, { method: 'DELETE' });
    },

    // ============================================
    // PLAYER STATS API
    // ============================================
    async getPlayerStats(seasonId, teamId = null) {
        const queryString = new URLSearchParams({ seasonId, ...(teamId && { teamId }) }).toString();
        return request(`/stats/players?${queryString}`);
    },

    async getPlayerStatsBulk(seasonId) {
        return request(`/stats/players?seasonId=${seasonId}`);
    },

    async generateUsers() {
        return request('/users/generate', { method: 'POST' });
    },

    async importGoalies(goalies) {
        return request('/users/import-goalies', {
            method: 'POST',
            body: JSON.stringify(goalies)
        });
    },

    async getPlayerDashboard() {
        return request('/user/dashboard');
    },

    async checkPlayerProfileExists(email) {
        try {
            const data = await request(`/players/exists?email=${encodeURIComponent(email)}`);
            return data.exists === true;
        } catch {
            return false;
        }
    }
};

// Export all functions individually
export const {
    login,
    logout,
    getPlayers,
    getTeams,
    getTeam,
    updateTeam,
    createTeam,
    deleteTeam,
    getGames,
    getGame,
    updateGame,
    getSeasons,
    getCurrentSeason,
    createSeason,
    updateSeason,
    deleteSeason,
    getPlayerStats,
    getPlayerStatsBulk,
    scorekeeperSignup,
    getUserRoles,
    updateUserRoles,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    generateUsers,
    importGoalies,
    getAllGoalieUnavailability,
    getMyAssignments,
    getMyShifts,
    goalieSignup,
    signup,
    getSecurityQuestion,
    resetPassword,
    changePassword,
    getGameEvents,
    getPlayerDashboard,
    getUserPublicName,
    checkPlayerProfileExists,
    updatePlayer,
    createPlayer,
    deletePlayer,
    updateGameScore,
    saveGameEvent,
    finalizeGame,
    unfinalizeGame,
    validatePenalty,
    getUserById,
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    removeGoalieUnavailability
} = api;

export default api;
