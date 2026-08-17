import { createContext, useContext } from 'react';

/**
 * The tournament being viewed, resolved once by TournamentLayout.
 *
 * In its own module rather than exported from the layout component so the file exports only a
 * component — Fast Refresh warns about mixed component/value exports, and the pages need the hook
 * without importing the layout.
 *
 * `seasonId` is the important part for pages: tournament teams, players and games are ordinary
 * season-scoped rows, so every data fetch is `?seasonId={seasonId}`.
 */
export const TournamentContext = createContext(null);

export function useTournament() {
    const ctx = useContext(TournamentContext);
    if (!ctx) {
        throw new Error('useTournament must be used inside TournamentLayout');
    }
    return ctx;
}
