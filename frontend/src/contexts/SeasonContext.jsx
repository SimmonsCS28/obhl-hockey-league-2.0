import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSeasons } from '../services/api';

// Find the active season in a list, falling back to the first entry.
const findActive = (list) => list.find(s => s.isActive || s.status === 'active') || list[0] || null;

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
    // Fetched with type=ALL and split here rather than fetched twice.
    //
    // `seasons` stays league-only, so every existing consumer — and the whole public site — is
    // unchanged and a tournament can never retarget it. `allSeasons` additionally carries
    // tournament seasons, for the admin surfaces that legitimately need them: Live Score Entry,
    // Assignments and the Coordinator Console all have to reach tournament games, and hiding those
    // seasons everywhere would leave the tournament unplayable.
    //
    // Safe for the default selection because a tournament season can never be active — the database
    // forbids it (chk_tournament_never_active), so findActive below cannot land on one.
    const [allSeasons, setAllSeasons] = useState([]);
    const seasons = allSeasons.filter(s => s.type !== 'TOURNAMENT');
    const [selectedSeasonId, setSelectedSeasonId] = useState(null); // null = active season
    const [loadingSeasons, setLoadingSeasons] = useState(true);

    useEffect(() => {
        getSeasons('ALL')
            .then(data => {
                setAllSeasons(data);
                // Default to the active season
                const active = findActive(data.filter(s => s.type !== 'TOURNAMENT'));
                if (active) setSelectedSeasonId(active.id);
            })
            .catch(err => console.error('Failed to load seasons:', err))
            .finally(() => setLoadingSeasons(false));
    }, []);

    // Snap the selection back to the active season. Public pages call this on mount so
    // they always open on the current season (the selection is otherwise app-global and
    // would otherwise persist an archived pick across navigations). The admin topbar
    // deliberately does NOT call this — it keeps one selection across all its tabs.
    const resetToActiveSeason = useCallback(() => {
        const active = findActive(seasons);
        if (active) setSelectedSeasonId(active.id);
    }, [seasons]);

    // Looked up in the full list: the admin may have the tournament season selected.
    const selectedSeason = allSeasons.find(s => s.id === selectedSeasonId) || null;
    const isHistoricalView = selectedSeason && selectedSeason.status === 'completed';

    return (
        <SeasonContext.Provider value={{
            seasons,
            allSeasons,
            selectedSeasonId,
            setSelectedSeasonId,
            selectedSeason,
            isHistoricalView,
            loadingSeasons,
            resetToActiveSeason,
        }}>
            {children}
        </SeasonContext.Provider>
    );
}

export function useSeason() {
    const ctx = useContext(SeasonContext);
    if (!ctx) throw new Error('useSeason must be used within a SeasonProvider');
    return ctx;
}
