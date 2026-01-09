import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import GameEditModal from './GameEditModal';
import './ScheduleManager.css';

const API_BASE_URL = '/api/v1';
// TODO: Fix API Gateway multipart proxy and use API_BASE_URL for all requests
const GAME_SERVICE_URL = '/games-api'; // Proxy through Nginx

const ScheduleManager = () => {
    const [seasons, setSeasons] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [maxWeeks, setMaxWeeks] = useState(10);
    const [csvFile, setCsvFile] = useState(null);
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

    // Fetch seasons on mount
    useEffect(() => {
        fetchSeasons();
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
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
                maxWeeks: maxWeeks
            };


            const response = await axios.post(`${API_BASE_URL}/games/generate`, request);

            // Use returned draft games (not saved to database yet)
            setGames(response.data);
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
                gameDate: new Date().toISOString(),
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

    const showMessage = (type, text) => {
        setMessage({ type, text });
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
            <h1>Schedule Manager</h1>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Season Selection */}
            <div className="section">
                <h2>1. Select Season</h2>
                <select
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

            {/* File Upload */}
            {selectedSeason && isActiveSeason && (
                <div className="section">
                    <h2>2. Upload Game Slots (CSV)</h2>
                    <button
                        onClick={downloadTemplate}
                        className="btn-secondary"
                        style={{ marginBottom: '15px' }}
                    >
                        📥 Download Template
                    </button>
                    <div className="upload-area">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={loading}
                        />
                        {csvFile && <span className="file-name">{csvFile.name}</span>}
                    </div>
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
                <div className="section">
                    <h2>3. Generate Schedule</h2>
                    <div className="generate-form">
                        <label>
                            Max Weeks (Regular Season):
                            <input
                                type="number"
                                value={maxWeeks}
                                onChange={(e) => setMaxWeeks(parseInt(e.target.value))}
                                min="1"
                                max="20"
                            />
                        </label>
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

            {/* Schedule Display */}
            {selectedSeason && games.length > 0 && (
                <div className="section">
                    <h2>
                        {scheduleMode === 'draft' && '📝 Draft Schedule'}
                        {scheduleMode === 'saved' && '✅ Season Schedule'}
                        {scheduleMode === 'editing' && '✏️ Season Schedule (Editing)'}
                        {scheduleMode === 'none' && 'Generated Schedule'}
                        {' '}({games.length} games)
                    </h2>

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

                    <div className="schedule-grid">
                        {weeks.map(week => (
                            <div key={week} className="week-section">
                                <h3>Week {week}</h3>
                                <div className="games-list">
                                    {gamesByWeek[week].map(game => {
                                        const homeTeam = getTeamById(game.homeTeamId);
                                        const awayTeam = getTeamById(game.awayTeamId);
                                        const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                        const dayOfWeek = gameDate.getDay(); // 0=Sunday, 5=Friday
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
                </div >
            )}

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
