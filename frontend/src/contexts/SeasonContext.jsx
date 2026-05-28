import { createContext, useContext, useEffect, useState } from 'react';
import { getSeasons } from '../services/api';

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
                const active = data.find(s => s.isActive || s.status === 'active');
                if (active) setSelectedSeasonId(active.id);
                else if (data.length > 0) setSelectedSeasonId(data[0].id);
            })
            .catch(err => console.error('Failed to load seasons:', err))
            .finally(() => setLoadingSeasons(false));
    }, []);

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
