import { request } from './api';

/**
 * Tournament draft API.
 *
 * Every route is ADMIN-only — including the board GET, because it carries entrant names, emails
 * and phone numbers. That gating lives in the gateway's SecurityConfig, stated ahead of the public
 * /tournaments/** rule so the permitAll cannot swallow it.
 */
const draftApi = {
    /** Whole board in one call: entrants, teams, counts and warnings. */
    getBoard(slug) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft`);
    },

    /**
     * @param entrants parsed client-side from the spreadsheet and posted as JSON. The gateway
     *   proxies read bodies as String, so multipart cannot reach league-service; parsing in the
     *   browser also lets the operator check the rows before anything is written.
     */
    importEntrants(slug, entrants, replaceExisting = false) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/entrants`, {
            method: 'POST',
            body: JSON.stringify({ entrants, replaceExisting }),
        });
    },

    matchAccounts(slug) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/match-accounts`, { method: 'POST' });
    },

    /** userId null records a deliberate "no account", which re-matching will not overwrite. */
    setLink(slug, entrantId, userId) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/entrants/${entrantId}/link`, {
            method: 'PUT',
            body: JSON.stringify({ userId }),
        });
    },

    placeGms(slug) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/place-gms`, { method: 'POST' });
    },

    assign(slug, entrantId, teamId) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/picks/${entrantId}`, {
            method: 'PUT',
            body: JSON.stringify({ teamId }),
        });
    },

    unassign(slug, entrantId) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/picks/${entrantId}`, {
            method: 'DELETE',
        });
    },

    undo(slug) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/undo`, { method: 'POST' });
    },

    /** Creates the players rows. One-way. */
    commit(slug) {
        return request(`/tournaments/${encodeURIComponent(slug)}/draft/commit`, { method: 'POST' });
    },
};

export default draftApi;
