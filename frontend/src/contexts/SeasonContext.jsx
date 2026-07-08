import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSeasons } from '../services/api';

// Find the active season in a list, falling back to the first entry.
const findActive = (list) => list.find(s => s.isActive || s.status === 'active') || list[0] || null;

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState(null); // null = active season
    const [loadingSeasons, setLoadingSeasons] = useState(true);

    useEffect(() => {
        getSeasons()
            .then(data => {
                setSeasons(data);
                // Default to the active season
                const active = findActive(data);
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

    const selectedSeason = seasons.find(s => s.id === selectedSeasonId) || null;
    const isHistoricalView = selectedSeason && selectedSeason.status === 'completed';

    return (
        <SeasonContext.Provider value={{
            seasons,
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
