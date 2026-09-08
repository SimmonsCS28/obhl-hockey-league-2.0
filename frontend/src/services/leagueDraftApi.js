import { request } from './api';

/**
 * League Draft Tool API client (admin ?tab=draft).
 *
 * NOT to be confused with draftApi.js, which belongs to the separate Tournament Draft and
 * talks to /tournaments/{slug}/draft. The two tools share a name and nothing else: this one
 * persists a whole-board JSON blob to draft_saves, the tournament one drives normalized
 * per-pick tables.
 *
 * Every call routes through the shared request() helper so it picks up the same auth header,
 * 401 session handling and server-message extraction as the rest of the app. DraftDashboard
 * previously hand-rolled fetch() for all of these, with manual Bearer headers and two
 * different base-URL conventions in the same file.
 *
 * The registration upload is the one deliberate exception and stays in DraftService.js: it is
 * multipart/form-data and request() forces Content-Type: application/json, which would strip
 * the multipart boundary.
 *
 * Note these live under /api/league (the gateway's league-service proxy), not /api/v1 —
 * request() passes that prefix through untouched.
 */
const DRAFT_BASE = '/api/league/draft';

export const leagueDraftApi = {
    /**
     * Most recent saved draft, or null when there is none.
     * The endpoint answers 204 for "no saved draft", which request() surfaces as {}.
     */
    async getLatest() {
        const result = await request(`${DRAFT_BASE}/latest`);
        return result && result.id ? result : null;
    },

    async getById(draftId) {
        return request(`${DRAFT_BASE}/${draftId}`);
    },

    /** Creates a new saved draft row and returns it, including the id to update from here on. */
    async create(draftState) {
        return request(`${DRAFT_BASE}/save`, {
            method: 'POST',
            body: JSON.stringify(draftState)
        });
    },

    /** Overwrites an existing saved draft. This is the call auto-save will make. */
    async update(draftId, draftState) {
        return request(`${DRAFT_BASE}/save/${draftId}`, {
            method: 'PUT',
            body: JSON.stringify(draftState)
        });
    },

    /**
     * Commits the draft: creates the season's teams and players.
     * One-way — the backend validates that every team has a GM first.
     */
    async finalize(draftId) {
        return request(`${DRAFT_BASE}/${draftId}/finalize`, { method: 'POST' });
    },

    /** Whether a read-only share link is currently live. Never returns the token itself. */
    async shareStatus(draftId) {
        return request(`${DRAFT_BASE}/${draftId}/share`);
    },

    /**
     * Mints a share link and returns { token }. This is the ONLY time the raw token exists in a
     * readable form — only its hash is stored — so whatever calls this has to show it to the
     * operator immediately. Calling it again rotates the token and kills any link already shared.
     */
    async createShare(draftId) {
        return request(`${DRAFT_BASE}/${draftId}/share`, { method: 'POST' });
    },

    /** Turns sharing off. Every link already handed out stops working. */
    async revokeShare(draftId) {
        return request(`${DRAFT_BASE}/${draftId}/share`, { method: 'DELETE' });
    }
};

export default leagueDraftApi;
