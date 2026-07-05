import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import GameEditModal from './GameEditModal';
import './ScheduleManager.css';

const API_BASE_URL = '/api/v1';
// TODO: Fix API Gateway multipart proxy and use API_BASE_URL for all requests
const GAME_SERVICE_URL = '/games-api'; // Proxy through Nginx

// Add auth token to all axios requests
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const ScheduleManager = () => {
    const [seasons, setSeasons] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [maxWeeks, setMaxWeeks] = useState(10);
    const [playoffWeeks, setPlayoffWeeks] = useState(3);
    const [csvFile, setCsvFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [parsedSlots, setParsedSlots] = useState([]);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [editingGame, setEditingGame] = useState(null);
    const [scheduleMode, setScheduleMode] = useState('none'); // 'none', 'draft', 'saved', 'editing'
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({
        addedGames: [],      // Games created locally (not yet in DB)
        editedGames: {},     // Map of gameId -> updated game data
        deletedGameIds: []   // IDs of games to delete from DB
    });
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        isDestructive: false,
        onConfirm: () => { }
    });
    const fileInputRef = useRef(null);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
    const [selectedWeek, setSelectedWeek] = useState('all');

    // Fetch seasons on mount
    useEffect(() => {
        fetchSeasons();
    }, []);

    // Responsive detection
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch teams when season is selected
    useEffect(() => {
        if (selectedSeason) {
            fetchTeams(selectedSeason);
            fetchGames(selectedSeason);
        }
    }, [selectedSeason]);

    const fetchSeasons = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/seasons`);
            setSeasons(response.data);
            // Auto-select active season
            const activeSeason = response.data.find(s => s.isActive);
            if (activeSeason) {
                setSelectedSeason(activeSeason.id);
            }
        } catch (error) {
            showMessage('error', 'Failed to load seasons');
        }
    };

    const fetchTeams = async (seasonId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/teams?seasonId=${seasonId}`);
            setTeams(response.data);
        } catch (error) {
            showMessage('error', 'Failed to load teams');
        }
    };

    const fetchGames = async (seasonId, preserveMode = false) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/games?seasonId=${seasonId}`);
            setGames(response.data);

            // Only set mode if not preserving current mode
            if (!preserveMode) {
                // If games exist in DB, we're in saved mode
                if (response.data.length > 0) {
                    setScheduleMode('saved');
                    setHasPendingChanges(false);
                } else {
                    setScheduleMode('none');
                }
            }
        } catch (error) {
            console.error('Failed to load games:', error);
        }
    };

    const processFile = async (file) => {
        if (!file) return;

        setCsvFile(file);
        setLoading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Use GAME_SERVICE_URL directly to bypass API Gateway for file uploads
            const response = await axios.post(`${GAME_SERVICE_URL}/games/upload-slots`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setParsedSlots(response.data);
            showMessage('success', `Parsed ${response.data.length} game slots successfully`);
        } catch (error) {
            showMessage('error', error.response?.data || 'Failed to parse CSV file');
            setCsvFile(null);
            // Reset file input to allow re-upload
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e) => processFile(e.target.files[0]);

    const handleFileDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (loading) return;
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        if (file.name.toLowerCase().endsWith('.csv')) {
            processFile(file);
        } else {
            showMessage('error', 'Please drop a .csv file');
        }
    };

    const handleGenerateSchedule = async () => {
        if (!selectedSeason || !parsedSlots.length || !teams.length) {
            showMessage('error', 'Please select a season, upload slots, and ensure teams exist');
            return;
        }

        setLoading(true);

        try {
            const teamIds = teams.map(t => t.id);
            const request = {
                seasonId: selectedSeason,
                leagueId: teams[0]?.leagueId || null,
                teamIds: teamIds,
                gameSlots: parsedSlots,
                maxWeeks: maxWeeks,
                playoffWeeks: playoffWeeks
            };


            const response = await axios.post(`${API_BASE_URL}/games/generate`, request);

            // Use returned draft games (not saved to database yet)
            // Add temporary IDs so edit modal works correctly
            const gamesWithTempIds = response.data.map((game, index) => ({
                ...game,
                id: `temp-${index}` // Temporary ID for UI purposes
            }));

            // Store them as "added games" so Save Schedule can create them
            setGames(gamesWithTempIds);
            setPendingChanges({
                addedGames: gamesWithTempIds,
                editedGames: {},
                deletedGameIds: []
            });
            setScheduleMode('draft');
            showMessage('success', 'Schedule generated! Review and click "Save Schedule" to finalize.');
            setParsedSlots([]);
            setCsvFile(null);
        } catch (error) {
            showMessage('error', error.response?.data || 'Failed to generate schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleResetSchedule = async () => {
        if (!selectedSeason) return;

        setConfirmModal({
            show: true,
            title: 'Reset Schedule?',
            message: '⚠️ WARNING: This will delete ALL games for this season!\n\nThis action cannot be undone. Are you absolutely sure?',
            confirmText: 'Reset Schedule',
            isDestructive: true,
            onConfirm: async () => {
                setLoading(true);
                try {
                    await axios.delete(`${API_BASE_URL}/games/season/${selectedSeason}`);
                    showMessage('success', 'Schedule reset successfully');
                    setGames([]);
                    setScheduleMode('none');
                } catch (error) {
                    showMessage('error', error.response?.data || 'Failed to reset schedule');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleSaveSchedule = async () => {
        const message = scheduleMode === 'draft'
            ? 'Are you sure you want to finalize this schedule? Once saved, you can only edit individual games or add weeks.'
            : 'Are you sure you want to save all changes? This will overwrite the current schedule.';

        setConfirmModal({
            show: true,
            title: 'Save Schedule?',
            message: message,
            confirmText: 'Save Schedule',
            isDestructive: false,
            onConfirm: async () => {
                setLoading(true);

                try {
                    // 1. Delete games
                    for (const gameId of pendingChanges.deletedGameIds) {
                        await axios.delete(`${API_BASE_URL}/games/${gameId}`);
                    }

                    // 2. Create new games
                    for (const game of pendingChanges.addedGames) {
                        const { id, ...gameData } = game; // Remove temp ID
                        await axios.post(`${API_BASE_URL}/games`, gameData);
                    }

                    // 3. Update edited games
                    for (const [gameId, gameData] of Object.entries(pendingChanges.editedGames)) {
                        await axios.patch(`${API_BASE_URL}/games/${gameId}`, gameData);
                    }

                    // Clear pending changes
                    setPendingChanges({
                        addedGames: [],
                        editedGames: {},
                        deletedGameIds: []
                    });

                    // Reload games from DB
                    await fetchGames(selectedSeason);

                    showMessage('success', 'Schedule saved successfully!');
                } catch (error) {
                    showMessage('error', error.response?.data || 'Failed to save schedule');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleDownloadSchedule = () => {
        if (!games.length) {
            showMessage('error', 'No games to download');
            return;
        }

        // Create CSV content
        const headers = ['Week', 'Date', 'Time', 'Home Team', 'Away Team', 'Rink'];
        const csvRows = [headers.join(',')];

        // Sort games by date and week
        const sortedGames = [...games].sort((a, b) => {
            if (a.week !== b.week) return a.week - b.week;
            return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
        });

        sortedGames.forEach(game => {
            const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
            const date = gameDate.toLocaleDateString();
            const time = gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const homeTeam = teams.find(t => t.id === game.homeTeamId)?.name || 'Unknown';
            const awayTeam = teams.find(t => t.id === game.awayTeamId)?.name || 'Unknown';

            csvRows.push([game.week, date, time, homeTeam, awayTeam, game.rink].join(','));
        });

        // Create blob and download
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const seasonName = seasons.find(s => s.id === selectedSeason)?.name || 'schedule';
        a.download = `${seasonName.replace(/\s+/g, '_')}_schedule.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showMessage('success', 'Schedule downloaded successfully!');
    };

    const handleAddWeek = async () => {
        if (!selectedSeason || !teams.length) return;

        // Calculate next week number
        const maxWeek = games.length > 0
            ? Math.max(...games.map(g => g.week || 0))
            : 0;
        const nextWeek = maxWeek + 1;

        // Calculate number of games (half the number of teams)
        const gamesPerWeek = Math.floor(teams.length / 2);

        // Use first two teams as placeholders (user will edit these)
        const placeholderHome = teams[0]?.id;
        const placeholderAway = teams[1]?.id || teams[0]?.id;

        // Create empty games locally (not in DB yet)
        const newGames = [];
        for (let i = 0; i < gamesPerWeek; i++) {
            const localGame = {
                id: `temp-${Date.now()}-${i}`, // Temporary ID for local tracking
                seasonId: selectedSeason,
                leagueId: teams[0]?.leagueId || null,
                week: nextWeek,
                gameDate: new Date().toISOString().replace('Z', ''),
                homeTeamId: placeholderHome,
                awayTeamId: placeholderAway,
                rink: 'Tubbs',
                status: 'scheduled',
                homeScore: 0,
                awayScore: 0,
                overtime: false,
                shootout: false,
                period: 1
            };
            newGames.push(localGame);
        }

        // Add to local state and pending changes
        setGames([...games, ...newGames]);
        setPendingChanges(prev => ({
            ...prev,
            addedGames: [...prev.addedGames, ...newGames]
        }));

        // Set to editing mode
        if (scheduleMode === 'saved') {
            setScheduleMode('editing');
        }
        setHasPendingChanges(true);
        showMessage('success', `Added Week ${nextWeek} with ${newGames.length} games. Click "Save Schedule" to persist.`);
    };

    const handleSaveGame = (gameData) => {
        const gameId = String(editingGame?.id || '');
        const isNewGame = gameId.startsWith('temp-');
        const isExistingGame = editingGame?.id && !isNewGame;

        // Update game in local state
        const updatedGame = {
            ...editingGame,
            ...gameData
        };

        // Update games array
        setGames(games.map(g => g.id === editingGame.id ? updatedGame : g));

        if (isNewGame) {
            // Update in addedGames
            setPendingChanges(prev => ({
                ...prev,
                addedGames: prev.addedGames.map(g =>
                    g.id === editingGame.id ? updatedGame : g
                )
            }));
        } else if (isExistingGame) {
            // Track edit for existing DB game
            setPendingChanges(prev => ({
                ...prev,
                editedGames: {
                    ...prev.editedGames,
                    [editingGame.id]: gameData
                }
            }));
        }

        setEditingGame(null);

        // Set to editing mode if we were in saved mode
        if (scheduleMode === 'saved') {
            setScheduleMode('editing');
        }
        setHasPendingChanges(true);
        showMessage('success', 'Game updated. Click "Save Schedule" to persist changes.');
    };

    const handleDeleteGame = (gameId) => {
        const gameIdStr = String(gameId || '');
        const isNewGame = gameIdStr.startsWith('temp-');

        // Remove from local games array
        setGames(games.filter(g => g.id !== gameId));

        if (isNewGame) {
            // Remove from addedGames
            setPendingChanges(prev => ({
                ...prev,
                addedGames: prev.addedGames.filter(g => g.id !== gameId)
            }));
        } else {
            // Track deletion for existing DB game
            setPendingChanges(prev => ({
                ...prev,
                deletedGameIds: [...prev.deletedGameIds, gameId],
                // Remove from editedGames if it was there
                editedGames: Object.fromEntries(
                    Object.entries(prev.editedGames).filter(([id]) => id !== gameId.toString())
                )
            }));
        }

        setEditingGame(null);

        // Set to editing mode if we were in saved mode
        if (scheduleMode === 'saved') {
            setScheduleMode('editing');
        }
        setHasPendingChanges(true);
        showMessage('success', 'Game deleted. Click "Save Schedule" to persist changes.');
    };

    // ── Inline editing (design's per-week editor) ──────────────────────────
    // Split a stored (UTC, no-Z) gameDate into local date + time parts for the
    // two inline inputs, mirroring GameEditModal's toLocalDateTimeString.
    const toLocalParts = (utcDateString) => {
        if (!utcDateString) return { date: '', time: '' };
        const s = utcDateString.endsWith('Z') ? utcDateString : utcDateString + 'Z';
        const d = new Date(s);
        const p = (n) => String(n).padStart(2, '0');
        return {
            date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
            time: `${p(d.getHours())}:${p(d.getMinutes())}`
        };
    };

    // Recombine local date + time back to the stored ISO (no trailing Z),
    // matching GameEditModal's handleSubmit conversion.
    const partsToStored = (date, time) => {
        if (!date || !time) return null;
        let iso = new Date(`${date}T${time}`).toISOString();
        return iso.endsWith('Z') ? iso.slice(0, -1) : iso;
    };

    // Apply a field patch to a game, updating local state + pending changes
    // using the same shapes handleSaveGame/handleSaveSchedule expect.
    const applyInlineEdit = (game, patch) => {
        const updated = { ...game, ...patch };
        setGames(prev => prev.map(g => (g.id === game.id ? updated : g)));

        const isNewGame = String(game.id).startsWith('temp-');
        if (isNewGame) {
            setPendingChanges(prev => ({
                ...prev,
                addedGames: prev.addedGames.map(g => (g.id === game.id ? updated : g))
            }));
        } else {
            setPendingChanges(prev => ({
                ...prev,
                editedGames: {
                    ...prev.editedGames,
                    [game.id]: {
                        homeTeamId: updated.homeTeamId,
                        awayTeamId: updated.awayTeamId,
                        gameDate: updated.gameDate,
                        rink: updated.rink,
                        week: updated.week
                    }
                }
            }));
        }

        if (scheduleMode === 'saved') setScheduleMode('editing');
        setHasPendingChanges(true);
    };

    const handleInlineDateChange = (game, newDate) => {
        const { time } = toLocalParts(game.gameDate);
        const stored = partsToStored(newDate, time || '00:00');
        if (stored) applyInlineEdit(game, { gameDate: stored });
    };

    const handleInlineTimeChange = (game, newTime) => {
        const { date } = toLocalParts(game.gameDate);
        const stored = partsToStored(date, newTime);
        if (stored) applyInlineEdit(game, { gameDate: stored });
    };

    const handleRemoveWeek = (week) => {
        const weekGames = gamesByWeek[week] || [];
        setConfirmModal({
            show: true,
            title: `Remove Week ${week}?`,
            message: `This removes all ${weekGames.length} game(s) in Week ${week}. Click "Save Schedule" afterward to persist.`,
            confirmText: 'Remove Week',
            isDestructive: true,
            onConfirm: () => {
                const ids = weekGames.map(g => g.id);
                const idStrs = ids.map(String);
                setGames(prev => prev.filter(g => !ids.includes(g.id)));
                setPendingChanges(prev => ({
                    ...prev,
                    addedGames: prev.addedGames.filter(g => !ids.includes(g.id)),
                    deletedGameIds: [
                        ...prev.deletedGameIds,
                        ...ids.filter(id => !String(id).startsWith('temp-'))
                    ],
                    editedGames: Object.fromEntries(
                        Object.entries(prev.editedGames).filter(([id]) => !idStrs.includes(id))
                    )
                }));
                if (scheduleMode === 'saved') setScheduleMode('editing');
                setHasPendingChanges(true);
                showMessage('success', `Week ${week} removed. Click "Save Schedule" to persist.`);
            }
        });
    };

    const handleClearChanges = async () => {
        setConfirmModal({
            show: true,
            title: 'Discard Changes?',
            message: 'Are you sure you want to discard all changes?\n\nThis will reload the saved schedule.',
            confirmText: 'Discard Changes',
            isDestructive: true,
            onConfirm: async () => {
                // Clear pending changes
                setPendingChanges({
                    addedGames: [],
                    editedGames: {},
                    deletedGameIds: []
                });

                // Reload from DB
                await fetchGames(selectedSeason);
                showMessage('success', 'Changes discarded. Schedule reverted to saved state.');
            }
        });
    };

    const handleInitializeBracket = async () => {
        if (!selectedSeason || !teams.length) return;

        setConfirmModal({
            show: true,
            title: 'Initialize Playoff Bracket?',
            message: 'This will seed the playoff bracket based on current regular season standings.\n\nSeed 1 (top of standings) will be matched against Seed 8, Seed 2 vs Seed 7, etc.\n\nAre you sure?',
            confirmText: 'Initialize Bracket',
            isDestructive: false,
            onConfirm: async () => {
                setLoading(true);
                try {
                    // Sort teams by points desc, then goal differential desc
                    const sorted = [...teams].sort((a, b) => {
                        const ptsDiff = (b.points || 0) - (a.points || 0);
                        if (ptsDiff !== 0) return ptsDiff;
                        const aGD = (a.goalsFor || 0) - (a.goalsAgainst || 0);
                        const bGD = (b.goalsFor || 0) - (b.goalsAgainst || 0);
                        return bGD - aGD;
                    });

                    const teamIds = sorted.map(t => t.id);

                    await axios.post(`${API_BASE_URL}/games/season/${selectedSeason}/initialize-bracket`, { teamIds });

                    // Reload games to show updated bracket
                    await fetchGames(selectedSeason, true);
                    showMessage('success', `Playoff bracket initialized! Seeds: ${sorted.slice(0, 4).map((t, i) => `${i + 1}. ${t.name}`).join(', ')}...`);
                } catch (error) {
                    showMessage('error', error.response?.data || 'Failed to initialize bracket');
                } finally {
                    setLoading(false);
                }
            }
        });
    };
    const showMessage = (type, text) => {
        let messageText = text;
        if (typeof text === 'object' && text !== null) {
            messageText = text.message || text.error || JSON.stringify(text);
        }
        setMessage({ type, text: messageText });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };


    const downloadTemplate = () => {
        // Create CSV content with headers and sample data
        const csvContent = `week,date,time,rink
1,2024-01-15,19:00,Tubbs
1,2024-01-15,20:00,Cardinal
2,2024-01-22,19:30,Tubbs
2,2024-01-22,20:30,Cardinal`;

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', 'game-slots-template.csv');
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showMessage('success', 'Template downloaded successfully');
    };


    const groupGamesByWeek = () => {
        const grouped = {};
        games.forEach(game => {
            const week = game.week || 'Unassigned';
            if (!grouped[week]) {
                grouped[week] = [];
            }
            grouped[week].push(game);
        });

        // Sort games within each week by date/time (earliest first)
        Object.keys(grouped).forEach(week => {
            grouped[week].sort((a, b) => {
                return new Date(a.gameDate) - new Date(b.gameDate);
            });
        });

        return grouped;
    };

    const getTeamById = (teamId) => {
        return teams.find(t => t.id === teamId);
    };

    // Helper to get valid CSS color
    const getValidColor = (color) => {
        if (!color) return '#95a5a6';

        // Map truncated DB values to valid CSS colors
        const colorMap = {
            'Lt. Blu': '#87CEEB', // SkyBlue
            'Dk. Gre': '#006400', // DarkGreen
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };

        return colorMap[color] || color;
    };

    // Helper to determine text color based on background
    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';

        const lightColors = [
            'White', '#FFFFFF',
            'Yellow', '#FFD700',
            'Gold',
            'Lt. Blu', '#87CEEB', 'LightBlue'
        ];

        // Check if color is in light list (case insensitive)
        const isLight = lightColors.some(c =>
            c.toLowerCase() === bgColor.toLowerCase()
        );

        return isLight ? '#2c3e50' : 'white';
    };

    const gamesByWeek = groupGamesByWeek();
    const weeks = Object.keys(gamesByWeek).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return parseInt(a) - parseInt(b);
    });

    // Check if selected season is active
    const isActiveSeason = seasons.find(s => s.id === selectedSeason)?.isActive || false;

    return (
        <div className="schedule-manager">
            <div className="sched-page-header">
                <div>
                    <h1>Schedule</h1>
                    <p className="sched-subtitle">Import the rink report &amp; generate the season</p>
                </div>
                {seasons.find(s => s.id === selectedSeason) && (
                    <span className="sched-season-badge">
                        {seasons.find(s => s.id === selectedSeason)?.name}
                    </span>
                )}
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="sched-cols">
            {/* LEFT: Import Schedule */}
            <div className="sched-panel sched-import">
                <h2 className="sched-panel-title">Import Schedule</h2>
                <p className="sched-panel-intro">
                    Upload the rink&apos;s ice-time CSV to generate a balanced season.
                    Columns: <strong>Week, Date, Rink, Time</strong>. Rinks: Cardinal / Tubbs.
                </p>

            {/* Season Selection */}
            <div className="sched-step">
                <span className="sched-step-label">Step 1 · Season</span>
                <select
                    id="seasonSelect"
                    name="seasonSelect"
                    value={selectedSeason || ''}
                    onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                    className="season-select"
                >
                    <option value="">Select a season...</option>
                    {seasons.map(season => (
                        <option key={season.id} value={season.id}>
                            {season.name} {season.isActive ? '(Active)' : ''}
                        </option>
                    ))}
                </select>
                {selectedSeason && teams.length > 0 && (
                    <p className="info">
                        {teams.length} teams found for this season
                    </p>
                )}
            </div>

            {/* Template */}
            {selectedSeason && isActiveSeason && (
                <div className="sched-step">
                    <span className="sched-step-label">Step 2 · Template</span>
                    <button
                        onClick={downloadTemplate}
                        className="btn-secondary btn-block"
                    >
                        <svg className="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download CSV Template
                    </button>
                </div>
            )}

            {/* File Upload */}
            {selectedSeason && isActiveSeason && (
                <div className="sched-step">
                    <span className="sched-step-label">Step 3 · Upload</span>
                    <label
                        htmlFor="csvUpload"
                        className={`sched-dropzone${isDragging ? ' is-dragging' : ''}${loading ? ' is-loading' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); if (!loading) setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleFileDrop}
                    >
                        <svg className="sched-dropzone-icon" width="30" height="30" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span className="sched-dropzone-title">Choose File</span>
                        <span className="sched-dropzone-sub">CSV export from the rink · drag &amp; drop or click</span>
                        <input
                            id="csvUpload"
                            name="csvUpload"
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={loading}
                            hidden
                        />
                    </label>
                    {csvFile && (
                        <div className="sched-file-chip">
                            <span className="sched-file-check">✓</span> {csvFile.name}
                        </div>
                    )}
                    {parsedSlots.length > 0 && (
                        <div className="slots-preview">
                            <h3>Parsed Slots ({parsedSlots.length})</h3>
                            <div className="slots-grid">
                                {parsedSlots.slice(0, 10).map((slot, idx) => (
                                    <div key={idx} className="slot-card">
                                        Week {slot.week}: {slot.date} {slot.time} - {slot.rink}
                                    </div>
                                ))}
                                {parsedSlots.length > 10 && (
                                    <div className="slot-card more">
                                        +{parsedSlots.length - 10} more...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Generate Schedule */}
            {selectedSeason && isActiveSeason && parsedSlots.length > 0 && (
                <div className="sched-step">
                    <span className="sched-step-label">Step 3 · Generate</span>
                    <div className="generate-form">
                        <label>
                            Max Weeks (Regular Season):
                            <input
                                id="maxWeeks"
                                name="maxWeeks"
                                type="number"
                                value={maxWeeks}
                                onChange={(e) => setMaxWeeks(parseInt(e.target.value))}
                                min="1"
                                max="20"
                            />
                        </label>
                        <label>
                            Playoff Weeks:
                            <input
                                id="playoffWeeks"
                                name="playoffWeeks"
                                type="number"
                                value={playoffWeeks}
                                onChange={(e) => setPlayoffWeeks(parseInt(e.target.value) || 0)}
                                min="0"
                                max="5"
                                title="Weeks at end of season for playoffs (e.g. 3 for QF/SF/Final)"
                            />
                        </label>
                        <div className="playoff-weeks-hint">
                            {playoffWeeks === 3 && '🏆 QF (Wk ' + (maxWeeks + 1) + ') → SF (Wk ' + (maxWeeks + 2) + ') → Final (Wk ' + (maxWeeks + 3) + ')'}
                            {playoffWeeks === 2 && '🏆 SF (Wk ' + (maxWeeks + 1) + ') → Final (Wk ' + (maxWeeks + 2) + ')'}
                            {playoffWeeks === 1 && '🏆 Final (Wk ' + (maxWeeks + 1) + ')'}
                            {playoffWeeks === 0 && 'No playoff weeks will be generated'}
                        </div>
                        <button
                            onClick={handleGenerateSchedule}
                            disabled={loading || games.length > 0}
                            className="btn-primary"
                        >
                            {loading ? 'Generating...' : 'Generate Schedule'}
                        </button>
                        {games.length > 0 && (
                            <p className="warning">
                                Schedule already exists. Reset first to regenerate.
                            </p>
                        )}
                    </div>
                </div>
            )}
            </div>{/* /.sched-import */}

            {/* RIGHT: Generated Schedule */}
            <div className="sched-panel sched-generated">
                <h2 className="sched-panel-title">Generated Schedule</h2>

                {(!selectedSeason || games.length === 0) && (
                    <div className="sched-empty">
                        Upload your rink CSV, then Generate to build a balanced season.
                        The final 3 weeks are reserved for playoffs automatically.
                    </div>
                )}

            {/* Schedule Display */}
            {selectedSeason && games.length > 0 && (
                <div className="sched-generated-body">
                    <div className="sched-generated-status">
                        {scheduleMode === 'draft' && '📝 Draft Schedule'}
                        {scheduleMode === 'saved' && '✅ Season Schedule'}
                        {scheduleMode === 'editing' && '✏️ Season Schedule (Editing)'}
                        {scheduleMode === 'none' && 'Generated Schedule'}
                        {' '}({games.length} games)
                    </div>

                    {/* Show Reset button only in draft mode */}
                    {scheduleMode === 'draft' && (
                        <button
                            onClick={handleResetSchedule}
                            disabled={loading}
                            className="btn-danger"
                        >
                            Reset Schedule
                        </button>
                    )}

                    {/* Show Save Schedule button in draft or editing mode */}
                    {(scheduleMode === 'draft' || scheduleMode === 'editing') && (
                        <button
                            onClick={handleSaveSchedule}
                            disabled={loading}
                            className="btn-primary"
                            style={{ marginLeft: scheduleMode === 'draft' ? '10px' : '0', marginBottom: '20px' }}
                        >
                            💾 Save Schedule
                        </button>
                    )}

                    {/* Download Schedule button - always show when games exist */}
                    {games.length > 0 && (
                        <button
                            onClick={handleDownloadSchedule}
                            disabled={loading}
                            className="btn-secondary"
                            style={{ marginLeft: '10px', marginBottom: '20px' }}
                        >
                            ⬇️ Download Schedule
                        </button>
                    )}

                    {/* Show Clear Changes button only in editing mode */}
                    {scheduleMode === 'editing' && (
                        <button
                            onClick={handleClearChanges}
                            disabled={loading}
                            className="btn-secondary"
                            style={{ marginLeft: '10px', marginBottom: '20px' }}
                        >
                            ↩️ Clear Changes
                        </button>
                    )}

                    {/* Week Filter - only show for saved/editing schedules */}
                    {(scheduleMode === 'saved' || scheduleMode === 'editing') && (
                        <div className="sm-week-filter">
                            <label className="sm-filter-label">Filter by Week:</label>
                            <select
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(e.target.value)}
                                className="season-select"
                                style={{ maxWidth: '200px', display: 'inline-block' }}
                            >
                                <option value="all">All Weeks</option>
                                {weeks.filter(w => w !== 'Unassigned').map(week => (
                                    <option key={week} value={week}>
                                        Week {week}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Responsive Schedule Display */}
                    {isDesktop ? (
                        // Desktop: Inline per-week editor (design)
                        <div className="sched-weeks">
                            {weeks
                                .filter(week => selectedWeek === 'all' || week === String(selectedWeek))
                                .map(week => {
                                    const weekGames = gamesByWeek[week] || [];
                                    const isPlayoffWeek = weekGames.some(g => g.gameType === 'PLAYOFF');
                                    return (
                                        <div key={week} className="sched-week">
                                            <div className="sched-week-head">
                                                <span className="sched-week-title">
                                                    {week === 'Unassigned' ? 'Unassigned' : `Week ${week}`}
                                                </span>
                                                <span className={`sched-week-tag${isPlayoffWeek ? ' is-playoff' : ''}`}>
                                                    {isPlayoffWeek ? 'Playoff' : 'Regular'}
                                                </span>
                                                <span className="sched-week-count">
                                                    {weekGames.length} game{weekGames.length === 1 ? '' : 's'}
                                                </span>
                                                {week !== 'Unassigned' && (
                                                    <button
                                                        className="sched-week-remove"
                                                        onClick={() => handleRemoveWeek(week)}
                                                        disabled={loading}
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                            <div className="sched-week-games">
                                                {weekGames.map(game => {
                                                    const { date, time } = toLocalParts(game.gameDate);
                                                    const homeColor = getValidColor(getTeamById(game.homeTeamId)?.teamColor);
                                                    const awayColor = getValidColor(getTeamById(game.awayTeamId)?.teamColor);
                                                    const isCompleted = game.status === 'completed';
                                                    const gd = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                                    const isNotFriday = gd.getDay() !== 5;
                                                    const isPlayoff = game.gameType === 'PLAYOFF';
                                                    return (
                                                        <div key={game.id} className="sched-game-row">
                                                            <div className="sched-game-when">
                                                                <input
                                                                    type="date"
                                                                    className="sched-inline-input"
                                                                    value={date}
                                                                    onChange={(e) => handleInlineDateChange(game, e.target.value)}
                                                                />
                                                                <input
                                                                    type="time"
                                                                    className="sched-inline-input"
                                                                    value={time}
                                                                    onChange={(e) => handleInlineTimeChange(game, e.target.value)}
                                                                />
                                                                <select
                                                                    className="sched-inline-input sched-rink-select"
                                                                    value={game.rink || 'Tubbs'}
                                                                    onChange={(e) => applyInlineEdit(game, { rink: e.target.value })}
                                                                >
                                                                    <option value="Tubbs">Tubbs</option>
                                                                    <option value="Cardinal">Cardinal</option>
                                                                </select>
                                                                {isNotFriday && (
                                                                    <span className="sched-day-warn" title="Not a Friday game">⚠️</span>
                                                                )}
                                                                {isPlayoff && (
                                                                    <span className="sched-playoff-chip">
                                                                        {game.playoffRound?.replace('QUARTERFINAL', 'QF').replace('SEMIFINAL', 'SF').replace('FINAL', 'Final') || 'Playoff'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="sched-game-teams">
                                                                <span className="sched-team-dot" style={{ background: homeColor }} />
                                                                <select
                                                                    className="sched-inline-input sched-team-select"
                                                                    value={game.homeTeamId || ''}
                                                                    onChange={(e) => applyInlineEdit(game, { homeTeamId: e.target.value ? parseInt(e.target.value) : null })}
                                                                >
                                                                    <option value="">TBD</option>
                                                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                </select>
                                                                <span className="sched-vs">vs</span>
                                                                <select
                                                                    className="sched-inline-input sched-team-select"
                                                                    value={game.awayTeamId || ''}
                                                                    onChange={(e) => applyInlineEdit(game, { awayTeamId: e.target.value ? parseInt(e.target.value) : null })}
                                                                >
                                                                    <option value="">TBD</option>
                                                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                </select>
                                                                <span className="sched-team-dot" style={{ background: awayColor }} />
                                                            </div>
                                                            <div className="sched-game-end">
                                                                {isCompleted
                                                                    ? <span className="score">{game.homeScore} - {game.awayScore}</span>
                                                                    : <span className="upcoming-badge">Scheduled</span>}
                                                                <button
                                                                    className="sched-game-remove"
                                                                    title="Remove game"
                                                                    onClick={() => handleDeleteGame(game.id)}
                                                                    disabled={loading}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    ) : (
                        // Mobile: Card View
                        <div className="schedule-grid">
                            {weeks.map(week => (
                                <div key={week} className="week-section">
                                    <h3>Week {week}</h3>
                                    <div className="games-list">
                                        {gamesByWeek[week].map(game => {
                                            const homeTeam = getTeamById(game.homeTeamId);
                                            const awayTeam = getTeamById(game.awayTeamId);
                                            const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                            const dayOfWeek = gameDate.getDay();
                                            const isNotFriday = dayOfWeek !== 5;
                                            const dayName = gameDate.toLocaleDateString('en-US', { weekday: 'long' });

                                            const homeBg = getValidColor(homeTeam?.teamColor);
                                            const awayBg = getValidColor(awayTeam?.teamColor);

                                            return (
                                                <div
                                                    key={game.id}
                                                    className={`game-card clickable ${isNotFriday ? 'non-friday-game' : ''}`}
                                                    onClick={() => setEditingGame(game)}
                                                >
                                                    {isNotFriday && (
                                                        <div className="day-badge">
                                                            ⚠️ {dayName.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="game-time">
                                                        {game.homeTeamId && game.awayTeamId ? (
                                                            <>
                                                                {gameDate.toLocaleDateString()} {' '}
                                                                {gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </>
                                                        ) : (
                                                            <span className="placeholder">Click to set date/time</span>
                                                        )}
                                                    </div>
                                                    <div className="game-teams">
                                                        {game.homeTeamId && game.awayTeamId ? (
                                                            <>
                                                                <span className="team-badge" style={{
                                                                    backgroundColor: homeBg,
                                                                    color: getTextColor(homeBg)
                                                                }}>
                                                                    {homeTeam?.name || `Team ${game.homeTeamId}`}
                                                                </span>
                                                                <span className="vs">vs</span>
                                                                <span className="team-badge" style={{
                                                                    backgroundColor: awayBg,
                                                                    color: getTextColor(awayBg)
                                                                }}>
                                                                    {awayTeam?.name || `Team ${game.awayTeamId}`}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="placeholder">Click to select teams</span>
                                                        )}
                                                    </div>
                                                    <div className="game-rink">{game.rink}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}


                    {/* Add Week Button */}
                    {
                        isActiveSeason && (
                            <button
                                onClick={handleAddWeek}
                                className="btn-add-week"
                                disabled={loading}
                            >
                                ➕ Add Week
                            </button>
                        )
                    }

                    {/* Initialize Playoff Bracket — shown when saved schedule has TBD playoff games */}
                    {isActiveSeason && scheduleMode === 'saved' && games.some(g => g.gameType === 'PLAYOFF' && !g.homeTeamId) && (
                        <button
                            onClick={handleInitializeBracket}
                            className="btn-bracket-init"
                            disabled={loading}
                            title="Seed the playoff bracket based on current regular season standings"
                        >
                            🏆 Initialize Playoff Bracket
                        </button>
                    )}
                </div >
            )}
            </div>{/* /.sched-generated */}
            </div>{/* /.sched-cols */}

            {/* Confirmation Modal */}
            {
                confirmModal.show && (
                    <div className="resume-modal-overlay">
                        <div className="resume-modal-content">
                            <h3>{confirmModal.title}</h3>
                            <p>{confirmModal.message}</p>
                            <div className="resume-modal-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={`btn-primary ${confirmModal.isDestructive ? 'btn-danger' : ''}`}
                                    onClick={() => {
                                        confirmModal.onConfirm();
                                        setConfirmModal({ ...confirmModal, show: false });
                                    }}
                                >
                                    {confirmModal.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Game Edit Modal */}
            {
                editingGame && (
                    <GameEditModal
                        game={editingGame}
                        teams={teams}
                        onClose={() => setEditingGame(null)}
                        onSave={handleSaveGame}
                        onDelete={handleDeleteGame}
                    />
                )
            }
        </div >
    );
};

export default ScheduleManager;
