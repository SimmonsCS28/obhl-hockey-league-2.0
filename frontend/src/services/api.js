const API_BASE_URL = '/api/v1';

// Helper to get auth token
const getAuthToken = () => localStorage.getItem('token');

// Helper to add auth header
const getAuthHeaders = () => {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// API client for backend services
const api = {
    // ============================================
    // AUTHENTICATION API
    // ============================================
    async login(usernameOrEmail, password) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail, password })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Login failed');
        }
        return response.json();
    },

    async logout() {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { ...getAuthHeaders() }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    // ============================================
    // TEAMS API
    // ============================================
    async getTeams() {
        const response = await fetch(`${API_BASE_URL}/teams`);
        if (!response.ok) throw new Error('Failed to fetch teams');
        return response.json();
    },

    async getTeam(id) {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`);
        if (!response.ok) throw new Error('Failed to fetch team');
        return response.json();
    },

    async updateTeam(id, data) {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update team');
        return response.json();
    },

    // ============================================
    // GAMES API (Game Service on port 8002)
    // ============================================
    async getGames(seasonId = null) {
        const GAME_SERVICE_URL = '/games-api';
        let url = `${GAME_SERVICE_URL}/games`;
        if (seasonId) {
            url += `?seasonId=${seasonId}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch games');
        return response.json();
    },

    async updateGameScore(gameId, homeScore, awayScore) {
        // TODO: Implement real API call to Game Service
        // const response = await fetch(`${API_BASE_URL}/games/${gameId}/score`, {
        //     method: 'PATCH',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ homeScore, awayScore })
        // });
        // if (!response.ok) throw new Error('Failed to update game score');
        // return response.json();

        console.warn('updateGameScore not yet connected to backend');
        return { success: true };
    },

    async saveGameEvent(gameId, event) {
        // TODO: Implement real API call to Game Service
        // const response = await fetch(`${API_BASE_URL}/games/${gameId}/events`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(event)
        // });
        // if (!response.ok) throw new Error('Failed to save game event');
        // return response.json();

        console.warn('saveGameEvent not yet connected to backend');
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true, eventId: event.id });
            }, 100);
        });
    },

    async finalizeGame(gameId, homeScore, awayScore, endedInOT = false) {
        // TODO: Implement real API call to Game Service
        // const response = await fetch(`${API_BASE_URL}/games/${gameId}/finalize`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ homeScore, awayScore, endedInOT })
        // });
        // if (!response.ok) throw new Error('Failed to finalize game');
        // return response.json();

        console.warn('finalizeGame not yet connected to backend');
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true, status: 'completed' });
            }, 500);
        });
    },

    // ============================================
    // PENALTY VALIDATION API
    // TODO: Connect to Game Service penalty validation endpoint
    // ============================================
    async validatePenalty(playerId, gameId) {
        // TODO: Implement real API call to Game Service
        // const response = await fetch(`${API_BASE_URL}/games/${gameId}/penalties/validate`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ playerId })
        // });
        // if (!response.ok) throw new Error('Failed to validate penalty');
        // return response.json();

        console.warn('validatePenalty not yet connected to backend');

        // TEMPORARY: Return no ejection/suspension until backend is connected
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    shouldEject: false,
                    shouldSuspendNextGame: false,
                    penaltyCount: 1,
                    warningMessage: 'Penalty recorded (backend validation pending)',
                    warningType: 'NORMAL'
                });
            }, 100);
        });
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
    async getPlayers(params = {}) {
        const queryString = new URLSearchParams({ ...params, _t: Date.now() }).toString();
        const url = `${API_BASE_URL}/players${queryString ? `?${queryString}` : ''}`;
        const response = await fetch(url, {
            headers: getAuthHeaders(),
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to fetch players');
        return response.json();
    },

    async createPlayer(data) {
        const response = await fetch(`${API_BASE_URL}/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create player');
        return response.json();
    },

    async updatePlayer(id, data) {
        const response = await fetch(`${API_BASE_URL}/players/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update player');
        return response.json();
    },

    async deletePlayer(id) {
        const response = await fetch(`${API_BASE_URL}/players/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete player');
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

    async createSeason(data) {
        const response = await fetch(`${API_BASE_URL}/seasons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create season');
        return response.json();
    },

    async updateSeason(id, data) {
        const response = await fetch(`${API_BASE_URL}/seasons/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update season');
        return response.json();
    },

    async deleteSeason(id) {
        const response = await fetch(`${API_BASE_URL}/seasons/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete season');
        return response.ok;
    }
};

// Export all functions individually
export const {
    login,
    logout,
    getTeams,
    getTeam,
    updateTeam,
    createTeam,
    deleteTeam,
    getGames,
    updateGameScore,
    saveGameEvent,
    finalizeGame,
    validatePenalty,
    getPlayersByGame,
    getPlayersByTeam,
    getPlayers,
    createPlayer,
    updatePlayer,
    deletePlayer,
    getSeasons,
    createSeason,
    updateSeason,
    deleteSeason
} = api;

export default api;
