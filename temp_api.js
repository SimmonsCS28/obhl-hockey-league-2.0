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
            const errorData = await response.text();
            throw new Error(errorData || 'Login failed');
        }
        return response.json();
    },

    async register(userData) {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (!response.ok) throw new Error('Registration failed');
        return response.json();
    },

    // Logout is client-side only (clearing token)
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    // ============================================
    // TEAMS API
    // ============================================
    async getTeams(seasonId) {
        let url = `${API_BASE_URL}/teams`;
        if (seasonId) {
            url += `?seasonId=${seasonId}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch teams');
        return response.json();
    },

    async getTeam(id) {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`);
        if (!response.ok) throw new Error('Failed to fetch team');
        return response.json();
    },

    async createTeam(teamData) {
        const response = await fetch(`${API_BASE_URL}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(teamData)
        });
        if (!response.ok) throw new Error('Failed to create team');
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

    async deleteTeam(id) {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete team');
        return true;
    },

    // ============================================
    // GAMES API
    // ============================================
    async getGames(seasonId) {
        let url = `${API_BASE_URL}/games`;
        if (seasonId) {
            url += `?seasonId=${seasonId}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch games');
        return response.json();
    },

    async createGame(gameData) {
        const response = await fetch(`${API_BASE_URL}/games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(gameData)
        });
        if (!response.ok) throw new Error('Failed to create game');
        return response.json();
    },

    async updateGame(id, gameData) {
        const response = await fetch(`${API_BASE_URL}/games/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(gameData)
        });
        if (!response.ok) throw new Error('Failed to update game');
        return response.json();
    },

    // Alias for updateGame with simpler signature if used elsewhere
    async updateGameScore(id, homeScore, awayScore) {
        // This might be redundant if updateGame handles it, but keeping for compatibility
        return this.updateGame(id, { homeScore, awayScore });
    },

    async deleteGame(id) {
        const response = await fetch(`${API_BASE_URL}/games/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete game');
        return true;
    },

    // ============================================
    // SEASONS API
    // ============================================
    async getSeasons() {
        const response = await fetch(`${API_BASE_URL}/seasons`);
        if (!response.ok) throw new Error('Failed to fetch seasons');
        return response.json();
    },

    async createSeason(seasonData) {
        const response = await fetch(`${API_BASE_URL}/seasons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(seasonData)
        });
        if (!response.ok) throw new Error('Failed to create season');
        return response.json();
    },

    async updateSeason(id, seasonData) {
        const response = await fetch(`${API_BASE_URL}/seasons/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(seasonData)
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
        return true;
    },

    async setActiveSeason(id) {
        const response = await fetch(`${API_BASE_URL}/seasons/${id}/activate`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to set active season');
        return response.json();
    },

    // ============================================
    // PLAYERS API
    // ============================================
    async getPlayers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_BASE_URL}/players${queryString ? `?${queryString}` : ''}`;
        const response = await fetch(url, {
            headers: getAuthHeaders(),
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to fetch players');
        return response.json();
    },

    async getPlayersByTeam(teamId) {
        return this.getPlayers({ teamId });
    },

    async getPlayersByGame(gameId) {
        // This was a placeholder in original file, keeping it for compatibility
        console.warn('getPlayersByGame not fully implemented');
        return [];
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
            method: 'PUT',
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
        return true;
    },

    // ============================================
    // GAME EVENTS API (Live Score)
    // ============================================
    async saveGameEvent(gameId, event) {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(event)
        });
        if (!response.ok) throw new Error('Failed to save game event');
        return response.json();
    },

    async validatePenalty(playerId, gameId) {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}/penalties/validate?playerId=${playerId}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to validate penalty');
        return response.json();
    },

    async finalizeGame(gameId, homeScore, awayScore, endedInOT) {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}/finalize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ homeScore, awayScore, endedInOT })
        });
        if (!response.ok) throw new Error('Failed to finalize game');
        return response.json();
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
    deleteSeason,
    setActiveSeason
} = api;

export default api;
