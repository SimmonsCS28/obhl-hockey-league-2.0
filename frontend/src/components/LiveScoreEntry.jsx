import { useCallback, useEffect, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './LiveScoreEntry.css';

const PENALTY_TYPES = [
    "Boarding", "Body Check", "Broken Stick", "Butt-ending", "Charging",
    "Check from Behind", "Cross-checking", "Delay of Game", "Elbowing",
    "Equipment Violation", "Face-off Interference", "Fighting", "Game Misconduct",
    "Goaltender Interference", "Grabbing Facemask", "Head Contact", "Head-butting",
    "High-sticking", "Holding", "Hooking", "Illegal Stick", "Instigator",
    "Interference", "Kicking", "Kneeing", "Leaving Bench", "Leaving Penalty Bench",
    "Match Penalty", "Misconduct", "Roughing", "Slashing", "Slew Footing",
    "Spearing", "Throwing Stick", "Tripping", "Unnecessary Roughness",
    "Unsportsmanlike Conduct"
];

function LiveScoreEntry(props) {
    const {
        game: propGame,
        onBack,
        onGameUpdated,
        onDirtyChange,
        hasPendingNavigation,
        onNavigate,
        onNavigateCancel,
        embedded = false
    } = props;
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Check if user is admin for editable scores
    // Check if user is admin or scorekeeper for editable scores
    const isAdmin = user?.role === 'ADMIN' ||
        user?.roles?.some(r => ['admin', 'scorekeeper'].includes(r.toLowerCase()));

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

    // Global period stepper — 1 / 2 / 3 / OT — sets the period for new goals & penalties.
    const [currentPeriod, setCurrentPeriod] = useState('1');

    // Goal modal state (two steps: 'scorer' → 'assist')
    const [goalTeam, setGoalTeam] = useState('home');
    const [goalStep, setGoalStep] = useState('scorer');
    const [goalScorer, setGoalScorer] = useState('');
    const [goalAssist1, setGoalAssist1] = useState('');
    const [goalAssist2, setGoalAssist2] = useState('');
    const [goalClock, setGoalClock] = useState('');
    const [goalTimeError, setGoalTimeError] = useState('');
    const [goalBlockMsg, setGoalBlockMsg] = useState('');
    const [goalLimitWarning, setGoalLimitWarning] = useState(null);

    // Penalty modal state
    const [penaltyTeam, setPenaltyTeam] = useState('home');
    const [penaltyPlayer, setPenaltyPlayer] = useState('');
    const [penaltyMinutes, setPenaltyMinutes] = useState(2);
    const [penaltyDescription, setPenaltyDescription] = useState('');
    const [penaltyOtherDescription, setPenaltyOtherDescription] = useState('');
    const [penaltyClock, setPenaltyClock] = useState('');
    const [penaltyTimeError, setPenaltyTimeError] = useState('');

    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    // Unfinalize tracking
    const [showUnfinalizeModal, setShowUnfinalizeModal] = useState(false);
    const [isUnfinalizing, setIsUnfinalizing] = useState(false);

    // Penalty validation and alerts
    const [showPenaltyAlert, setShowPenaltyAlert] = useState(false);
    const [penaltyAlertData, setPenaltyAlertData] = useState(null);
    const [ejectedPlayers, setEjectedPlayers] = useState([]);

    // OT tracking for tied games
    const [endedInOT, setEndedInOT] = useState(false);

    // Forfeit tracking — id of the team that forfeited, or null if no forfeit
    const [forfeitTeamId, setForfeitTeamId] = useState(game?.forfeitTeamId || null);

    // Unsaved changes tracking
    const [isDirty, setIsDirty] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    // Block navigation if dirty
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            isDirty && !gameFinalized
    );

    useEffect(() => {
        if (blocker.state === "blocked") {
            setShowUnsavedModal(true);
        }
    }, [blocker.state]);

    // Sync dirty state to parent
    useEffect(() => {
        if (onDirtyChange) {
            onDirtyChange(isDirty && !gameFinalized);
        }
    }, [isDirty, gameFinalized, onDirtyChange]);

    // React to parent navigation request
    useEffect(() => {
        if (hasPendingNavigation && isDirty) {
            setShowUnsavedModal(true);
        }
    }, [hasPendingNavigation, isDirty]);

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
                    setForfeitTeamId(enrichedGame.forfeitTeamId || null);
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

    // Resolve player names in loaded events and update goal counts
    useEffect(() => {
        if (players.length > 0 && events.length > 0) {
            // Check if any events need player name resolution (from backend load)
            const needsResolution = events.some(e => e.backendId && !e.player);
            if (needsResolution) {
                const resolvedEvents = events.map(event => {
                    if (!event.backendId || event.player) return event;

                    const player = players.find(p => Number(p.id) === Number(event.playerId));
                    const assist1 = event.assist1PlayerId
                        ? players.find(p => Number(p.id) === Number(event.assist1PlayerId))
                        : null;
                    const assist2 = event.assist2PlayerId
                        ? players.find(p => Number(p.id) === Number(event.assist2PlayerId))
                        : null;

                    const playerName = player ? formatPlayerLabel(player) : event.description || 'Unknown';
                    const assist1Name = formatPlayerLabel(assist1);
                    const assist2Name = formatPlayerLabel(assist2);

                    const assists = [assist1Name, assist2Name].filter(Boolean);

                    return {
                        ...event,
                        player: playerName,
                        scorer: playerName,
                        assists: assists,
                        minutes: event.penaltyMinutes,
                        assist1: assist1Name, // Keep backward compat if needed
                        assist2: assist2Name
                    };
                });
                setEvents(resolvedEvents);

                // Update goalsInGame counts from loaded events
                const goalCounts = {};
                resolvedEvents.filter(e => e.type === 'goal').forEach(event => {
                    if (event.playerId) {
                        goalCounts[event.playerId] = (goalCounts[event.playerId] || 0) + 1;
                    }
                });

                if (Object.keys(goalCounts).length > 0) {
                    setPlayers(prevPlayers => prevPlayers.map(p => ({
                        ...p,
                        goalsInGame: goalCounts[p.id] || 0
                    })));
                }
            }
        }
    }, [players, events]);

    // Warn on browser close/refresh if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty && !gameFinalized) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, gameFinalized]);

    // Shared so freshly-added events and events reloaded from the backend render identically
    const formatPlayerLabel = (player) => {
        if (!player) return '';
        return player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name;
    };

    const loadPlayers = async () => {
        try {
            // Fetch players for both teams in the game
            const [homePlayers, awayPlayers] = await Promise.all([
                api.getPlayers({ teamId: game.homeTeamId, seasonId: game.seasonId }),
                api.getPlayers({ teamId: game.awayTeamId, seasonId: game.seasonId })
            ]);

            const mappedHome = homePlayers.map(p => ({ ...p, teamId: game.homeTeamId }));
            const mappedAway = awayPlayers.map(p => ({ ...p, teamId: game.awayTeamId }));

            // Add goalsInGame tracking and full name for each player
            const allPlayers = [...mappedHome, ...mappedAway].map(player => ({
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
        try {
            const backendEvents = await api.getGameEvents(game.id);
            if (backendEvents && backendEvents.length > 0) {
                // Map backend events back to the frontend format
                const mappedEvents = backendEvents.map((be) => {
                    const isHome = Number(be.teamId) === Number(game.homeTeamId);
                    const teamSide = isHome ? 'home' : 'away';

                    const periodMap = { 1: '1', 2: '2', 3: '3', 4: 'OT', 5: 'SO' };
                    const timeStr = `${String(be.timeMinutes || 0).padStart(2, '0')}:${String(be.timeSeconds || 0).padStart(2, '0')}`;

                    return {
                        id: be.id,
                        backendId: be.id,
                        type: be.eventType,
                        period: periodMap[be.period] || String(be.period),
                        time: timeStr,
                        team: teamSide,
                        teamName: isHome ? game.homeTeamName : game.awayTeamName,
                        playerId: be.playerId,
                        player: '', // For penalty/goal (raw name if needed)
                        scorer: '', // For goal
                        assists: [], // For goal (Must be array)
                        minutes: be.penaltyMinutes, // For penalty
                        assist1PlayerId: be.assist1PlayerId,
                        assist2PlayerId: be.assist2PlayerId,
                        description: be.description,
                        penaltyMinutes: be.penaltyMinutes
                    };
                });

                setEvents(mappedEvents);

                // Recalculate scores from events to ensure consistency
                const homeGoals = mappedEvents.filter(e => e.type === 'goal' && e.team === 'home').length;
                const awayGoals = mappedEvents.filter(e => e.type === 'goal' && e.team === 'away').length;

                // Update score state
                setHomeScore(homeGoals);
                setAwayScore(awayGoals);
            }
        } catch (error) {
            console.error('Error loading events:', error);
        }
    };

    const getTeamPlayers = (team) => {
        const teamId = team === 'home' ? game.homeTeamId : game.awayTeamId;
        return players
            .filter(p => Number(p.teamId) === Number(teamId))
            .sort((a, b) => {
                // Sort numerically by jersey number
                const jerseyA = parseInt(a.jerseyNumber) || 999;
                const jerseyB = parseInt(b.jerseyNumber) || 999;
                return jerseyA - jerseyB;
            });
    };

    const checkGoalLimit = (playerId) => {
        const player = players.find(p => p.id === parseInt(playerId));
        if (!player) return null;

        const goalLimit = player.skillRating >= 9 ? 2 : 3;
        const goalsScored = player.goalsInGame;
        // Free-goal exception: a team trailing by 3+ has its skill caps lifted
        // ("Limits Suspended") until it climbs back within 2.
        const ownScore = goalTeam === 'home' ? homeScore : awayScore;
        const oppScore = goalTeam === 'home' ? awayScore : homeScore;
        const deficit = oppScore - ownScore;
        const limitsSuspended = deficit >= 3;

        if (limitsSuspended) {
            return {
                allowed: true,
                message: `✅ Limits Suspended — team trails by ${deficit}, goal caps lifted`,
                type: 'success'
            };
        }

        if (goalsScored >= goalLimit) {
            return {
                allowed: false,
                message: `❌ #${player.jerseyNumber || ''} ${player.name} (skill ${player.skillRating}) is capped at ${goalLimit} goals. Team must trail by 3+ to exceed.`,
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

    // Clock time is a countdown (MM:SS) capped per period: 20:00 in regulation, 5:00 in OT.
    const periodMaxMin = (period) => (period === 'OT' || period === 4 ? 5 : 20);

    // Auto-insert the colon as digits are typed: "123" -> "1:23", "1234" -> "12:34".
    const fmtClock = (str) => {
        const d = String(str || '').replace(/\D/g, '').slice(0, 4);
        return d.length <= 2 ? d : d.slice(0, d.length - 2) + ':' + d.slice(-2);
    };

    // Validate MM:SS against the period cap; returns a normalized "M:SS" or null.
    const parseTime = (str, period) => {
        const m = String(str || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;
        const mm = +m[1], ss = +m[2];
        if (ss > 59) return null;
        if (mm * 60 + ss > periodMaxMin(period) * 60) return null;
        return mm + ':' + String(ss).padStart(2, '0');
    };

    const periodCapLabel = (period) => `${periodMaxMin(period)}:00`;

    const handleAddGoal = async (e) => {
        e.preventDefault();

        if (goalLimitWarning && !goalLimitWarning.allowed) {
            alert('Cannot add goal - player has reached goal limit!');
            return;
        }

        const clock = parseTime(goalClock, currentPeriod);
        if (!clock) {
            setGoalTimeError(`Enter a valid clock time (MM:SS, up to ${periodCapLabel(currentPeriod)}).`);
            return;
        }

        const scorer = players.find(p => p.id === parseInt(goalScorer));
        const assist1 = goalAssist1 ? players.find(p => p.id === parseInt(goalAssist1)) : null;
        const assist2 = goalAssist2 ? players.find(p => p.id === parseInt(goalAssist2)) : null;

        const newEvent = {
            id: editingEvent ? editingEvent.id : Date.now(),
            backendId: editingEvent ? editingEvent.backendId : undefined,
            type: 'goal',
            team: goalTeam,
            period: currentPeriod,
            time: clock,
            scorer: formatPlayerLabel(scorer),
            scorerId: scorer.id,
            assists: [formatPlayerLabel(assist1), formatPlayerLabel(assist2)].filter(Boolean),
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

            // Score may have changed (e.g. team was corrected) — needs a manual "Save Changes" to persist
            setIsDirty(true);

            setEditingEvent(null);
            await updateEventOnBackend(newEvent);
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

            // Mark as dirty (score changed)
            setIsDirty(true);

            // Auto-save event to backend
            await saveEventToBackend(newEvent);
        }

        resetGoalForm();
    };

    const handleAddPenalty = async (e) => {
        e.preventDefault();

        const player = players.find(p => p.id === parseInt(penaltyPlayer));
        if (!player) {
            setPenaltyTimeError('Select a player for the penalty.');
            return;
        }

        // Check if player is ejected
        if (ejectedPlayers.includes(player.id)) {
            alert('This player has been ejected and cannot receive more penalties.');
            return;
        }

        const clock = parseTime(penaltyClock, currentPeriod);
        if (!clock) {
            setPenaltyTimeError(`Enter a valid clock time (MM:SS, up to ${periodCapLabel(currentPeriod)}).`);
            return;
        }

        // Validate penalty for ejection/suspension
        try {
            const validation = await api.validatePenalty(player.id, game.id, player.teamId);

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

        const finalDescription = penaltyDescription === 'Other' ? penaltyOtherDescription : penaltyDescription;

        const newEvent = {
            id: editingEvent ? editingEvent.id : Date.now(),
            backendId: editingEvent ? editingEvent.backendId : undefined,
            type: 'penalty',
            team: penaltyTeam,
            period: currentPeriod,
            time: clock,
            player: formatPlayerLabel(player),
            playerId: player.id,
            minutes: penaltyMinutes,
            description: finalDescription
        };

        if (editingEvent) {
            const updatedEvents = events.map(e => e.id === editingEvent.id ? newEvent : e);
            setEvents(updatedEvents);
            setEditingEvent(null);
            await updateEventOnBackend(newEvent);
        } else {
            setEvents([...events, newEvent]);
            // Mark as dirty (new event added)
            setIsDirty(true);
            // Auto-save event to backend
            await saveEventToBackend(newEvent);
        }

        resetPenaltyForm();
    };

    // Shared DTO shape for both creating and updating a backend game event
    const buildEventDto = (event) => {
        const [minutes, seconds] = event.time.split(':').map(Number);
        const periodMap = { '1': 1, '2': 2, '3': 3, 'OT': 4 };

        return {
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
    };

    const saveEventToBackend = async (event) => {
        try {
            const eventDto = { gameId: game.id, ...buildEventDto(event) };
            const created = await api.saveGameEvent(game.id, eventDto);
            // Attach the real backend id so this event can be updated/deleted without a reload
            if (created && created.id) {
                setEvents(prev => prev.map(e => e.id === event.id ? { ...e, backendId: created.id } : e));
            }
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event to backend. It will remain locally until page refresh.');
            // Note: We don't remove it from local state so user doesn't lose data
            // In a real app we might mark it as "unsaved" in UI
        }
    };

    const updateEventOnBackend = async (event) => {
        if (!event.backendId) return; // never made it to the backend in the first place — nothing to update there
        try {
            await api.updateGameEvent(game.id, event.backendId, buildEventDto(event));
        } catch (error) {
            console.error('Error updating event:', error);
            alert('Failed to save your changes to the server. Please try again.');
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
            setCurrentPeriod(event.period);
            setGoalClock(event.time || '');
            setGoalTimeError('');
            setGoalBlockMsg('');
            // Restore player IDs
            // Locally-added events use scorerId/assist1Id/assist2Id; events loaded from the
            // backend use playerId/assist1PlayerId/assist2PlayerId — accept either shape.
            const eventScorerId = event.scorerId ?? event.playerId;
            const eventAssist1Id = event.assist1Id ?? event.assist1PlayerId;
            const eventAssist2Id = event.assist2Id ?? event.assist2PlayerId;
            setGoalScorer(eventScorerId?.toString() || '');
            setGoalAssist1(eventAssist1Id?.toString() || '');
            setGoalAssist2(eventAssist2Id?.toString() || '');
            // Check goal limit for the scorer
            if (eventScorerId) {
                const validation = checkGoalLimit(eventScorerId);
                setGoalLimitWarning(validation);
            }
            setGoalStep('assist'); // scorer already known when editing
            setShowGoalForm(true);
        } else {
            setPenaltyTeam(event.team);
            setCurrentPeriod(event.period);
            setPenaltyClock(event.time || '');
            setPenaltyTimeError('');
            // Restore player ID
            setPenaltyPlayer(event.playerId?.toString() || '');
            setPenaltyMinutes(event.minutes);

            // Check if description is in standard list
            if (event.description && !PENALTY_TYPES.includes(event.description)) {
                setPenaltyDescription('Other');
                setPenaltyOtherDescription(event.description);
            } else {
                setPenaltyDescription(event.description || '');
                setPenaltyOtherDescription('');
            }

            setShowPenaltyForm(true);
        }
    };

    const handleDeleteEvent = async (event, domEvent) => {
        domEvent.stopPropagation();

        if (gameFinalized) {
            alert('Game is finalized. Cannot delete events.');
            return;
        }

        const confirmed = window.confirm(
            `Delete this ${event.type === 'goal' ? 'goal' : 'penalty'}? This cannot be undone.`
        );
        if (!confirmed) return;

        try {
            if (event.backendId) {
                await api.deleteGameEvent(game.id, event.backendId);
                // Reload from backend so score, goal counts, and jersey labels stay in sync
                await loadEvents();
                setIsDirty(true);
            } else {
                // Event never made it to the backend (failed auto-save) — just drop it locally
                setEvents(prev => prev.filter(e => e.id !== event.id));
                if (event.type === 'goal') {
                    if (event.team === 'home') setHomeScore(prev => Math.max(0, prev - 1));
                    else setAwayScore(prev => Math.max(0, prev - 1));
                }
            }
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Failed to delete event. Please try again.');
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
            // Save final score to backend with OT flag (forfeits override the score server-side)
            const finalized = await api.finalizeGame(game.id, homeScore, awayScore, endedInOT, forfeitTeamId);
            setGameFinalized(true);
            setIsDirty(false); // No longer dirty after finalize
            setShowSuccessMessage(true);

            // Reflect the authoritative score (forfeits are recorded as 1-0, not whatever was on the board)
            if (finalized) {
                setHomeScore(finalized.homeScore);
                setAwayScore(finalized.awayScore);
                setEndedInOT(finalized.endedInOT);
            }

            // Update parent component with finalized game data
            if (onGameUpdated) {
                onGameUpdated({
                    ...game,
                    homeScore: finalized?.homeScore ?? homeScore,
                    awayScore: finalized?.awayScore ?? awayScore,
                    endedInOT: finalized?.endedInOT ?? endedInOT,
                    forfeitTeamId: finalized?.forfeitTeamId ?? forfeitTeamId,
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

    const handleUnfinalizeClick = () => {
        setShowUnfinalizeModal(true);
    };

    const confirmUnfinalize = async () => {
        setIsUnfinalizing(true);
        try {
            await api.unfinalizeGame(game.id);
            setGameFinalized(false);
            setShowUnfinalizeModal(false);

            // Reload game info to get the proper score/status
            if (onGameUpdated) {
                onGameUpdated({
                    ...game,
                    status: 'in_progress'
                });
            }
            alert('Game has been unfinalized. You may now edit the score.');
        } catch (error) {
            console.error('Error unfinalizing game:', error);
            alert('❌ ERROR\n\nFailed to unfinalize game.\n\nError: ' + error.message);
        } finally {
            setIsUnfinalizing(false);
        }
    };

    const cancelUnfinalize = () => {
        setShowUnfinalizeModal(false);
    };

    const resetGoalForm = () => {
        setGoalScorer('');
        setGoalAssist1('');
        setGoalAssist2('');
        setGoalStep('scorer');
        setGoalClock('');
        setGoalTimeError('');
        setGoalBlockMsg('');
        setGoalLimitWarning(null);
        setEditingEvent(null);
        setShowGoalForm(false);
    };

    const resetPenaltyForm = () => {
        setPenaltyPlayer('');
        setPenaltyMinutes(2);
        setPenaltyDescription('');
        setPenaltyOtherDescription('');
        setPenaltyClock('');
        setPenaltyTimeError('');
        setEditingEvent(null);
        setShowPenaltyForm(false);
    };

    // ── Open the goal/penalty modals for a given side (period comes from the stepper) ──
    const stepPeriod = (dir) => {
        setCurrentPeriod(prev => {
            const order = ['1', '2', '3', 'OT'];
            const i = order.indexOf(String(prev));
            const ni = Math.max(0, Math.min(order.length - 1, (i < 0 ? 0 : i) + dir));
            return order[ni];
        });
    };

    const openGoalModal = (team) => {
        setEditingEvent(null);
        setGoalTeam(team);
        setGoalStep('scorer');
        setGoalScorer('');
        setGoalAssist1('');
        setGoalAssist2('');
        setGoalClock('');
        setGoalTimeError('');
        setGoalBlockMsg('');
        setGoalLimitWarning(null);
        setShowGoalForm(true);
    };

    const openPenaltyModal = (team) => {
        setEditingEvent(null);
        setPenaltyTeam(team);
        setPenaltyPlayer('');
        setPenaltyMinutes(2);
        setPenaltyDescription('');
        setPenaltyOtherDescription('');
        setPenaltyClock('');
        setPenaltyTimeError('');
        setShowPenaltyForm(true);
    };

    // Scorer step → validate clock + goal cap, then advance to the assist step.
    const handleScorerTap = (player) => {
        const clock = parseTime(goalClock, currentPeriod);
        if (!clock) {
            setGoalTimeError(`Enter a valid clock time (MM:SS, up to ${periodCapLabel(currentPeriod)}).`);
            return;
        }
        const validation = checkGoalLimit(player.id);
        if (validation && !validation.allowed) {
            setGoalBlockMsg(validation.message);
            return;
        }
        setGoalBlockMsg('');
        setGoalScorer(String(player.id));
        setGoalAssist1('');
        setGoalAssist2('');
        setGoalLimitWarning(validation);
        setGoalStep('assist');
    };

    // Remove an event from the log (local — the final score is what persists on finalize).
    const performNavigation = useCallback((target) => {
        if (onBack && target === 'back') {
            onBack();
        } else {
            navigate(target === 'back' ? '/scorekeeper' : target);
        }
    }, [onBack, navigate]);

    const saveGame = async () => {
        setSavingDraft(true);
        try {
            await api.updateGameScore(game.id, homeScore, awayScore);
            setIsDirty(false);
            // Sync with parent immediately
            if (onDirtyChange) onDirtyChange(false);
            return true;
        } catch (error) {
            console.error('Error saving game:', error);
            alert('Failed to save. Please try again.');
            return false;
        } finally {
            setSavingDraft(false);
        }
    };

    const handleManualSave = async () => {
        const success = await saveGame();
        if (success) {
            setShowSaveSuccess(true);
            setTimeout(() => setShowSaveSuccess(false), 3000);
        }
    };

    const handleSaveAndLeave = async () => {
        const success = await saveGame();
        if (!success) return;

        setShowUnsavedModal(false);

        // Navigate to the pending destination
        if (blocker.state === "blocked") {
            blocker.proceed();
        } else if (hasPendingNavigation && onNavigate) {
            onNavigate();
        } else {
            // Fallback for manual navigation
            if (onBack) onBack(); else navigate(-1);
        }
    };

    const handleDiscardChanges = () => {
        setShowUnsavedModal(false);
        if (blocker.state === "blocked") {
            blocker.proceed();
        } else if (hasPendingNavigation && onNavigate) {
            onNavigate();
        } else {
            // Manual navigation fallback
            if (onBack) onBack(); else navigate(-1);
        }
    };

    const handleCancelUnsaved = () => {
        setShowUnsavedModal(false);
        if (blocker.state === "blocked") {
            blocker.reset();
        } else if (hasPendingNavigation && onNavigateCancel) {
            onNavigateCancel();
        }
    };

    const handleBack = () => {
        if (isDirty && !gameFinalized) {
            setShowUnsavedModal(true);
        } else {
            if (onBack) {
                onBack();
            } else {
                navigate(-1);
            }
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
            <div className={`entry-header${embedded ? ' entry-header--embedded' : ''}`}>
                {!embedded && <button className="btn-back" onClick={handleBack}>← Signups · Dashboard</button>}
                <h2>
                    <span className="matchup-title">{game.homeTeamName} <span className="matchup-vs">vs</span> {game.awayTeamName}</span>
                    {!embedded && <span className="entry-subtitle">Live Score Entry</span>}
                </h2>
                {!gameFinalized && (
                    <button
                        className={`btn-save${isDirty ? '' : ' btn-save-inactive'}`}
                        onClick={handleManualSave}
                        disabled={!isDirty || savingDraft}
                    >
                        {savingDraft ? 'Saving...' : '💾 Save Changes'}
                    </button>
                )}
                {gameFinalized && <span className="finalized-badge">✓ Finalized</span>}
                {gameFinalized && forfeitTeamId && (
                    <span className="forfeit-tag">
                        Forfeit win for {forfeitTeamId === game.homeTeamId ? game.awayTeamName : game.homeTeamName}
                    </span>
                )}
            </div>

            {/* Scoreboard (design: per-side goal/penalty + center period stepper) */}
            <div className={`sk-board${gameFinalized ? ' is-locked' : ''}`}>
                <div className="sk-board-side">
                    <div className="sk-board-team">
                        <span className="sk-board-dot" style={{ background: game.homeTeamColor }} />
                        <span className="sk-board-name">{game.homeTeamName}</span>
                    </div>
                    {isAdmin ? (
                        <input type="number" min="0" className="sk-board-score sk-board-score-input"
                            value={homeScore} disabled={gameFinalized}
                            onChange={(e) => { setHomeScore(parseInt(e.target.value) || 0); setIsDirty(true); }} />
                    ) : (
                        <div className="sk-board-score">{homeScore}</div>
                    )}
                    <button className="sk-board-goal" disabled={gameFinalized} onClick={() => openGoalModal('home')}>+ Goal</button>
                    <button className="sk-board-pen" disabled={gameFinalized} onClick={() => openPenaltyModal('home')}>+ Penalty</button>
                </div>

                <div className="sk-board-center">
                    <span className="sk-board-period-label">Period</span>
                    <div className="sk-board-stepper">
                        <button className="sk-board-step" disabled={gameFinalized} onClick={() => stepPeriod(-1)} aria-label="Previous period">−</button>
                        <span className="sk-board-period">{currentPeriod === 'OT' ? 'OT' : currentPeriod}</span>
                        <button className="sk-board-step" disabled={gameFinalized} onClick={() => stepPeriod(1)} aria-label="Next period">+</button>
                    </div>
                    <span className="sk-board-venue">{game.venue || 'Sun Prairie Ice Arena'}</span>
                </div>

                <div className="sk-board-side">
                    <div className="sk-board-team">
                        <span className="sk-board-dot" style={{ background: game.awayTeamColor }} />
                        <span className="sk-board-name">{game.awayTeamName}</span>
                    </div>
                    {isAdmin ? (
                        <input type="number" min="0" className="sk-board-score sk-board-score-input"
                            value={awayScore} disabled={gameFinalized}
                            onChange={(e) => { setAwayScore(parseInt(e.target.value) || 0); setIsDirty(true); }} />
                    ) : (
                        <div className="sk-board-score">{awayScore}</div>
                    )}
                    <button className="sk-board-goal" disabled={gameFinalized} onClick={() => openGoalModal('away')}>+ Goal</button>
                    <button className="sk-board-pen" disabled={gameFinalized} onClick={() => openPenaltyModal('away')}>+ Penalty</button>
                </div>
            </div>

            {/* Limits Suspended — a team trailing by 3+ has goal caps lifted until within 2 */}
            {Math.abs(homeScore - awayScore) >= 3 && !gameFinalized && (
                <div className="mercy-rule-alert">
                    <strong>Limits Suspended</strong> — {homeScore < awayScore ? game.homeTeamName : game.awayTeamName} trail by {Math.abs(homeScore - awayScore)}; their goal caps are lifted until within 2.
                </div>
            )}

            {/* Finalized banner */}
            {gameFinalized && (
                <div className="sk-final-banner">
                    <span className="sk-final-text">
                        <span className="sk-final-tag">Final</span> Score submitted. Standings update automatically.
                    </span>
                    {isAdmin && (
                        <button className="sk-reopen-btn" onClick={handleUnfinalizeClick}>Reopen Game</button>
                    )}
                </div>
            )}

            {/* Goal Modal (scorer step → assist step) */}
            {showGoalForm && !gameFinalized && (() => {
                const teamName = goalTeam === 'home' ? game.homeTeamName : game.awayTeamName;
                const teamColor = goalTeam === 'home' ? game.homeTeamColor : game.awayTeamColor;
                const ownScore = goalTeam === 'home' ? homeScore : awayScore;
                const oppScore = goalTeam === 'home' ? awayScore : homeScore;
                const limitsOff = (oppScore - ownScore) >= 3;
                const roster = getTeamPlayers(goalTeam);
                const scorerPlayer = players.find(p => p.id === parseInt(goalScorer));
                return (
                    <div className="sk-modal-overlay" onClick={resetGoalForm}>
                        <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="sk-modal-title">
                                <span className="sk-modal-dot" style={{ background: teamColor }} />
                                <span className="sk-modal-team">{teamName} Goal</span>
                            </div>

                            {goalStep === 'scorer' ? (
                                <>
                                    <p className="sk-modal-sub">Tap the scorer. Skill 9+ players are capped at 2 goals unless trailing by 3+.</p>
                                    <label className="sk-modal-label">Clock Time <span className="clock-hint">Period {currentPeriod === 'OT' ? 'OT' : currentPeriod} · {periodCapLabel(currentPeriod)} max</span></label>
                                    <input type="text" inputMode="numeric"
                                        className={`clock-input${goalTimeError ? ' clock-input-error' : ''}`}
                                        value={goalClock} placeholder="MM:SS"
                                        onChange={(e) => { setGoalClock(fmtClock(e.target.value)); setGoalTimeError(''); }} />
                                    {goalTimeError && <div className="clock-error">{goalTimeError}</div>}
                                    {limitsOff && (
                                        <div className="sk-limits-off"><span className="sk-limits-off-tag">Limits Off</span> Team down 3+ — skill caps lifted.</div>
                                    )}
                                    <div className="sk-roster">
                                        {roster.map(player => {
                                            const res = checkGoalLimit(player.id);
                                            const blocked = res && !res.allowed;
                                            return (
                                                <button key={player.id} type="button"
                                                    className={`sk-roster-row${blocked ? ' is-blocked' : ''}`}
                                                    onClick={() => blocked ? setGoalBlockMsg(res.message) : handleScorerTap(player)}>
                                                    <span className="sk-roster-num">#{player.jerseyNumber || '??'}</span>
                                                    <span className="sk-roster-name">{player.name}</span>
                                                    <span className={`sk-roster-skill${player.skillRating >= 9 ? ' is-high' : ''}`}>Skill {player.skillRating}</span>
                                                    {blocked && <span className="sk-roster-capped">Capped</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {goalBlockMsg && <div className="sk-block-msg">{goalBlockMsg}</div>}
                                    <button type="button" className="sk-modal-cancel" onClick={resetGoalForm}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <div className="sk-assist-scorer">
                                        <span className="sk-assist-scorer-name">{scorerPlayer ? `#${scorerPlayer.jerseyNumber || '??'} ${scorerPlayer.name}` : 'Scorer'}</span>
                                        <span className="sk-assist-scorer-meta">· {currentPeriod === 'OT' ? 'OT' : 'P' + currentPeriod} {goalClock}</span>
                                    </div>
                                    <label className="sk-modal-label">Primary Assist</label>
                                    <select className="sk-modal-select" value={goalAssist1}
                                        onChange={(e) => { setGoalAssist1(e.target.value); setGoalAssist2(''); }}>
                                        <option value="">Unassisted</option>
                                        {roster.filter(p => p.id !== parseInt(goalScorer)).map(p => (
                                            <option key={p.id} value={p.id}>#{p.jerseyNumber || '??'} {p.name}</option>
                                        ))}
                                    </select>
                                    <label className={`sk-modal-label${goalAssist1 ? '' : ' is-disabled'}`}>Secondary Assist</label>
                                    <select className="sk-modal-select" value={goalAssist2} disabled={!goalAssist1}
                                        onChange={(e) => setGoalAssist2(e.target.value)}>
                                        <option value="">None</option>
                                        {roster.filter(p => p.id !== parseInt(goalScorer) && p.id !== parseInt(goalAssist1)).map(p => (
                                            <option key={p.id} value={p.id}>#{p.jerseyNumber || '??'} {p.name}</option>
                                        ))}
                                    </select>
                                    <div className="sk-modal-actions">
                                        <button type="button" className="sk-modal-back" onClick={() => setGoalStep('scorer')}>← Scorer</button>
                                        <button type="button" className="sk-modal-confirm" onClick={handleAddGoal}>{editingEvent ? 'Update Goal' : 'Record Goal'}</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Penalty Modal */}
            {showPenaltyForm && !gameFinalized && (() => {
                const teamName = penaltyTeam === 'home' ? game.homeTeamName : game.awayTeamName;
                const teamColor = penaltyTeam === 'home' ? game.homeTeamColor : game.awayTeamColor;
                const roster = getTeamPlayers(penaltyTeam);
                return (
                    <div className="sk-modal-overlay" onClick={resetPenaltyForm}>
                        <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="sk-modal-title">
                                <span className="sk-modal-dot" style={{ background: teamColor }} />
                                <span className="sk-modal-team">{teamName} Penalty</span>
                            </div>

                            <label className="sk-modal-label">Clock Time <span className="clock-hint">Period {currentPeriod === 'OT' ? 'OT' : currentPeriod} · {periodCapLabel(currentPeriod)} max</span></label>
                            <input type="text" inputMode="numeric"
                                className={`clock-input${penaltyTimeError ? ' clock-input-error' : ''}`}
                                value={penaltyClock} placeholder="MM:SS"
                                onChange={(e) => { setPenaltyClock(fmtClock(e.target.value)); setPenaltyTimeError(''); }} />
                            {penaltyTimeError && <div className="clock-error">{penaltyTimeError}</div>}

                            <label className="sk-modal-label">Player</label>
                            <select className="sk-modal-select" value={penaltyPlayer} onChange={(e) => setPenaltyPlayer(e.target.value)}>
                                <option value="">Select player…</option>
                                {roster.map(p => <option key={p.id} value={p.id}>#{p.jerseyNumber || '??'} {p.name}</option>)}
                            </select>

                            <label className="sk-modal-label">Penalty Type</label>
                            <select className="sk-modal-select" value={penaltyDescription} onChange={(e) => setPenaltyDescription(e.target.value)}>
                                <option value="">Select penalty type…</option>
                                {PENALTY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                <option value="Other">Other</option>
                            </select>
                            {penaltyDescription === 'Other' && (
                                <input type="text" className="sk-modal-input" value={penaltyOtherDescription}
                                    onChange={(e) => setPenaltyOtherDescription(e.target.value)} placeholder="Enter penalty description" />
                            )}

                            <label className="sk-modal-label">Duration</label>
                            <select className="sk-modal-select" value={penaltyMinutes} onChange={(e) => setPenaltyMinutes(parseInt(e.target.value))}>
                                <option value={2}>2 min (Minor)</option>
                                <option value={3}>3 min</option>
                                <option value={4}>4 min (Double Minor)</option>
                                <option value={6}>6 min (Major)</option>
                                <option value={10}>10 min (Misconduct)</option>
                            </select>

                            <div className="sk-modal-actions">
                                <button type="button" className="sk-modal-back" onClick={resetPenaltyForm}>Cancel</button>
                                <button type="button" className="sk-modal-confirm" onClick={handleAddPenalty}>{editingEvent ? 'Update Penalty' : 'Add Penalty'}</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Scoring & Penalties feed */}
            <div className="sk-feed">
                <div className="sk-feed-head">
                    <span className="sk-feed-title">Scoring &amp; Penalties</span>
                    {!gameFinalized && (
                        <button className="sk-finalize-btn" onClick={handleFinalizeGame}>Finalize Game</button>
                    )}
                </div>
                {events.length === 0 ? (
                    <div className="sk-feed-empty">
                        No scoring yet. Tap <span className="sk-feed-empty-accent">+ Goal</span> to record the first one.
                    </div>
                ) : (
                    <div className="sk-feed-list">
                        {events.slice().sort((a, b) => {
                            const periodOrder = { '1': 1, '2': 2, '3': 3, 'OT': 4 };
                            const pa = periodOrder[a.period] || 999;
                            const pb = periodOrder[b.period] || 999;
                            if (pa !== pb) return pb - pa;
                            const [minA, secA] = a.time.split(':').map(Number);
                            const [minB, secB] = b.time.split(':').map(Number);
                            return (minA * 60 + secA) - (minB * 60 + secB);
                        }).map(event => {
                            const teamColor = event.team === 'home' ? game.homeTeamColor : game.awayTeamColor;
                            const periodLbl = event.period === 'OT' ? 'OT' : 'P' + event.period;
                            return (
                                <div
                                    key={event.id}
                                    className={`sk-feed-row${!gameFinalized ? ' is-editable' : ''}`}
                                    onClick={() => !gameFinalized && handleEditEvent(event)}
                                >
                                    <span className={`sk-feed-tag ${event.type}`}>{event.type === 'goal' ? 'Goal' : 'Penalty'}</span>
                                    <span className="sk-feed-dot" style={{ background: teamColor }} />
                                    <span className="sk-feed-text">
                                        {event.type === 'goal' ? (
                                            <>
                                                {event.scorer}
                                                {event.assists.length > 0 && <span className="sk-feed-assists"> · A: {event.assists.join(', ')}</span>}
                                            </>
                                        ) : (
                                            <>{event.player} — {event.description || 'Penalty'} ({event.minutes} min)</>
                                        )}
                                    </span>
                                    <span className="sk-feed-period">{periodLbl} · {event.time}</span>
                                    {!gameFinalized && (
                                        <button
                                            className="sk-feed-remove"
                                            title="Remove event"
                                            onClick={(ev) => handleDeleteEvent(event, ev)}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Unfinalize Confirmation Modal */}
            {showUnfinalizeModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>⚠️ Unfinalize Game</h3>
                        <div className="modal-body">
                            <p>Are you sure you want to unfinalize this game?</p>
                            <div className="warning-list">
                                <p><strong>This will:</strong></p>
                                <ul>
                                    <li>Revert all points awarded to the teams in the standings</li>
                                    <li>Revert player games played statistics</li>
                                    <li>Unlock the game for score editing</li>
                                </ul>
                            </div>
                            <p className="confirm-question">You MUST re-finalize the game after making edits to ensure stats are accurate.</p>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-confirm btn-warn" onClick={confirmUnfinalize} disabled={isUnfinalizing}>
                                {isUnfinalizing ? 'Unfinalizing...' : 'Yes, Unfinalize Game'}
                            </button>
                            <button className="btn-cancel-modal" onClick={cancelUnfinalize} disabled={isUnfinalizing}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Finalize Confirmation Modal */}
            {showFinalizeModal && (
                <div className="modal-overlay" onClick={cancelFinalize}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>⚠️ Finalize Game</h3>
                        <div className="modal-body">
                            <div className="forfeit-selection">
                                <p><strong>Did either team forfeit?</strong></p>
                                <div className="forfeit-options">
                                    <label className="forfeit-option">
                                        <input
                                            type="radio"
                                            name="forfeit"
                                            checked={forfeitTeamId === null}
                                            onChange={() => setForfeitTeamId(null)}
                                        />
                                        <span>No forfeit</span>
                                    </label>
                                    <label className="forfeit-option">
                                        <input
                                            type="radio"
                                            name="forfeit"
                                            checked={forfeitTeamId === game.homeTeamId}
                                            onChange={() => setForfeitTeamId(game.homeTeamId)}
                                        />
                                        <span>{game.homeTeamName} forfeits</span>
                                    </label>
                                    <label className="forfeit-option">
                                        <input
                                            type="radio"
                                            name="forfeit"
                                            checked={forfeitTeamId === game.awayTeamId}
                                            onChange={() => setForfeitTeamId(game.awayTeamId)}
                                        />
                                        <span>{game.awayTeamName} forfeits</span>
                                    </label>
                                </div>
                            </div>

                            <div className="final-score">
                                <strong>Final Score:</strong>
                                {forfeitTeamId ? (
                                    <div className="score-display-large">
                                        {forfeitTeamId === game.homeTeamId
                                            ? <>{game.homeTeamName} <span className="score-num">0</span> - <span className="score-num">1</span> {game.awayTeamName}</>
                                            : <>{game.homeTeamName} <span className="score-num">1</span> - <span className="score-num">0</span> {game.awayTeamName}</>}
                                        <span className="forfeit-tag"> (forfeit)</span>
                                    </div>
                                ) : (
                                    <div className="score-display-large">
                                        {game.homeTeamName} <span className="score-num">{homeScore}</span> - <span className="score-num">{awayScore}</span> {game.awayTeamName}
                                    </div>
                                )}
                            </div>

                            {!forfeitTeamId && (
                                <div className="ot-selection">
                                    {events.some(e => e.type === 'goal' && e.period === 'OT') ? (
                                        <p><strong>✓ OT goal detected - Game ended in overtime</strong></p>
                                    ) : (
                                        <>
                                            <p><strong>Did this game end in overtime?</strong></p>
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
                                    {forfeitTeamId && (
                                        <li>
                                            Award the win and 2 points to {forfeitTeamId === game.homeTeamId ? game.awayTeamName : game.homeTeamName}
                                            {events.length > 0 && ' (any goals/penalties already logged will not count toward player stats)'}
                                        </li>
                                    )}
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

            {showSaveSuccess && (
                <div className="success-toast save-toast">
                    <div className="success-icon">💾</div>
                    <div className="success-text">
                        <strong>Saved!</strong>
                        <p>Game progress has been saved.</p>
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

            {/* Unsaved Changes Modal */}
            {showUnsavedModal && (
                <div className="modal-overlay">
                    <div className="modal-content unsaved-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>⚠️ Unsaved Changes</h3>
                        <div className="modal-body">
                            <p>You have unsaved changes to this game. Would you like to save your progress before leaving?</p>
                            <p className="unsaved-detail">Current score: <strong>{game.homeTeamName} {homeScore} - {awayScore} {game.awayTeamName}</strong></p>
                            <p className="unsaved-note">Saving will preserve the current score so you can return and continue scoring this game later.</p>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-confirm" onClick={handleSaveAndLeave} disabled={savingDraft}>
                                {savingDraft ? 'Saving...' : '💾 Save & Leave'}
                            </button>
                            <button className="btn-cancel-modal btn-danger" onClick={handleDiscardChanges}>
                                🗑️ Discard Changes
                            </button>
                            <button className="btn-cancel-modal" onClick={handleCancelUnsaved}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LiveScoreEntry;
