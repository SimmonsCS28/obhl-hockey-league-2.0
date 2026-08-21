import { request } from './api';

/**
 * C League Classic API client.
 *
 * A separate module from api.js rather than another section of that 990-line object -- the
 * tournament is a self-contained surface and there is no reason for it to grow the file every
 * component already imports. It reuses api.js's `request` helper so auth headers, the 401
 * session-expiry event and server-error-message extraction behave identically.
 *
 * Reads are public (the microsite is public); writes require ADMIN, enforced in the gateway's
 * SecurityConfig.
 */
const tournamentApi = {
    /**
     * @param {boolean} includeUnpublished admin view. The public list only ever returns
     *   tournaments that have been deliberately published.
     */
    async list(includeUnpublished = false) {
        const qs = includeUnpublished ? '?includeUnpublished=true' : '';
        return request(`/tournaments${qs}`);
    },

    async getBySlug(slug) {
        return request(`/tournaments/${encodeURIComponent(slug)}`);
    },

    /**
     * Creates the tournament AND its backing season in one call -- do not create the season
     * separately, or it will default to a league season and show up in league season lists.
     */
    async create(data) {
        return request('/tournaments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id, data) {
        return request(`/tournaments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    /** Cascades to the backing season and everything in it. Refused once play has started. */
    async remove(id) {
        return request(`/tournaments/${id}`, { method: 'DELETE' });
    },
};

export default tournamentApi;
