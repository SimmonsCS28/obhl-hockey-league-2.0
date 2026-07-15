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
            // Surface the server's message (JSON {error|message} or plain text) cleanly.
            let message = errorBody;
            try {
                const parsed = JSON.parse(errorBody);
                message = parsed.error || parsed.message || errorBody;
            } catch { /* not JSON — use raw text */ }
            throw new Error(message || `Request failed with status ${response.status}`);
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

    async forgotPassword(email) {
        return request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },

    async resetPasswordWithToken(data) {
        return request('/auth/reset-password-with-token', {
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

    async changePassword(oldPassword, newPassword, token, securityQuestion, securityAnswer) {
        const body = { oldPassword, newPassword };
        if (securityQuestion) body.securityQuestion = securityQuestion;
        if (securityAnswer) body.securityAnswer = securityAnswer;
        return request('/auth/change-password', {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: JSON.stringify(body)
        });
    },

    async getProfile() {
        return request('/auth/profile');
    },

    async updateProfile(data) {
        return request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
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

    async updateGameScore(gameId, homeScore, awayScore, period) {
        return request(`/games/${gameId}/score`, {
            method: 'PATCH',
            body: JSON.stringify({ homeScore, awayScore, period })
        });
    },

    async startGame(gameId) {
        return request(`/games/${gameId}/start`, {
            method: 'POST'
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

    async deleteGameEvent(gameId, eventId) {
        return request(`/games/${gameId}/events/${eventId}`, {
            method: 'DELETE'
        });
    },

    async updateGameEvent(gameId, eventId, event) {
        return request(`/games/${gameId}/events/${eventId}`, {
            method: 'PATCH',
            body: JSON.stringify(event)
        });
    },

    async finalizeGame(gameId, homeScore, awayScore, endedInOT = false, forfeitTeamId = null) {
        return request(`/games/${gameId}/finalize`, {
            method: 'POST',
            body: JSON.stringify({ homeScore, awayScore, endedInOT, forfeitTeamId })
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

    // Admin-only: override any goalie's availability for a specific date
    async adminMarkGoalieUnavailable(userId, date) {
        return request(`/shifts/goalie/admin/override/${userId}/${date}`, { method: 'POST' });
    },

    async adminRemoveGoalieUnavailability(userId, date) {
        return request(`/shifts/goalie/admin/override/${userId}/${date}`, { method: 'DELETE' });
    },

    // ============================================
    // COORDINATOR API
    // ============================================
    async getCoordinatorAssignments(seasonId, role, week) {
        const params = new URLSearchParams({ seasonId, role, ...(week != null && { week }) }).toString();
        return request(`/coordinator/assignments?${params}`);
    },

    async getCoordinatorAvailability(role) {
        return request(`/coordinator/availability?role=${role}`);
    },

    // v3 goalie pool: each goalie's positive availability for a week
    async getCoordinatorGoalieAvailability(seasonId, week) {
        return request(`/coordinator/goalie-availability?seasonId=${seasonId}&week=${week}`);
    },

    async proposeShift(data) {
        return request('/coordinator/propose', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async withdrawShift(id, role) {
        return request(`/coordinator/assignments/${id}?role=${role}`, { method: 'DELETE' });
    },

    // Coordinator confirms an official's self-signup (SIGNED_UP -> CONFIRMED)
    async confirmSignup(id, role) {
        return request(`/coordinator/assignments/${id}/confirm?role=${role}`, { method: 'POST' });
    },

    async publishShiftWeek(seasonId, role, week) {
        const params = new URLSearchParams({ seasonId, role, ...(week != null && { week }) }).toString();
        return request(`/coordinator/publish?${params}`, { method: 'POST' });
    },

    // Admin-only: assign a slot directly, bypassing propose/confirm/publish
    async adminAssignShift(data) {
        return request('/coordinator/admin-assign', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // ============================================
    // OPEN SLOTS (ref/scorekeeper self sign-up)
    // ============================================
    async getOpenSlots(role, seasonId, week) {
        const params = new URLSearchParams({ role, seasonId, ...(week != null && { week }) }).toString();
        return request(`/open-slots?${params}`);
    },

    async signupForSlot(slotId) {
        return request(`/slots/${slotId}/signup`, { method: 'POST' });
    },

    async dropSlotSignup(slotId) {
        return request(`/slots/${slotId}/signup`, { method: 'DELETE' });
    },

    // ============================================
    // GOALIE WEEKLY AVAILABILITY (v3, positive)
    // ============================================
    async getGoalieAvailability(seasonId) {
        return request(`/goalie/availability?seasonId=${seasonId}`);
    },

    async setGoalieAvailability(seasonId, week, status) {
        return request('/goalie/availability', {
            method: 'PUT',
            body: JSON.stringify({ seasonId, week, status })
        });
    },

    // ============================================
    // GOALIE STATS (season GAA/W-L/last-5, derived from completed games)
    // ============================================
    async getGoaliePerformance(seasonId) {
        return request(`/goalies/performance?seasonId=${seasonId}`);
    },

    async updateGoalieRating(playerId, skillRating) {
        // skillRating: integer 1-10, or null to clear
        return request(`/gm/players/${playerId}/skill`, {
            method: 'PATCH',
            body: JSON.stringify({ skillRating })
        });
    },

    // ============================================
    // SHIFT CONFIRMATIONS (in-app + public token)
    // ============================================
    async getPendingShifts() {
        return request('/shifts/pending');
    },

    async respondToShift(id, action, reason) {
        return request(`/shifts/${id}/respond`, {
            method: 'POST',
            body: JSON.stringify({ action, reason })
        });
    },

    async getShiftByToken(id, token) {
        return request(`/auth/shift-confirm?id=${id}&token=${encodeURIComponent(token)}`);
    },

    async respondToShiftByToken(id, token, action, reason) {
        return request('/auth/shift-confirm', {
            method: 'POST',
            body: JSON.stringify({ id, token, action, reason })
        });
    },

    // Staff availability self-service (referees)
    async getMyStaffAvailability(role) {
        return request(`/staff/availability?role=${role}`);
    },

    async markStaffUnavailable(role, dates) {
        return request(`/staff/availability?role=${role}`, {
            method: 'POST',
            body: JSON.stringify({ dates })
        });
    },

    async removeStaffUnavailable(role, date) {
        return request(`/staff/availability?role=${role}&date=${date}`, { method: 'DELETE' });
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

    async generatePreview() {
        return request('/users/generate-preview');
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
    },

    // ============================================
    // ANNOUNCEMENTS API
    // ============================================
    async getAnnouncements(activeOnly = false) {
        return request(`/announcements?activeOnly=${activeOnly}`);
    },

    async createAnnouncement(data) {
        return request('/announcements', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateAnnouncement(id, data) {
        return request(`/announcements/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async toggleAnnouncementActive(id, active) {
        return request(`/announcements/${id}/toggle?active=${active}`, {
            method: 'PATCH'
        });
    },

    async deleteAnnouncement(id) {
        return request(`/announcements/${id}`, { method: 'DELETE' });
    },

    // ============================================
    // LEAGUE RULES API
    // ============================================
    // Public: { sections:[{id,group,title,content,order}], publishedAt, publishedBy }
    async getRules() {
        return request('/rules');
    },

    // Admin editing view (same shape as getRules)
    async getAdminRules() {
        return request('/admin/rules');
    },

    // Admin: replace the full ordered section list
    async saveRules(sections) {
        return request('/admin/rules', {
            method: 'PUT',
            body: JSON.stringify({ sections })
        });
    },

    // Admin: stamp published_at / published_by
    async publishRules() {
        return request('/admin/rules/publish', { method: 'POST' });
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
    generatePreview,
    generateUsers,
    importGoalies,
    getAllGoalieUnavailability,
    getCoordinatorAssignments,
    getCoordinatorAvailability,
    getCoordinatorGoalieAvailability,
    proposeShift,
    withdrawShift,
    confirmSignup,
    publishShiftWeek,
    getOpenSlots,
    signupForSlot,
    dropSlotSignup,
    getGoalieAvailability,
    setGoalieAvailability,
    getGoaliePerformance,
    updateGoalieRating,
    getPendingShifts,
    respondToShift,
    getShiftByToken,
    respondToShiftByToken,
    getMyStaffAvailability,
    markStaffUnavailable,
    removeStaffUnavailable,
    getMyAssignments,
    getMyShifts,
    goalieSignup,
    signup,
    getSecurityQuestion,
    resetPassword,
    forgotPassword,
    resetPasswordWithToken,
    changePassword,
    getProfile,
    updateProfile,
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
    removeGoalieUnavailability,
    getAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    toggleAnnouncementActive,
    deleteAnnouncement,
    getRules,
    getAdminRules,
    saveRules,
    publishRules
} = api;

export default api;
