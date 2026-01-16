import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import './LiveScoreEntry.css';

function LiveScoreEntry(props) {
    const { game: propGame, onBack, onGameUpdated } = props;
    const { gameId } = useParams();
    const navigate = useNavigate();

    // State for game data (loaded from prop or route param)
    const [game, setGame] = useState(propGame || null);
    const [loading, setLoading] = useState(!propGame);

    const [homeScore, setHomeScore] = useState(game?.homeScore || 0);
    const [awayScore, setAwayScore] = useState(game?.awayScore || 0);
    const [events, setEvents] = useState([]);
    const [players, setPlayers] = useState([]);
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [showPenaltyForm, setShowPenaltyForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [gameFinalized, setGameFinalized] = useState(game?.status === 'completed');

    // Goal form state
    const [goalTeam, setGoalTeam] = useState('home');
    const [goalScorer, setGoalScorer] = useState('');
    const [goalAssist1, setGoalAssist1] = useState('');
    const [goalAssist2, setGoalAssist2] = useState('');
    const [goalPeriod, setGoalPeriod] = useState('1');
    const [goalMinutes, setGoalMinutes] = useState('');
    const [goalSeconds, setGoalSeconds] = useState('');
    const [goalLimitWarning, setGoalLimitWarning] = useState(null);

    // Penalty form state
    const [penaltyTeam, setPenaltyTeam] = useState('home');
    const [penaltyPlayer, setPenaltyPlayer] = useState('');
    const [penaltyMinutes, setPenaltyMinutes] = useState(2);
    const [penaltyDescription, setPenaltyDescription] = useState('');
    const [penaltyPeriod, setPenaltyPeriod] = useState('1');
    const [penaltyTimeMinutes, setPenaltyTimeMinutes] = useState('');
    const [penaltyTimeSeconds, setPenaltyTimeSeconds] = useState('');

    // Finalize confirmation modal
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    // Penalty validation and alerts
    const [showPenaltyAlert, setShowPenaltyAlert] = useState(false);
    const [penaltyAlertData, setPenaltyAlertData] = useState(null);
    const [ejectedPlayers, setEjectedPlayers] = useState([]);

    // OT tracking for tied games
    const [endedInOT, setEndedInOT] = useState(false);

    // Load game from route parameter if not passed as prop
    useEffect(() => {
        const loadGame = async () => {
            if (!propGame && gameId) {
                try {
                    setLoading(true);
                    // Load game and teams in parallel
                    const [gameData, teamsData] = await Promise.all([
                        api.getGame(gameId),
                        api.getTeams()
                    ]);

                    // Enrich game with team names and colors
                    const homeTeam = teamsData.find(t => t.id === gameData.homeTeamId);
                    const awayTeam = teamsData.find(t => t.id === gameData.awayTeamId);

                    const enrichedGame = {
                        ...gameData,
                        homeTeamName: homeTeam?.name || `Team ${gameData.homeTeamId}`,
                        awayTeamName: awayTeam?.name || `Team ${gameData.awayTeamId}`,
                        homeTeamColor: homeTeam?.teamColor || '#6b7280',
                        awayTeamColor: awayTeam?.teamColor || '#6b7280'
                    };

                    setGame(enrichedGame);
                    setHomeScore(enrichedGame.homeScore || 0);
                    setAwayScore(enrichedGame.awayScore || 0);
                    setGameFinalized(enrichedGame.status === 'completed');
                } catch (error) {
                    console.error('Error loading game:', error);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadGame();
    }, [propGame, gameId]);

    useEffect(() => {
        if (game) {
            loadPlayers();
            loadEvents();
        }
    }, [game]);

    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';
        // List of light colors that need dark text
        const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue', 'Lt Blu'];
        const isLight = lightColors.some(c => bgColor.toLowerCase().includes(c.toLowerCase()));
        return isLight ? '#2c3e50' : 'white';
    };

    const loadPlayers = async () => {
        try {
            // Fetch players for both teams in the game
            const [homePlayers, awayPlayers] = await Promise.all([
                api.getPlayers({ teamId: game.homeTeamId }),
                api.getPlayers({ teamId: game.awayTeamId })
            ]);

            // Add goalsInGame tracking and full name for each player
            const allPlayers = [...homePlayers, ...awayPlayers].map(player => ({
                ...player,
                name: `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown',
                goalsInGame: 0 // Initialize goal count for this game
            }));

            setPlayers(allPlayers);
        } catch (error) {
            console.error('Error loading players:', error);
            setPlayers([]);
        }
    };

    const loadEvents = async () => {
        // TODO: Load events from backend
        // For now, events are stored in state
    };

    const getTeamPlayers = (team) => {
        const teamId = team === 'home' ? game.homeTeamId : game.awayTeamId;
        return players.filter(p => Number(p.teamId) === Number(teamId));
    };

    const checkGoalLimit = (playerId) => {
        const player = players.find(p => p.id === parseInt(playerId));
        if (!player) return null;

        const goalLimit = player.skillRating >= 9 ? 2 : 3;
        const goalsScored = player.goalsInGame;
        const scoreDiff = Math.abs(homeScore - awayScore);
        const isMercyRule = scoreDiff >= 4;
        const losingTeam = homeScore < awayScore ? 'home' : 'away';
        const mercyRuleActive = isMercyRule && goalTeam === losingTeam;

        if (mercyRuleActive) {
            return {
                allowed: true,
                message: '✅ Mercy Rule Active - No goal limits',
                type: 'success'
            };
        }

        if (goalsScored >= goalLimit) {
            return {
                allowed: false,
                message: `❌ Player has reached goal limit (${goalsScored}/${goalLimit} goals)`,
                type: 'error'
            };
        }

        if (goalsScored === goalLimit - 1) {
            return {
                allowed: true,
                message: `⚠️ Warning: This is player's final goal (${goalsScored + 1}/${goalLimit})`,
                type: 'warning'
            };
        }

        return {
            allowed: true,
            message: `✅ Goal allowed (${goalsScored + 1}/${goalLimit} goals)`,
            type: 'success'
        };
    };

    const handleGoalScorerChange = (playerId) => {
        setGoalScorer(playerId);
        if (playerId) {
            const validation = checkGoalLimit(playerId);
            setGoalLimitWarning(validation);
        } else {
            setGoalLimitWarning(null);
        }
    };

    const formatTime = (minutes, seconds) => {
        const m = minutes || '0';
        const s = (seconds || '0').padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleAddGoal = async (e) => {
        e.preventDefault();

        if (goalLimitWarning && !goalLimitWarning.allowed) {
            alert('Cannot add goal - player has reached goal limit!');
            return;
        }

        const scorer = players.find(p => p.id === parseInt(goalScorer));
        const assist1 = goalAssist1 ? players.find(p => p.id === parseInt(goalAssist1)) : null;
        const assist2 = goalAssist2 ? players.find(p => p.id === parseInt(goalAssist2)) : null;

        const newEvent = {
            id: editingEvent ? editingEvent.id : Date.now(),
            type: 'goal',
            team: goalTeam,
            period: goalPeriod,
            time: formatTime(goalMinutes, goalSeconds),
            scorer: scorer.name,
            scorerId: scorer.id,
            assists: [assist1?.name, assist2?.name].filter(Boolean),
            assist1Id: assist1?.id || null,
            assist2Id: assist2?.id || null
        };

        if (editingEvent) {
            // Update existing event
            const updatedEvents = events.map(e => e.id === editingEvent.id ? newEvent : e);
            setEvents(updatedEvents);

            // Recalculate scores from all goal events
            const homeGoals = updatedEvents.filter(e => e.type === 'goal' && e.team === 'home').length;
            const awayGoals = updatedEvents.filter(e => e.type === 'goal' && e.team === 'away').length;
            setHomeScore(homeGoals);
            setAwayScore(awayGoals);

            setEditingEvent(null);
        } else {
            // Add new event
            setEvents([...events, newEvent]);

            // Update score
            if (goalTeam === 'home') {
                setHomeScore(homeScore + 1);
            } else {
                setAwayScore(awayScore + 1);
            }

            // Update player goal count
            const updatedPlayers = players.map(p =>
                p.id === scorer.id ? { ...p, goalsInGame: p.goalsInGame + 1 } : p
            );
            setPlayers(updatedPlayers);

            // Auto-save event to backend
            await saveEventToBackend(newEvent);
        }

        resetGoalForm();
    };

    const handleAddPenalty = async (e) => {
        e.preventDefault();

        const player = players.find(p => p.id === parseInt(penaltyPlayer));

        // Check if player is ejected
        if (ejectedPlayers.includes(player.id)) {
            alert('This player has been ejected and cannot receive more penalties.');
            return;
        }

        // Validate penalty for ejection/suspension
        try {
            const validation = await api.validatePenalty(player.id, game.id);

            // If ejection or suspension, show alert modal
            if (validation.shouldEject) {
                setPenaltyAlertData({
                    player: player.name,
                    ...validation
                });
                setShowPenaltyAlert(true);

                // Mark player as ejected
                setEjectedPlayers([...ejectedPlayers, player.id]);

                // Wait for user to acknowledge before continuing
                // The penalty will still be added after acknowledgment
            }
        } catch (error) {
            console.error('Error validating penalty:', error);
        }

        const newEvent = {
            id: editingEvent ? editingEvent.id : Date.now(),
            type: 'penalty',
            team: penaltyTeam,
            period: penaltyPeriod,
            time: formatTime(penaltyTimeMinutes, penaltyTimeSeconds),
            player: player.name,
            playerId: player.id,
            minutes: penaltyMinutes,
            description: penaltyDescription
        };

        if (editingEvent) {
            const updatedEvents = events.map(e => e.id === editingEvent.id ? newEvent : e);
            setEvents(updatedEvents);
            setEditingEvent(null);
        } else {
            setEvents([...events, newEvent]);
            // Auto-save event to backend
            await saveEventToBackend(newEvent);
        }

        resetPenaltyForm();
    };

    const saveEventToBackend = async (event) => {
        try {
            // Construct DTO matching backend GameEventDto.Create requirements
            const [minutes, seconds] = event.time.split(':').map(Number);
            const periodMap = { '1': 1, '2': 2, '3': 3, 'OT': 4 };

            const eventDto = {
                gameId: game.id,
                teamId: event.team === 'home' ? game.homeTeamId : game.awayTeamId,
                eventType: event.type,
                period: periodMap[event.period] || 3, // Default to 3 if unknown, or handle error
                timeMinutes: minutes,
                timeSeconds: seconds,
                description: event.description || null,
                // Map fields based on event type
                playerId: event.type === 'goal' ? event.scorerId : event.playerId,
                assist1PlayerId: event.type === 'goal' ? event.assist1Id : null,
                assist2PlayerId: event.type === 'goal' ? event.assist2Id : null,
                penaltyMinutes: event.type === 'penalty' ? event.minutes : null
            };

            await api.saveGameEvent(game.id, eventDto);
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event to backend. It will remain locally until page refresh.');
            // Note: We don't remove it from local state so user doesn't lose data
            // In a real app we might mark it as "unsaved" in UI
        }
    };

    const handleEditEvent = (event) => {
        if (gameFinalized) {
            alert('Game is finalized. Cannot edit events.');
            return;
        }

        setEditingEvent(event);

        if (event.type === 'goal') {
            setGoalTeam(event.team);
            setGoalPeriod(event.period);
            const [mins, secs] = event.time.split(':');
            setGoalMinutes(mins);
            setGoalSeconds(secs);
            // Restore player IDs
            setGoalScorer(event.scorerId?.toString() || '');
            setGoalAssist1(event.assist1Id?.toString() || '');
            setGoalAssist2(event.assist2Id?.toString() || '');
            // Check goal limit for the scorer
            if (event.scorerId) {
                const validation = checkGoalLimit(event.scorerId);
                setGoalLimitWarning(validation);
            }
            setShowGoalForm(true);
        } else {
            setPenaltyTeam(event.team);
            setPenaltyPeriod(event.period);
            const [mins, secs] = event.time.split(':');
            setPenaltyTimeMinutes(mins);
            setPenaltyTimeSeconds(secs);
            // Restore player ID
            setPenaltyPlayer(event.playerId?.toString() || '');
            setPenaltyMinutes(event.minutes);
            setPenaltyDescription(event.description || '');
            setShowPenaltyForm(true);
        }
    };

    const handleFinalizeGame = () => {
        // Check if there are any OT goals in the events
        const hasOTGoal = events.some(event => event.type === 'goal' && event.period === 'OT');

        // If there's an OT goal, automatically set endedInOT to true
        if (hasOTGoal) {
            setEndedInOT(true);
        } else if (homeScore === awayScore) {
            // For tied games without OT goals, default to regulation
            setEndedInOT(false);
        }

        setShowFinalizeModal(true);
    };

    const confirmFinalize = async () => {
        setShowFinalizeModal(false);

        try {
            // Save final score to backend with OT flag
            await api.finalizeGame(game.id, homeScore, awayScore, endedInOT);
            setGameFinalized(true);
            setShowSuccessMessage(true);

            // Update parent component with finalized game data
            if (onGameUpdated) {
                onGameUpdated({
                    ...game,
                    homeScore,
                    awayScore,
                    endedInOT,
                    status: 'completed'
                });
            }

            // Hide success message after 3 seconds
            setTimeout(() => {
                setShowSuccessMessage(false);
            }, 3000);
        } catch (error) {
            console.error('Error finalizing game:', error);
            alert('❌ ERROR\n\nFailed to finalize game. Please try again.\n\nError: ' + error.message);
        }
    };

    const cancelFinalize = () => {
        setShowFinalizeModal(false);
    };

    const resetGoalForm = () => {
        setGoalScorer('');
        setGoalAssist1('');
        setGoalAssist2('');
        setGoalPeriod('1');
        setGoalMinutes('');
        setGoalSeconds('');
        setGoalLimitWarning(null);
        setShowGoalForm(false);
    };

    const resetPenaltyForm = () => {
        setPenaltyPlayer('');
        setPenaltyMinutes(2);
        setPenaltyDescription('');
        setPenaltyPeriod('1');
        setPenaltyTimeMinutes('');
        setPenaltyTimeSeconds('');
        setShowPenaltyForm(false);
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            // Navigate back to scorekeeper dashboard
            navigate('/scorekeeper');
        }
    };

    if (loading) {
        return (
            <div className="live-score-entry">
                <div className="info-message">Loading game...</div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="live-score-entry">
                <div className="info-message">Select a game from the schedule</div>
            </div>
        );
    }

    return (
        <div className="live-score-entry">
            <div className="entry-header">
                <button className="btn-back" onClick={handleBack}>← Back to Schedule</button>
                <h2>Live Score Entry</h2>
                {gameFinalized && <span className="finalized-badge">✓ Finalized</span>}
            </div>

            {/* Scoreboard */}
            <div className="scoreboard">
                <div className="team-score">
                    <div className="team-name" style={{
                        backgroundColor: game.homeTeamColor,
                        color: getTextColor(game.homeTeamColor)
                    }}>
                        <span className="home-away-label">HOME</span>
                        {game.homeTeamName}
                    </div>
                    <div className="score">{homeScore}</div>
                </div>
                <div className="vs">VS</div>
                <div className="team-score">
                    <div className="team-name" style={{
                        backgroundColor: game.awayTeamColor,
                        color: getTextColor(game.awayTeamColor)
                    }}>
                        <span className="home-away-label">AWAY</span>
                        {game.awayTeamName}
                    </div>
                    <div className="score">{awayScore}</div>
                </div>
            </div>

            {/* Mercy Rule Indicator */}
            {Math.abs(homeScore - awayScore) >= 4 && !gameFinalized && (
                <div className="mercy-rule-alert">
                    🏒 Mercy Rule Active - Goal limits removed for {homeScore < awayScore ? game.homeTeamName : game.awayTeamName}
                </div>
            )}

            {/* Action Buttons */}
            {!gameFinalized && (
                <div className="action-buttons">
                    <button className="btn-action" onClick={() => setShowGoalForm(!showGoalForm)}>
                        🏒 Add Goal
                    </button>
                    <button className="btn-action" onClick={() => setShowPenaltyForm(!showPenaltyForm)}>
                        🚫 Add Penalty
                    </button>
                    <button className="btn-finalize" onClick={handleFinalizeGame}>
                        ✓ Finalize Score
                    </button>
                </div>
            )}

            {gameFinalized && (
                <div className="finalized-message">
                    This game has been finalized. Score entry is locked.
                </div>
            )}

            {/* Goal Entry Form */}
            {showGoalForm && !gameFinalized && (
                <form onSubmit={handleAddGoal} className="event-form">
                    <h3>{editingEvent ? 'Edit Goal' : 'Record Goal'}</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Period *</label>
                            <select value={goalPeriod} onChange={(e) => setGoalPeriod(e.target.value)} required>
                                <option value="1">Period 1</option>
                                <option value="2">Period 2</option>
                                <option value="3">Period 3</option>
                                <option value="OT">Overtime</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Time * (MM:SS)</label>
                            <div className="time-input">
                                <input
                                    list="minutes-list"
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={goalMinutes}
                                    onChange={(e) => setGoalMinutes(e.target.value)}
                                    placeholder="MM"
                                    required
                                />
                                <datalist id="minutes-list">
                                    {[...Array(21)].map((_, i) => (
                                        <option key={i} value={i} />
                                    ))}
                                </datalist>
                                <span>:</span>
                                <input
                                    list="seconds-list"
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={goalSeconds}
                                    onChange={(e) => setGoalSeconds(e.target.value)}
                                    placeholder="SS"
                                    required
                                />
                                <datalist id="seconds-list">
                                    {[...Array(60)].map((_, i) => (
                                        <option key={i} value={i} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Team</label>
                        <select value={goalTeam} onChange={(e) => setGoalTeam(e.target.value)} required>
                            <option value="home">{game.homeTeamName}</option>
                            <option value="away">{game.awayTeamName}</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Goal Scorer *</label>
                        <select
                            value={goalScorer}
                            onChange={(e) => handleGoalScorerChange(e.target.value)}
                            required
                        >
                            <option value="">Select player...</option>
                            {getTeamPlayers(goalTeam).map(player => (
                                <option key={player.id} value={player.id}>
                                    #{player.jerseyNumber || '??'} - {player.name} (Skill: {player.skillRating}, Goals: {player.goalsInGame})
                                </option>
                            ))}
                        </select>
                    </div>

                    {goalLimitWarning && (
                        <div className={`goal-limit-alert alert-${goalLimitWarning.type}`}>
                            {goalLimitWarning.message}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Assist 1 (optional)</label>
                        <select value={goalAssist1} onChange={(e) => setGoalAssist1(e.target.value)}>
                            <option value="">None</option>
                            {getTeamPlayers(goalTeam).filter(p => p.id !== parseInt(goalScorer)).map(player => (
                                <option key={player.id} value={player.id}>#{player.jerseyNumber || '??'} - {player.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Assist 2 (optional)</label>
                        <select value={goalAssist2} onChange={(e) => setGoalAssist2(e.target.value)}>
                            <option value="">None</option>
                            {getTeamPlayers(goalTeam)
                                .filter(p => p.id !== parseInt(goalScorer) && p.id !== parseInt(goalAssist1))
                                .map(player => (
                                    <option key={player.id} value={player.id}>#{player.jerseyNumber || '??'} - {player.name}</option>
                                ))}
                        </select>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-submit" disabled={goalLimitWarning && !goalLimitWarning.allowed}>
                            {editingEvent ? 'Update Goal' : 'Add Goal'}
                        </button>
                        <button type="button" className="btn-cancel" onClick={resetGoalForm}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Penalty Entry Form */}
            {showPenaltyForm && !gameFinalized && (
                <form onSubmit={handleAddPenalty} className="event-form">
                    <h3>{editingEvent ? 'Edit Penalty' : 'Record Penalty'}</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Period *</label>
                            <select value={penaltyPeriod} onChange={(e) => setPenaltyPeriod(e.target.value)} required>
                                <option value="1">Period 1</option>
                                <option value="2">Period 2</option>
                                <option value="3">Period 3</option>
                                <option value="OT">Overtime</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Time * (MM:SS)</label>
                            <div className="time-input">
                                <input
                                    list="penalty-minutes-list"
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={penaltyTimeMinutes}
                                    onChange={(e) => setPenaltyTimeMinutes(e.target.value)}
                                    placeholder="MM"
                                    required
                                />
                                <datalist id="penalty-minutes-list">
                                    {[...Array(21)].map((_, i) => (
                                        <option key={i} value={i} />
                                    ))}
                                </datalist>
                                <span>:</span>
                                <input
                                    list="penalty-seconds-list"
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={penaltyTimeSeconds}
                                    onChange={(e) => setPenaltyTimeSeconds(e.target.value)}
                                    placeholder="SS"
                                    required
                                />
                                <datalist id="penalty-seconds-list">
                                    {[...Array(60)].map((_, i) => (
                                        <option key={i} value={i} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Team</label>
                        <select value={penaltyTeam} onChange={(e) => setPenaltyTeam(e.target.value)} required>
                            <option value="home">{game.homeTeamName}</option>
                            <option value="away">{game.awayTeamName}</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Player *</label>
                        <select value={penaltyPlayer} onChange={(e) => setPenaltyPlayer(e.target.value)} required>
                            <option value="">Select player...</option>
                            {getTeamPlayers(penaltyTeam).map(player => (
                                <option key={player.id} value={player.id}>#{player.jerseyNumber || '??'} - {player.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Penalty Minutes *</label>
                        <select value={penaltyMinutes} onChange={(e) => setPenaltyMinutes(parseInt(e.target.value))} required>
                            <option value={2}>2 minutes</option>
                            <option value={3}>3 minutes</option>
                            <option value={4}>4 minutes</option>
                            <option value={6}>6 minutes</option>
                            <option value={10}>10 minutes</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Description (optional)</label>
                        <input
                            type="text"
                            value={penaltyDescription}
                            onChange={(e) => setPenaltyDescription(e.target.value)}
                            placeholder="e.g., Tripping, High-sticking..."
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-submit">
                            {editingEvent ? 'Update Penalty' : 'Add Penalty'}
                        </button>
                        <button type="button" className="btn-cancel" onClick={resetPenaltyForm}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Game Log */}
            <div className="event-log">
                <h3>Game Log ({events.length} events)</h3>
                {events.length === 0 ? (
                    <div className="no-events">No events recorded yet</div>
                ) : (
                    <div className="events-table-container">
                        <table className="events-table">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Time</th>
                                    <th>Type</th>
                                    <th>Details</th>
                                    <th>Team</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.slice().sort((a, b) => {
                                    // Sort by period (1, 2, 3, OT)
                                    const periodOrder = { '1': 1, '2': 2, '3': 3, 'OT': 4 };
                                    const periodA = periodOrder[a.period] || 999;
                                    const periodB = periodOrder[b.period] || 999;
                                    if (periodA !== periodB) return periodB - periodA;

                                    // Then sort by time (ascending - lower time = more recent in hockey)
                                    const [minA, secA] = a.time.split(':').map(Number);
                                    const [minB, secB] = b.time.split(':').map(Number);
                                    const timeA = minA * 60 + secA;
                                    const timeB = minB * 60 + secB;
                                    return timeA - timeB; // Lower time first (more recent)
                                }).map(event => (
                                    <tr
                                        key={event.id}
                                        className={`event-row event-${event.type} ${!gameFinalized ? 'editable' : ''}`}
                                        onClick={() => !gameFinalized && handleEditEvent(event)}
                                    >
                                        <td className="period-col">{event.period}</td>
                                        <td className="time-col">{event.time}</td>
                                        <td className="type-col">
                                            {event.type === 'goal' ? (
                                                <span className="event-badge goal-badge">🏒 Goal</span>
                                            ) : (
                                                <span className="event-badge penalty-badge">🚫 Penalty</span>
                                            )}
                                        </td>
                                        <td className="details-col">
                                            {event.type === 'goal' ? (
                                                <>
                                                    <strong>{event.scorer}</strong>
                                                    {event.assists.length > 0 && (
                                                        <span className="assists"> (A: {event.assists.join(', ')})</span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <strong>{event.player}</strong> ({event.minutes} min)
                                                    {event.description && <span> - {event.description}</span>}
                                                </>
                                            )}
                                        </td>
                                        <td className="team-col">{event.team === 'home' ? game.homeTeamName : game.awayTeamName}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!gameFinalized && <div className="edit-hint-table">Click any row to edit</div>}
                    </div>
                )}
            </div>

            {/* Finalize Confirmation Modal */}
            {showFinalizeModal && (
                <div className="modal-overlay" onClick={cancelFinalize}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>⚠️ Finalize Game</h3>
                        <div className="modal-body">
                            <div className="final-score">
                                <strong>Final Score:</strong>
                                <div className="score-display-large">
                                    {game.homeTeamName} <span className="score-num">{homeScore}</span> - <span className="score-num">{awayScore}</span> {game.awayTeamName}
                                </div>
                            </div>

                            {/* OT Selection - show for tied games or when OT goal detected */}
                            {(homeScore === awayScore || events.some(e => e.type === 'goal' && e.period === 'OT')) && (
                                <div className="ot-selection">
                                    {events.some(e => e.type === 'goal' && e.period === 'OT') ? (
                                        <p><strong>✓ OT goal detected - Game ended in overtime</strong></p>
                                    ) : (
                                        <>
                                            <p><strong>Game ended in a tie. Did it go to overtime?</strong></p>
                                            <div className="ot-options">
                                                <label className="ot-option">
                                                    <input
                                                        type="radio"
                                                        name="ot"
                                                        value="regulation"
                                                        checked={!endedInOT}
                                                        onChange={() => setEndedInOT(false)}
                                                    />
                                                    <span>Ended in Regulation</span>
                                                </label>
                                                <label className="ot-option">
                                                    <input
                                                        type="radio"
                                                        name="ot"
                                                        value="overtime"
                                                        checked={endedInOT}
                                                        onChange={() => setEndedInOT(true)}
                                                    />
                                                    <span>Ended in Overtime</span>
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="warning-list">
                                <p><strong>This will:</strong></p>
                                <ul>
                                    <li>Lock the game and prevent any further edits</li>
                                    <li>Save the final score to the database</li>
                                    <li>Mark the game as completed</li>
                                </ul>
                            </div>
                            <p className="confirm-question">Are you sure you want to finalize this game?</p>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-confirm" onClick={confirmFinalize}>
                                Yes, Finalize Game
                            </button>
                            <button className="btn-cancel-modal" onClick={cancelFinalize}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Message */}
            {showSuccessMessage && (
                <div className="success-toast">
                    <div className="success-icon">✅</div>
                    <div className="success-text">
                        <strong>Game Finalized!</strong>
                        <p>The score has been saved and locked.</p>
                    </div>
                </div>
            )}

            {/* Penalty Alert Modal */}
            {showPenaltyAlert && penaltyAlertData && (
                <div className="modal-overlay" onClick={() => setShowPenaltyAlert(false)}>
                    <div className="modal-content penalty-alert-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>
                            {penaltyAlertData.warningType === 'EJECTION_AND_SUSPENSION' ? '🚨 EJECTION + SUSPENSION' : '⚠️ EJECTION'}
                        </h3>
                        <div className="modal-body">
                            <div className="penalty-alert-player">
                                <strong>Player:</strong> {penaltyAlertData.player}
                            </div>
                            <div className="penalty-alert-message">
                                {penaltyAlertData.warningMessage}
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-confirm" onClick={() => setShowPenaltyAlert(false)}>
                                Acknowledged
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LiveScoreEntry;
