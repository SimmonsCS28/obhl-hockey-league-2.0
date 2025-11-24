const API_BASE_URL = 'http://localhost:8000/api/v1';

// API client for backend services
const api = {
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
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update team');
        return response.json();
    },

    // ============================================
    // GAMES API
    // TODO: Connect to Game Service on port 8002
    // ============================================
    async getGames(status = null) {
        // TODO: Implement real API call to Game Service
        // const response = await fetch(`${API_BASE_URL}/games${status ? `?status=${status}` : ''}`);
        // if (!response.ok) throw new Error('Failed to fetch games');
        // return response.json();

        // TEMPORARY: Return empty array until backend is connected
        return Promise.resolve([]);
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
    }
};

export default api;
