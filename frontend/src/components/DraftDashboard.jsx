import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import * as XLSX from 'xlsx';
import DraftService from '../services/DraftService';
import './DraftDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '/api') || '/api';
const DraftDashboard = () => {
    // State
    const [seasonName, setSeasonName] = useState('');
    const [selectedSeasonId, setSelectedSeasonId] = useState(null);
    const [availableSeasons, setAvailableSeasons] = useState([]);
    const [seasonsLoading, setSeasonsLoading] = useState(true);
    const [showCreateSeasonModal, setShowCreateSeasonModal] = useState(false);
    const [newSeasonForm, setNewSeasonForm] = useState({
        name: '', startDate: '', endDate: '', status: 'upcoming', isActive: false
    });
    const [newSeasonSaving, setNewSeasonSaving] = useState(false);
    const [teamCount, setTeamCount] = useState(4);
    const [playerPool, setPlayerPool] = useState([]);
    const [teams, setTeams] = useState([]);
    const [isLive, setIsLive] = useState(false);
    const [warning, setWarning] = useState('');
    const [viewMode, setViewMode] = useState('balanced'); // 'detailed', 'balanced', 'overview'
    const [isPoolCollapsed, setIsPoolCollapsed] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);

    // Filters & Sorting
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('Name');
    const [sortAsc, setSortAsc] = useState(true);

    // Team-specific state
    const [teamColors, setTeamColors] = useState({});
    const [teamSortOptions, setTeamSortOptions] = useState({});
    const [editingTeamId, setEditingTeamId] = useState(null);

    // Draft save state
    const [currentDraftSaveId, setCurrentDraftSaveId] = useState(null);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [savedDraft, setSavedDraft] = useState(null);

    // Buddy pick map: email → array of buddy emails
    const [buddyPickMap, setBuddyPickMap] = useState({});

    // Buddy pick modal state
    const [showBuddyModal, setShowBuddyModal] = useState(false);
    const [modalPlayer, setModalPlayer] = useState(null);
    const [modalTargetTeam, setModalTargetTeam] = useState(null);
    const [modalSource, setModalSource] = useState(null); // Track source of drag for modal
    const [modalBuddies, setModalBuddies] = useState([]);
    const [selectedBuddies, setSelectedBuddies] = useState([]);
    const [buddyQueue, setBuddyQueue] = useState([]); // Queue for GM buddy carousel

    // New Draft confirmation modal state
    const [showNewDraftConfirm, setShowNewDraftConfirm] = useState(false);

    // Finalize Draft confirmation modal state
    const [showFinalizeDraftConfirm, setShowFinalizeDraftConfirm] = useState(false);

    // Unrated Veterans Modal State
    const [showUnratedVeteransModal, setShowUnratedVeteransModal] = useState(false);
    const [unratedVeterans, setUnratedVeterans] = useState([]);

    // Potential Matches Modal State
    const [showPotentialMatchesModal, setShowPotentialMatchesModal] = useState(false);
    const [potentialMatches, setPotentialMatches] = useState([]);
    
    // Duplicate Player Resolution Modal State (Finalization)
    const [showDuplicateResolutionModal, setShowDuplicateResolutionModal] = useState(false);
    const [duplicatePlayersToResolve, setDuplicatePlayersToResolve] = useState([]);

    // Undo History State
    const [history, setHistory] = useState([]);

    // Unsaved changes tracking
    const [isDirty, setIsDirty] = useState(false);
    const isInitialMount = useRef(true);

    // Block in-app navigation (React Router) when there are unsaved changes
    const blocker = useBlocker(isDirty);

    // Save current state to history stack
    const saveHistory = () => {
        const currentState = {
            playerPool: [...playerPool],
            teams: JSON.parse(JSON.stringify(teams)), // Deep copy for nested players array
            buddyPickMap: { ...buddyPickMap },
            warning,
            teamColors: { ...teamColors },
            teamSortOptions: { ...teamSortOptions }
        };

        setHistory(prev => {
            const newHistory = [...prev, currentState];
            // Limit history size to 20
            if (newHistory.length > 20) {
                return newHistory.slice(newHistory.length - 20);
            }
            return newHistory;
        });
    };

    // Undo last action
    const handleUndo = () => {
        if (history.length === 0) return;

        const previousState = history[history.length - 1];
        setHistory(prev => prev.slice(0, prev.length - 1));

        setPlayerPool(previousState.playerPool);
        setTeams(previousState.teams);
        setBuddyPickMap(previousState.buddyPickMap);
        setWarning('Action undone.');
        setTeamColors(previousState.teamColors);
        setTeamSortOptions(previousState.teamSortOptions);
    };


    // Color options with exact hex codes
    const TEAM_COLORS = {
        'White': '#f0f0f0',
        'Teal': '#007a7a',
        'Blue': '#0100fe',
        'Red': '#fb0102',
        'Lt. Blue': '#5e9ed6',
        'Tan': '#b8956f',
        'Purple': '#9a00ff',
        'Orange': '#fd9a01',
        'Black': '#000000',
        'Gray': '#666666',
        'Maroon': '#a64d79',
        'Green': '#39751f'
    };

    // Initialize Teams
    useEffect(() => {
        if (!isLive && teams.length !== parseInt(teamCount)) {
            const newTeams = Array.from({ length: parseInt(teamCount) }, (_, i) => ({
                id: i + 1,
                name: `Team ${i + 1}`,
                players: []
            }));
            setTeams(newTeams);

            // Initialize team colors to White
            const colors = {};
            const sortOpts = {};
            newTeams.forEach(team => {
                colors[team.id] = 'White';
                sortOpts[team.id] = 'Position + Rating';
            });
            setTeamColors(colors);
            setTeamSortOptions(sortOpts);
        }
    }, [teamCount, isLive]);

    // Fetch available seasons and check for saved drafts on mount
    useEffect(() => {
        fetchAvailableSeasons();
        checkForSavedDraft();
    }, []);

    // Mark dirty whenever teams or playerPool change while the draft is live
    // Skip the very first render and the initial data load
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (isLive) {
            setIsDirty(true);
        }
    }, [teams, playerPool]); // eslint-disable-line react-hooks/exhaustive-deps

    // Block browser tab close / page refresh when there are unsaved changes
    useEffect(() => {
        if (!isDirty) return;
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Fetch active and upcoming seasons from the database
    const fetchAvailableSeasons = async (autoSelectId = null) => {
        setSeasonsLoading(true);
        try {
            const apiV1 = import.meta.env.VITE_API_URL || '/api/v1';
            const [activeRes, upcomingRes] = await Promise.all([
                fetch(`${apiV1}/seasons?status=active`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
                fetch(`${apiV1}/seasons?status=upcoming`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
            ]);

            const active = activeRes.ok ? await activeRes.json() : [];
            const upcoming = upcomingRes.ok ? await upcomingRes.json() : [];

            // Combine and deduplicate by id, active seasons first
            const combined = [...active, ...upcoming].reduce((acc, season) => {
                if (!acc.find(s => s.id === season.id)) acc.push(season);
                return acc;
            }, []);

            setAvailableSeasons(combined);

            // Auto-select a newly created season if requested
            if (autoSelectId) {
                const created = combined.find(s => s.id === autoSelectId);
                if (created) {
                    setSelectedSeasonId(created.id);
                    setSeasonName(created.name);
                }
            }
        } catch (error) {
            console.error('Error fetching seasons:', error);
            setAvailableSeasons([]);
        } finally {
            setSeasonsLoading(false);
        }
    };

    // Create a new season directly from the draft tool
    const handleCreateSeason = async (e) => {
        e.preventDefault();
        setNewSeasonSaving(true);
        try {
            const apiV1 = import.meta.env.VITE_API_URL || '/api/v1';
            const response = await fetch(`${apiV1}/seasons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(newSeasonForm)
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Failed to create season');
            }
            const created = await response.json();
            setShowCreateSeasonModal(false);
            setNewSeasonForm({ name: '', startDate: '', endDate: '', status: 'upcoming', isActive: false });
            // Refresh dropdown and auto-select the new season
            await fetchAvailableSeasons(created.id);
            setWarning(`Season "${created.name}" created and selected!`);
        } catch (error) {
            setWarning(`Failed to create season: ${error.message}`);
        } finally {
            setNewSeasonSaving(false);
        }
    };

    const checkMissingVeterans = (pool) => {
        const missingRatings = pool.filter(p => p.isVeteran && !p.ratingFoundInDb && !p.adoptedMatchSkill);
        if (missingRatings.length > 0) {
            // Need to map them so they default to 1 if skillRating is missing
            setUnratedVeterans(missingRatings.map(m => ({ ...m, skillRating: m.skillRating || 1 })));
            setShowUnratedVeteransModal(true);
        }
    };

    const handleSavePotentialMatches = () => {
        setPlayerPool(prevPool => {
            const newPool = [...prevPool];
            potentialMatches.forEach(pm => {
                const idx = newPool.findIndex(p => p.email === pm.email);
                if (idx !== -1) {
                    // If adopted, keep the dbId to link them later during finalization!
                    if (pm.adoptRating) {
                        newPool[idx] = { 
                            ...newPool[idx], 
                            skillRating: pm.potentialMatchSkill,
                            dbId: pm.potentialMatchId,
                            adoptedMatchSkill: true
                        };
                    } else {
                        // Keep as new player, don't link dbId
                        newPool[idx] = {
                            ...newPool[idx],
                            dbId: null,
                            adoptedMatchSkill: false
                        };
                    }
                }
            });
            checkMissingVeterans(newPool);
            return newPool;
        });
        setShowPotentialMatchesModal(false);
        setPotentialMatches([]);
    };

    const handleCancelPotentialMatches = () => {
        setPlayerPool([]);
        setBuddyPickMap({});
        setShowPotentialMatchesModal(false);
        setPotentialMatches([]);
        setWarning('File upload cancelled.');
    };

    const toggleAdoptPotentialMatch = (email, adopt) => {
        setPotentialMatches(prev => prev.map(pm => 
            pm.email === email ? { ...pm, adoptRating: adopt } : pm
        ));
    };

    // Save manually entered veteran ratings
    const handleSaveUnratedVeterans = () => {
        setPlayerPool(prevPool => {
            const newPool = [...prevPool];
            unratedVeterans.forEach(uv => {
                const idx = newPool.findIndex(p => p.email === uv.email);
                if (idx !== -1) {
                    newPool[idx] = { ...newPool[idx], skillRating: uv.skillRating };
                }
            });
            return newPool;
        });
        // Buddy pick map was already built with old ratings, no need to rebuild just for rating changes
        setShowUnratedVeteransModal(false);
        setUnratedVeterans([]);
    };

    const handleCancelUnratedVeterans = () => {
        setPlayerPool([]);
        setBuddyPickMap({});
        setShowUnratedVeteransModal(false);
        setUnratedVeterans([]);
        setWarning('File upload cancelled.');
    };

    const handleUnratedVeteranRatingChange = (email, newRating) => {
        setUnratedVeterans(prev => prev.map(uv => 
            uv.email === email ? { ...uv, skillRating: parseInt(newRating) || 1 } : uv
        ));
    };

    // Rebuild buddy pick map when players move between pool and teams
    useEffect(() => {
        if (playerPool.length > 0 || teams.some(t => t.players && t.players.length > 0)) {
            buildBuddyPickMap(playerPool, teams);
        }
    }, [playerPool, teams]);

    // Auto-clear warning/info banner after 10 seconds
    useEffect(() => {
        if (warning) {
            const timer = setTimeout(() => {
                setWarning('');
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [warning]);

    const checkForSavedDraft = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/league/draft/latest`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok && response.status !== 204) {
                const draft = await response.json();
                if (draft && draft.status === 'saved') {
                    setSavedDraft(draft);
                    setShowResumePrompt(true);
                }
            }
            // If 204 No Content, no drafts exist - this is normal, do nothing
        } catch (error) {
            console.error('Error checking for saved draft:', error);
        }
    };

    // Build buddy pick map from player data
    const buildBuddyPickMap = (players, teamsData = null) => {
        // Collect all players from pool AND teams
        const allPlayers = [...players];
        if (teamsData) {
            teamsData.forEach(team => {
                if (team.players) {
                    allPlayers.push(...team.players);
                }
            });
        }

        // First, build a name→email lookup map (case-insensitive)
        const nameToEmail = {};
        allPlayers.forEach(player => {
            const fullName = `${player.firstName} ${player.lastName}`.toLowerCase().trim();
            nameToEmail[fullName] = player.email;
        });

        // Now build email→buddy emails map
        const buddyMap = {};
        allPlayers.forEach(player => {
            if (player.buddyPick && player.buddyPick.trim() !== '') {
                // Split by comma and trim each buddy name
                const buddyNames = player.buddyPick.split(',').map(name => name.trim().toLowerCase());

                // Resolve buddy names to emails
                const buddyEmails = buddyNames
                    .map(name => nameToEmail[name])
                    .filter(email => email !== undefined); // Remove unmatched names

                if (buddyEmails.length > 0) {
                    buddyMap[player.email] = buddyEmails;
                }
            }
        });

        setBuddyPickMap(buddyMap);
    };

    // Handlers
    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (type === 'registration') {
                const players = await DraftService.importRegistration(file);
                
                setPlayerPool(players);
                buildBuddyPickMap(players);
                setWarning('');

                const matches = players.filter(p => p.potentialMatchFound);
                if (matches.length > 0) {
                    // Initialize adoptRating to true by default
                    setPotentialMatches(matches.map(m => ({ ...m, adoptRating: true })));
                    setShowPotentialMatchesModal(true);
                } else {
                    checkMissingVeterans(players);
                }
            } else if (type === 'draft') {
                const state = await DraftService.loadDraftState(file);
                setSeasonName(state.seasonName);
                setTeamCount(state.teamCount);
                setPlayerPool(state.playerPool);
                setTeams(state.teams);
                setIsLive(state.isLive);
                setTeamColors(state.teamColors || {});
                setTeamSortOptions(state.teamSortOptions || {});
                setViewMode(state.viewMode || 'balanced');

                // Build buddy pick map from both pool and teams
                buildBuddyPickMap(state.playerPool || [], state.teams || []);

                setWarning('');
            }
        } catch (error) {
            setWarning(`Upload failed: ${error.message}`);
        } finally {
            e.target.value = null;
        }
    };

    const handleStartDraft = () => {
        if (!seasonName) {
            setWarning('Please enter a Season Name.');
            return;
        }
        if (playerPool.length === 0) {
            setWarning('Please upload a registration file.');
            return;
        }
        setIsLive(true);
        setWarning('');
    };

    const handleReset = () => {
        saveHistory(); // Save state before mutation

        console.log('=== RESET BUTTON CLICKED ===');
        console.log('Reset starting - Current state:', {
            playerPoolSize: playerPool.length,
            teamsCount: teams.length,
            totalPlayersInTeams: teams.reduce((sum, t) => sum + t.players.length, 0)
        });

        // Collect all players from teams and add them back to the pool
        const allPlayers = [...playerPool];
        teams.forEach(team => {
            allPlayers.push(...team.players);
        });

        console.log('All players collected:', allPlayers.length);

        // Reset teams to empty
        const newTeams = Array.from({ length: parseInt(teamCount) }, (_, i) => ({
            id: i + 1,
            name: `Team ${i + 1}`,
            players: []
        }));

        // Reset team colors and sort options
        const colors = {};
        const sortOpts = {};
        newTeams.forEach(team => {
            colors[team.id] = 'White';
            sortOpts[team.id] = 'Position + Rating';
        });

        console.log('Setting new state...');
        setPlayerPool(allPlayers);
        setTeams(newTeams);
        setTeamColors(colors);
        setTeamSortOptions(sortOpts);
        // Keep isLive as true - draft stays active
        setWarning('Draft board reset - all players returned to pool.');
        console.log('=== RESET COMPLETE ===');
    };

    // Handler for changing team colors
    const handleTeamColorChange = (teamId, color) => {
        setTeamColors(prev => ({
            ...prev,
            [teamId]: color
        }));
    };

    // Handler for changing team sort options
    const handleTeamSortChange = (teamId, sortOption) => {
        setTeamSortOptions(prev => ({
            ...prev,
            [teamId]: sortOption
        }));
    };

    // Handler for changing team names
    const handleTeamNameChange = (teamId, newName) => {
        setTeams(prevTeams =>
            prevTeams.map(team =>
                team.id === teamId ? { ...team, name: newName } : team
            )
        );
    };

    // Handler for assigning GMs to teams
    const handleAssignGMs = () => {
        saveHistory(); // Save state before mutation

        // Get all GMs from player pool AND teams
        const allPlayers = [...playerPool];
        teams.forEach(team => {
            allPlayers.push(...team.players);
        });
        const gms = allPlayers.filter(player => player.isGm);

        // Check if we have enough GMs
        if (gms.length < teams.length) {
            setWarning(`Not enough GMs! Found ${gms.length} GMs but need ${teams.length} (one per team)`);
            return;
        }

        // Find teams that don't have a GM yet
        const teamsWithoutGM = teams.filter(team =>
            !team.players.some(player => player.isGm)
        );

        if (teamsWithoutGM.length === 0) {
            setWarning('All teams already have a GM assigned!');
            return;
        }

        // Get GMs that are still in the player pool (not already on teams)
        const availableGMs = gms.filter(gm =>
            playerPool.some(p => p.email === gm.email)
        );

        if (availableGMs.length < teamsWithoutGM.length) {
            setWarning(`Not enough GMs in player pool! Found ${availableGMs.length} available GMs but need ${teamsWithoutGM.length} more (${teamsWithoutGM.length} teams without GMs).`);
            return;
        }

        // Shuffle available GMs for random assignment
        const shuffledGMs = [...availableGMs].sort(() => Math.random() - 0.5);

        // Assign one GM to each team that doesn't have one
        let gmIndex = 0;
        const updatedTeams = teams.map(team => {
            const hasGM = team.players.some(player => player.isGm);
            if (!hasGM && gmIndex < shuffledGMs.length) {
                return {
                    ...team,
                    players: [...team.players, shuffledGMs[gmIndex++]]
                };
            }
            return team;
        });

        // Remove assigned GMs from player pool
        const assignedGMEmails = shuffledGMs.slice(0, teamsWithoutGM.length).map(gm => gm.email);
        const updatedPool = playerPool.filter(player => !assignedGMEmails.includes(player.email));

        // Sort teams by average skill rating (Low to High)
        updatedTeams.sort((a, b) => {
            const getAvg = (players) => {
                if (!players || players.length === 0) return 0;
                const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
                return total / players.length;
            };
            return getAvg(a.players) - getAvg(b.players);
        });

        setTeams(updatedTeams);
        setPlayerPool(updatedPool);
        setWarning(`Successfully assigned ${teamsWithoutGM.length} GMs to teams without GMs!`);
    };

    // Handler for assigning GM buddy picks to teams using the wizard
    const handleAssignGMBuddies = () => {
        // Find all GMs currently on teams
        const gmsOnTeams = [];
        teams.forEach(team => {
            const teamGMs = team.players.filter(player => player.isGm);
            teamGMs.forEach(gm => {
                gmsOnTeams.push({ gm, teamId: team.id });
            });
        });

        if (gmsOnTeams.length === 0) {
            setWarning('No GMs assigned to teams yet! Assign GMs first.');
            return;
        }

        const queue = [];
        const warnings = [];

        // For each GM on a team, find valid buddies in the pool (including recursive picks)
        gmsOnTeams.forEach(({ gm, teamId }) => {
            // Collect ALL chained buddies using BFS
            const allBuddyEmails = new Set();
            const searchQueue = [...(buddyPickMap[gm.email] || [])];
            const visited = new Set([gm.email]); // Don't pick self

            while (searchQueue.length > 0) {
                const currentEmail = searchQueue.shift();
                if (visited.has(currentEmail)) continue;

                visited.add(currentEmail);
                allBuddyEmails.add(currentEmail);

                // Add this person's buddies to queue
                const nextBuddies = buddyPickMap[currentEmail] || [];
                nextBuddies.forEach(b => {
                    if (!visited.has(b)) searchQueue.push(b);
                });
            }

            // Find buddies still in player pool
            const availableBuddies = Array.from(allBuddyEmails)
                .map(email => playerPool.find(p => p.email === email))
                .filter(buddy => buddy !== undefined);

            if (availableBuddies.length === 0) {
                // Determine if they are already on the team or just missing
                const team = teams.find(t => t.id === teamId);
                const onTeam = Array.from(allBuddyEmails).every(email => team.players.some(p => p.email === email));

                if (!onTeam) {
                    warnings.push(`${gm.firstName} ${gm.lastName}'s buddies not found in pool (likely already assigned elsewhere)`);
                }
                return;
            }

            // Add to queue
            queue.push({
                gm,
                teamId,
                availableBuddies
            });
        });

        if (queue.length === 0) {
            setWarning('No available buddy picks found to assign for current GMs.');
            return;
        }

        // Start the wizard with the first GM
        const firstItem = queue[0];
        setBuddyQueue(queue.slice(1)); // Store remaining items

        // Setup modal
        setModalPlayer(firstItem.gm);
        setModalTargetTeam(firstItem.teamId);
        setModalBuddies(firstItem.availableBuddies);
        setSelectedBuddies(firstItem.availableBuddies.map(p => p.email)); // Pre-select all
        setShowBuddyModal(true);
    };

    // Validation: Check if each team has at least one GM
    const validateGMAssignments = () => {
        const teamsWithoutGM = teams.filter(team =>
            !team.players.some(player => player.isGm)
        );

        if (teamsWithoutGM.length > 0) {
            const teamNames = teamsWithoutGM.map(t => t.name).join(', ');
            setWarning(`Error: The following teams need at least one GM: ${teamNames}`);
            return false;
        }
        return true;
    };

    // ===== Draft Save/Load Handlers =====

    const handleSaveDraft = async () => {
        if (!selectedSeasonId) {
            setWarning('Please select a season before saving.');
            return false;
        }

        try {
            const draftData = {
                seasonName,
                seasonId: selectedSeasonId,
                teamCount,
                isLive,
                teams: teams.map(team => ({
                    id: team.id,
                    name: team.name,
                    color: teamColors[team.id] || 'White',
                    sortOption: teamSortOptions[team.id] || 'Position + Rating',
                    players: team.players.map(player => ({
                        ...player,
                        // Ensure all player properties are included
                        firstName: player.firstName,
                        lastName: player.lastName,
                        email: player.email,
                        position: player.position,
                        skillRating: player.skillRating,
                        isVeteran: player.isVeteran,
                        isGm: player.isGm || false,
                        isRef: player.isRef || false,
                        status: player.status || (player.isVeteran ? 'Veteran' : 'Rookie'),
                        buddyEmail: player.buddyEmail || null
                    }))
                })),
                playerPool: playerPool.map(player => ({
                    ...player,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    email: player.email,
                    position: player.position,
                    skillRating: player.skillRating,
                    isVeteran: player.isVeteran,
                    isGm: player.isGm || false,
                    isRef: player.isRef || false,
                    status: player.status || (player.isVeteran ? 'Veteran' : 'Rookie'),
                    buddyEmail: player.buddyEmail || null
                }))
            };

            // Use PUT to update if we have an ID, POST to create new
            const url = currentDraftSaveId
                ? `${API_BASE_URL}/league/draft/save/${currentDraftSaveId}`
                : `${API_BASE_URL}/league/draft/save`;
            const method = currentDraftSaveId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(draftData)
            });

            if (response.ok) {
                const result = await response.json();
                setCurrentDraftSaveId(result.id);
                setIsDirty(false); // Draft is now saved — clear dirty flag
                const action = currentDraftSaveId ? 'updated' : 'saved';
                setWarning(`Draft "${seasonName}" ${action} successfully! (ID: ${result.id})`);
                return true;
            } else {
                setWarning('Failed to save draft');
                return false;
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            setWarning('Error saving draft. Check console for details.');
            return false;
        }
    };

    const handleSaveDuplicateResolution = async () => {
        // Apply resolution to all players
        const applyResolution = (pool) => {
            return pool.map(p => {
                const resolved = duplicatePlayersToResolve.find(d => d.email === p.email);
                if (resolved) {
                    return {
                        ...p,
                        duplicateResolved: true,
                        dbId: resolved.resolveAction === 'update' ? p.potentialMatchId : null
                    };
                }
                return p;
            });
        };

        setPlayerPool(prev => applyResolution(prev));
        setTeams(prev => prev.map(t => ({
            ...t,
            players: applyResolution(t.players || [])
        })));

        setShowDuplicateResolutionModal(false);
        setDuplicatePlayersToResolve([]);
        
        // Proceed to finalize confirmation
        setShowFinalizeDraftConfirm(true);
    };

    const handleCancelDuplicateResolution = () => {
        setShowDuplicateResolutionModal(false);
        setDuplicatePlayersToResolve([]);
    };

    const toggleDuplicateResolutionAction = (email, action) => {
        setDuplicatePlayersToResolve(prev => prev.map(d => 
            d.email === email ? { ...d, resolveAction: action } : d
        ));
    };

    // Handler for finalizing draft
    const handleFinalizeDraft = async (e) => {
        // Prevent default behavior
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!currentDraftSaveId) {
            setWarning('Please save the draft before finalizing');
            return;
        }

        if (!validateGMAssignments()) {
            return;
        }

        // Check for unresolved duplicates
        const allPlayers = [...playerPool];
        teams.forEach(t => {
            if (t.players) allPlayers.push(...t.players);
        });
        
        const duplicates = allPlayers.filter(p => p.potentialMatchFound && !p.duplicateResolved);
        if (duplicates.length > 0) {
            setDuplicatePlayersToResolve(duplicates.map(d => ({ ...d, resolveAction: 'update' })));
            setShowDuplicateResolutionModal(true);
            return;
        }

        // Show confirmation modal instead of window.confirm
        setShowFinalizeDraftConfirm(true);
    };

    // Perform the actual finalization (called after confirmation)
    const performFinalizeDraft = async () => {
        setShowFinalizeDraftConfirm(false);

        try {
            const response = await fetch(
                `${API_BASE_URL}/league/draft/${currentDraftSaveId}/finalize`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                setWarning(error.error || 'Failed to finalize draft');
                return;
            }

            const result = await response.json();
            setWarning(`✅ Draft finalized successfully! Season ID: ${result.seasonId}`);
            setIsLive(false);
        } catch (error) {
            setWarning(`Error finalizing draft: ${error.message}`);
        }
    };

    // Export draft to CSV
    const handleExportCSV = () => {
        // Headers
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Team Name,Team Abbr,Is GM,First Name,Last Name,Position,Skill Rating,Status,Email,Buddy\n";

        // Rows
        teams.forEach(team => {
            team.players.forEach(player => {
                const row = [
                    `"${team.name}"`, // Quote to handle commas in names
                    team.abbreviation || generateAbbreviation(team.name),
                    player.isGm ? "Yes" : "No",
                    `"${player.firstName}"`,
                    `"${player.lastName}"`,
                    player.position,
                    player.skillRating,
                    player.status || (player.isVeteran ? "Veteran" : "Rookie"),
                    player.email,
                    player.buddyPick || ""
                ];
                csvContent += row.join(",") + "\n";
            });
        });

        // Download trigger
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `OBHL_Draft_${seasonName}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateAbbreviation = (name) => {
        return name ? name.substring(0, 3).toUpperCase() : "";
    };

    // Handler for canceling finalize draft from modal
    const cancelFinalizeDraft = () => {
        setShowFinalizeDraftConfirm(false);
    };

    const handleResumeDraft = async () => {
        if (!savedDraft) return;

        try {
            const data = JSON.parse(savedDraft.draftData);

            // Restore team colors and sort options FIRST
            const colors = {};
            const sortOpts = {};
            data.teams.forEach(team => {
                colors[team.id] = team.color;
                sortOpts[team.id] = team.sortOption;
            });

            setTeamColors(colors);
            setTeamSortOptions(sortOpts);

            // Then restore other state
            setSeasonName(data.seasonName);
            setSelectedSeasonId(data.seasonId || null);
            setTeamCount(data.teamCount);
            setIsLive(data.isLive || false);
            setTeams(data.teams);
            setPlayerPool(data.playerPool || []);

            setCurrentDraftSaveId(savedDraft.id);
            setShowResumePrompt(false);
            setWarning('Draft resumed successfully!');
        } catch (error) {
            console.error('Error resuming draft:', error);
            setWarning('Error resuming draft');
        }
    };

    const handleStartNewDraft = (e) => {
        // Prevent default form submission or other browser behavior
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // If there's data to clear, show confirmation modal
        if (isLive || playerPool.length > 0 || teams.length > 0) {
            setShowNewDraftConfirm(true);
        } else {
            // No data, proceed directly
            performNewDraftReset();
        }
    };

    // Perform the actual reset (called after confirmation)
    const performNewDraftReset = () => {
        setShowResumePrompt(false);
        setSavedDraft(null);
        setCurrentDraftSaveId(null);

        // Full Hard Reset
        setSeasonName('');
        setSelectedSeasonId(null);
        setIsLive(false);
        setPlayerPool([]);
        setTeams([]);
        setHistory([]);
        setTeamColors({});
        setTeamSortOptions({});
        setBuddyPickMap({});
        setWarning('');

        // Reset team count to default
        setTeamCount(4);
    };

    // Handler for confirming new draft from modal
    const confirmNewDraft = () => {
        setShowNewDraftConfirm(false);
        performNewDraftReset();
    };

    // Handler for canceling new draft from modal
    const cancelNewDraft = () => {
        setShowNewDraftConfirm(false);
    };



    const fallbackDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };

    const handleDownloadTemplate = async () => {
        console.log('Generating Excel template using SheetJS...');

        try {
            // Create template data with sample rows
            const templateData = [
                {
                    'First Name': 'John',
                    'Last Name': 'Smith',
                    'Email': 'john.smith@example.com',
                    'preferred position': 'Forward',
                    'Skill Rating': '7',
                    'Veteran Status': 'veteran',
                    'Buddy Pick': '',
                    'Ref': 'n',
                    'GM': 'n'
                },
                {
                    'First Name': 'Jane',
                    'Last Name': 'Doe',
                    'Email': 'jane.doe@example.com',
                    'preferred position': 'Defense',
                    'Skill Rating': '5',
                    'Veteran Status': 'rookie',
                    'Buddy Pick': '',
                    'Ref': 'n',
                    'GM': 'y'
                },
                {
                    'First Name': 'New',
                    'Last Name': 'Player',
                    'Email': 'new.player@example.com',
                    'preferred position': 'Forward',
                    'Skill Rating': 'unknown',
                    'Veteran Status': 'rookie',
                    'Buddy Pick': '',
                    'Ref': 'n',
                    'GM': 'n'
                }
            ];

            // Convert JSON data to worksheet
            const worksheet = XLSX.utils.json_to_sheet(templateData);

            // Create new workbook and append worksheet
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Player Template');

            // Set column widths for better readability
            worksheet['!cols'] = [
                { wch: 15 }, // First Name
                { wch: 15 }, // Last Name
                { wch: 25 }, // Email
                { wch: 20 }, // preferred position
                { wch: 12 }, // Skill Rating
                { wch: 15 }, // Veteran Status
                { wch: 15 }, // Buddy Pick
                { wch: 5 },  // Ref
                { wch: 5 }   // GM
            ];

            // Define a fallback download function for browsers that don't support File System Access API
            const fallbackDownload = (blob, filename) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
                console.log('Fallback download triggered successfully!');
            };

            // Generate the file using File System Access API for Save As dialog
            const filename = 'Hockey_Draft_Template.xlsx';

            // Write to array buffer
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // Check if File System Access API is supported
            if (window.showSaveFilePicker) {
                try {
                    // Show Save As dialog
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'Excel Files',
                            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                        }]
                    });

                    // Write the file
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    console.log('Template saved successfully!');
                    alert('Template saved successfully!');
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.log('User cancelled the save dialog');
                    } else {
                        console.error('Error saving file:', err);
                        alert('Error saving file. Falling back to automatic download...');
                        // Fallback to blob download
                        fallbackDownload(blob, filename);
                    }
                }
            } else {
                // Fallback for browsers that don't support File System Access API
                console.log('File System Access API not supported, using fallback download');
                fallbackDownload(blob, filename);
            }

            console.log('Template generation complete!');

        } catch (error) {
            console.error('Error generating template:', error);
            alert('Failed to generate template. Please check the console for details.');
        }
    };

    // Drag and Drop Logic
    const handleDragStart = (e, player, source) => {
        e.dataTransfer.setData('player', JSON.stringify(player));
        e.dataTransfer.setData('source', source);
    };

    const handleDrop = (e, targetTeamId) => {
        e.preventDefault();
        const draggedPlayer = JSON.parse(e.dataTransfer.getData('player'));
        const source = e.dataTransfer.getData('source');

        // Get the current player data from state (not stale drag data)
        let currentPlayer = draggedPlayer;
        if (source === 'pool') {
            const poolPlayer = playerPool.find(p => p.email === draggedPlayer.email);
            if (poolPlayer) currentPlayer = poolPlayer;
        } else {
            const sourceTeamId = parseInt(source.split('-')[1]);
            const sourceTeam = teams.find(t => t.id === sourceTeamId);
            if (sourceTeam) {
                const teamPlayer = sourceTeam.players.find(p => p.email === draggedPlayer.email);
                if (teamPlayer) currentPlayer = teamPlayer;
            }
        }

        if (targetTeamId === 'pool') {
            // Moving player back to pool
            if (source === 'pool') return;

            saveHistory(); // Save state before mutation

            const sourceTeamId = parseInt(source.split('-')[1]);
            setTeams(prev => prev.map(t =>
                t.id === sourceTeamId
                    ? { ...t, players: t.players.filter(p => p.email !== currentPlayer.email) }
                    : t
            ));
            setPlayerPool(prev => [...prev, currentPlayer]);
        } else {
            // Moving player to a team - check for buddy picks using CURRENT player data
            // Gather all chained buddies recursively (similar to wizard) to be safe?
            // For now, stick to direct & reverse picks as per original logic, 
            // but finding them in BOTH pool and source team.

            const buddyEmails = buddyPickMap[currentPlayer.email] || [];

            // Also check for "reverse" buddy picks
            const reverseBuddyEmails = [];
            Object.entries(buddyPickMap).forEach(([email, picks]) => {
                if (picks.includes(currentPlayer.email) && !buddyEmails.includes(email)) {
                    reverseBuddyEmails.push(email);
                }
            });

            // Combine both lists
            const allPotentialBuddyEmails = [...buddyEmails, ...reverseBuddyEmails];

            if (allPotentialBuddyEmails.length > 0) {
                // Find these buddies in Pool OR Source Team
                let availableBuddies = [];

                // 1. Check Pool
                const poolBuddies = playerPool.filter(p => allPotentialBuddyEmails.includes(p.email));
                availableBuddies = [...poolBuddies];

                // 2. Check Source Team (if source is a team)
                if (source !== 'pool') {
                    const sourceTeamId = parseInt(source.split('-')[1]);
                    const sourceTeam = teams.find(t => t.id === sourceTeamId);
                    if (sourceTeam) {
                        const teamBuddies = sourceTeam.players.filter(p => allPotentialBuddyEmails.includes(p.email));
                        // Avoid duplicates if weird state
                        teamBuddies.forEach(tb => {
                            if (!availableBuddies.some(ab => ab.email === tb.email)) {
                                availableBuddies.push(tb);
                            }
                        });
                    }
                }

                if (availableBuddies.length > 0) {
                    // Show modal to let user select which buddies to add
                    setModalPlayer(currentPlayer);
                    setModalTargetTeam(targetTeamId);
                    setModalSource(source); // Capture source
                    setModalBuddies(availableBuddies);
                    setSelectedBuddies(availableBuddies.map(b => b.email)); // Pre-select all
                    setShowBuddyModal(true);

                    // Don't move the player yet - wait for modal confirmation
                    return;
                }
            }

            // No buddy picks or no available buddies - proceed normally
            completeDrop(currentPlayer, source, targetTeamId);
        }
    };

    // Complete the drop operation (called directly or after modal confirmation)
    const completeDrop = (player, source, targetTeamId, additionalPlayers = []) => {
        saveHistory(); // Save state before mutation

        const allPlayersToMove = [player, ...additionalPlayers];
        const allEmails = allPlayersToMove.map(p => p.email);

        // 1. Update Player Pool: Remove ANY players that are currently in the pool
        setPlayerPool(prev => prev.filter(p => !allEmails.includes(p.email)));

        // 2. Update Teams: Remove from ANY source team and Add to Target Team
        setTeams(prev => {
            const updatedTeams = prev.map(team => {
                let newPlayers = [...team.players];

                // Remove moving players from this team (so we don't duplicate if moving between teams)
                newPlayers = newPlayers.filter(p => !allEmails.includes(p.email));

                // If this is the target team, add all players
                if (team.id === targetTeamId) {
                    newPlayers = [...newPlayers, ...allPlayersToMove];
                }

                return { ...team, players: newPlayers };
            });

            // 3. Sort Target Team by Average Rating
            return updatedTeams.map(team => {
                if (team.id === targetTeamId) {
                    const getAvg = (players) => {
                        if (!players || players.length === 0) return 0;
                        const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
                        return total / players.length;
                    };
                    // We need to sort the Teams ARRAY? No, user wants Players sorted within team?
                    // Wait, "automatic sorting of teams by average skill rating" -> Sort the TEAMS list order?
                    // Re-reading Step 3012: "Implement automatic sorting of teams by average skill rating (lowest to highest) whenever the "Assign GMs" ... buttons are clicked".
                    // And "whenever a player is dropped onto a team".
                    // This implies sorting the TEAMS in the DASHBOARD view.
                    // Yes.
                    // So I need to sort `updatedTeams` Array.
                }
                return team;
            }).sort((a, b) => {
                const getAvg = (players) => {
                    if (!players || players.length === 0) return 0;
                    const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
                    return total / players.length;
                };
                return getAvg(a.players) - getAvg(b.players);
            });
        });
    };

    const handleDragOver = (e) => e.preventDefault();

    // Modal Handlers
    const toggleBuddySelection = (email) => {
        setSelectedBuddies(prev =>
            prev.includes(email)
                ? prev.filter(e => e !== email)
                : [...prev, email]
        );
    };

    const processNextInQueue = () => {
        const nextItem = buddyQueue[0];
        setBuddyQueue(prev => prev.slice(1));

        setModalPlayer(nextItem.gm);
        setModalTargetTeam(nextItem.teamId);
        setModalBuddies(nextItem.availableBuddies);
        setSelectedBuddies(nextItem.availableBuddies.map(p => p.email));
    };

    const handleSkipBuddies = () => {
        // If in queue mode, process next
        if (buddyQueue.length > 0) {
            processNextInQueue();
            return;
        }

        setShowBuddyModal(false);
        setModalPlayer(null);
        setModalTargetTeam(null);
        setModalSource(null);
        setModalBuddies([]);
        setSelectedBuddies([]);

        // If we were dragging a player (single drop), complete without buddies
        if (modalPlayer && modalTargetTeam) {
            // Check if player is already on target team
            const targetTeam = teams.find(t => t.id === modalTargetTeam);
            const isAlreadyOnTeam = targetTeam && targetTeam.players.some(p => p.email === modalPlayer.email);

            if (!isAlreadyOnTeam) {
                completeDrop(modalPlayer, modalSource || 'pool', modalTargetTeam, []);
            }
        }
    };

    const handleConfirmBuddies = () => {
        if (!modalPlayer || !modalTargetTeam) return;

        const playersToAdd = modalBuddies.filter(b => selectedBuddies.includes(b.email));

        completeDropWithWizardCheck(modalPlayer, modalSource || 'pool', modalTargetTeam, playersToAdd);

        // If in queue mode, process next
        if (buddyQueue.length > 0) {
            processNextInQueue();
        } else {
            setShowBuddyModal(false);
            setModalPlayer(null);
            setModalTargetTeam(null);
            setModalSource(null);
            setModalBuddies([]);
            setSelectedBuddies([]);
        }
    };

    const completeDropWithWizardCheck = (player, source, targetTeamId, buddies) => {
        // Check if player is already on team (e.g. from Auto-Assign GM)
        const targetTeam = teams.find(t => t.id === targetTeamId);
        const isAlreadyOnTeam = targetTeam && targetTeam.players.some(p => p.email === player.email);

        if (isAlreadyOnTeam) {
            saveHistory(); // Save state before mutation

            // Just add buddies to the team and remove from wherever they are
            if (buddies.length > 0) {
                const buddyEmails = buddies.map(b => b.email);

                // 1. Remove buddies from Pool
                setPlayerPool(prev => prev.filter(p => !buddyEmails.includes(p.email)));

                // 2. Remove buddies from Source teams (including 'source' argued, but generic search is safer)
                setTeams(prev => {
                    const updatedTeams = prev.map(t => {
                        let newPlayers = t.players;

                        // Remove buddies if present
                        if (newPlayers.some(p => buddyEmails.includes(p.email))) {
                            newPlayers = newPlayers.filter(p => !buddyEmails.includes(p.email));
                        }

                        // Add buddies if target team
                        if (t.id === targetTeamId) {
                            newPlayers = [...newPlayers, ...buddies];
                        }

                        return { ...t, players: newPlayers };
                    });

                    return updatedTeams.sort((a, b) => {
                        const getAvg = (players) => {
                            if (!players || players.length === 0) return 0;
                            const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
                            return total / players.length;
                        };
                        return getAvg(a.players) - getAvg(b.players);
                    });
                });
            }
        } else {
            // Standard drop logic (Player + Buddies moving together)
            completeDrop(player, source, targetTeamId, buddies);
        }
    };

    // Update buddy pick map when a player's buddy pick field is edited
    const updateBuddyPickMapForPlayer = (playerEmail, newBuddyPickValue) => {
        // Build name→email lookup from all players (pool + teams)
        const allPlayers = [...playerPool];
        teams.forEach(team => {
            allPlayers.push(...team.players);
        });

        const nameToEmail = {};
        allPlayers.forEach(player => {
            const fullName = `${player.firstName} ${player.lastName}`.toLowerCase().trim();
            nameToEmail[fullName] = player.email;
        });

        // Parse new buddy pick value
        const newBuddyEmails = [];
        if (newBuddyPickValue && newBuddyPickValue.trim() !== '') {
            const buddyNames = newBuddyPickValue.split(',').map(name => name.trim().toLowerCase());
            buddyNames.forEach(name => {
                const email = nameToEmail[name];
                if (email) {
                    newBuddyEmails.push(email);
                }
            });
        }

        // Update the buddy pick map
        setBuddyPickMap(prev => {
            const updated = { ...prev };

            if (newBuddyEmails.length > 0) {
                // Add or update the entry
                updated[playerEmail] = newBuddyEmails;
            } else {
                // Remove the entry if no buddies
                delete updated[playerEmail];
            }

            return updated;
        });
    };

    // Player field updates
    const updatePlayerField = (playerEmail, field, value, source, teamId = null) => {
        saveHistory(); // Save state before mutation

        // If updating buddyPick field, update the buddy pick map
        if (field === 'buddyPick') {
            updateBuddyPickMapForPlayer(playerEmail, value);
        }

        if (source === 'pool') {
            setPlayerPool(prev => prev.map(p =>
                p.email === playerEmail ? { ...p, [field]: value } : p
            ));
        } else {
            setTeams(prev => prev.map(t =>
                t.id === teamId
                    ? { ...t, players: t.players.map(p => p.email === playerEmail ? { ...p, [field]: value } : p) }
                    : t
            ));
        }
    };

    // Calculate team statistics
    const calculateTeamStats = (players) => {
        if (players.length === 0) return { forwards: 0, defense: 0, avgF: 0, avgD: 0, total: 0, avg: 0 };

        const forwards = players.filter(p => p.position === 'Forward');
        const defense = players.filter(p => p.position === 'Defense');

        const avgF = forwards.length > 0
            ? (forwards.reduce((sum, p) => sum + (p.skillRating || 0), 0) / forwards.length).toFixed(1)
            : 0;
        const avgD = defense.length > 0
            ? (defense.reduce((sum, p) => sum + (p.skillRating || 0), 0) / defense.length).toFixed(1)
            : 0;
        const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
        const avg = (total / players.length).toFixed(1);

        return {
            forwards: forwards.length,
            defense: defense.length,
            avgF,
            avgD,
            total,
            avg
        };
    };

    // Sort team players
    const getSortedTeamPlayers = (players, sortOption) => {
        const sorted = [...players];

        // Helper to handle GM prioritization
        const compareWithGMPriority = (a, b, normalCompare) => {
            // GMs always come first
            if (a.isGm && !b.isGm) return -1;
            if (!a.isGm && b.isGm) return 1;
            // Valid comparison if neither or both are GMs
            return normalCompare(a, b);
        };

        switch (sortOption) {
            case 'Rating: High to Low':
                return sorted.sort((a, b) => compareWithGMPriority(a, b, (p1, p2) => (p2.skillRating || 0) - (p1.skillRating || 0)));
            case 'Rating: Low to High':
                return sorted.sort((a, b) => compareWithGMPriority(a, b, (p1, p2) => (p1.skillRating || 0) - (p2.skillRating || 0)));
            case 'Position':
                return sorted.sort((a, b) => compareWithGMPriority(a, b, (p1, p2) => p1.position.localeCompare(p2.position)));
            case 'Position + Rating':
                return sorted.sort((a, b) => compareWithGMPriority(a, b, (p1, p2) => {
                    if (p1.position !== p2.position) return p1.position.localeCompare(p2.position);
                    return (p2.skillRating || 0) - (p1.skillRating || 0);
                }));
            default:
                // Even for default sort, prioritize GMs
                return sorted.sort((a, b) => {
                    if (a.isGm && !b.isGm) return -1;
                    if (!a.isGm && b.isGm) return 1;
                    return 0;
                });
        }
    };

    // Filtering & Sorting Logic for Player Pool
    const getFilteredPlayers = () => {
        let filtered = [...playerPool];

        // Search text filtering
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.firstName && p.firstName.toLowerCase().includes(query)) ||
                (p.lastName && p.lastName.toLowerCase().includes(query))
            );
        }

        switch (filter) {
            case 'Forwards':
                filtered = filtered.filter(p => p.position === 'Forward');
                break;
            case 'Defense':
                filtered = filtered.filter(p => p.position === 'Defense');
                break;
            case 'Refs':
                filtered = filtered.filter(p => p.isRef);
                break;
            case 'GMs':
                filtered = filtered.filter(p => p.isGm);
                break;
            case 'Has Buddy':
                filtered = filtered.filter(p => p.buddyPick);
                break;
            default:
                break;
        }

        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortOption) {
                case 'Name':
                    comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                    break;
                case 'Position':
                    comparison = a.position.localeCompare(b.position);
                    break;
                case 'Skill':
                    comparison = (a.skillRating || 0) - (b.skillRating || 0);
                    break;
                case 'Veteran':
                    comparison = (b.isVeteran ? 1 : 0) - (a.isVeteran ? 1 : 0);
                    break;
                default:
                    break;
            }
            return sortAsc ? comparison : -comparison;
        });

        return filtered;
    };

    // Check if ready to start draft
    const isReadyToStart = () => {
        return seasonName.trim() !== '' && playerPool.length > 0 && !isLive;
    };

    // Render player card - Detailed View
    const renderPlayerCardDetailed = (player, source, teamId = null) => {
        const buddyNames = player.buddyPick ? player.buddyPick.split(',').map(b => b.trim()).join(', ') : '';

        return (
            <div
                key={player.email}
                className="player-card detailed"
                draggable={isLive}
                onDragStart={(e) => isLive ? handleDragStart(e, player, source) : null}
            >
                <div className="player-header">
                    <span className="player-name">{player.firstName} {player.lastName}</span>
                    <div className="player-badges">
                        <span
                            className={`badge ${player.isGm ? 'badge-gm' : 'badge-gm-inactive'}`}
                            onClick={() => updatePlayerField(player.email, 'isGm', !player.isGm, source, teamId)}
                            title="Click to toggle GM status"
                            style={{ cursor: 'pointer' }}
                        >
                            GM
                        </span>
                        <span
                            className={`badge ${player.isRef ? 'badge-ref' : 'badge-ref-inactive'}`}
                            onClick={() => updatePlayerField(player.email, 'isRef', !player.isRef, source, teamId)}
                            title="Click to toggle Ref status"
                            style={{ cursor: 'pointer' }}
                        >
                            REF
                        </span>
                    </div>
                </div>
                <div className="player-field">
                    <label>Position:</label>
                    <select
                        value={player.position}
                        onChange={(e) => updatePlayerField(player.email, 'position', e.target.value, source, teamId)}
                        className="player-select"
                        disabled={!isLive}
                    >
                        <option value="Forward">Forward</option>
                        <option value="Defense">Defense</option>
                    </select>
                </div>
                <div className="player-field">
                    <label>Skill:</label>
                    <select
                        value={player.skillRating}
                        onChange={(e) => updatePlayerField(player.email, 'skillRating', parseInt(e.target.value), source, teamId)}
                        className="player-select"
                        disabled={!isLive}
                    >
                        {[...Array(10)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                    </select>
                </div>
                <div className="player-field">
                    <label>Status:</label>
                    <select
                        value={player.status || 'Rookie'}
                        onChange={(e) => updatePlayerField(player.email, 'status', e.target.value, source, teamId)}
                        className="player-select"
                        disabled={!isLive}
                    >
                        <option value="Veteran">Veteran</option>
                        <option value="Rookie">Rookie</option>
                    </select>
                </div>
                <div className="player-field">
                    <label>Buddies:</label>
                    <input
                        type="text"
                        value={player.buddyPick || ''}
                        onChange={(e) => updatePlayerField(player.email, 'buddyPick', e.target.value, source, teamId)}
                        placeholder="Enter buddy names"
                        className="player-select"
                        style={{ flex: 1 }}
                        disabled={!isLive}
                    />
                </div>
            </div>
        );
    };

    // Render player card - Balanced View
    const renderPlayerCardBalanced = (player, source, teamId = null) => {
        const buddyNames = player.buddyPick ? player.buddyPick.split(',').map(b => b.trim()).join(', ') : '';

        return (
            <div
                key={player.email}
                className="player-card balanced"
                draggable={isLive}
                onDragStart={(e) => isLive ? handleDragStart(e, player, source) : null}
            >
                <div className="player-info-balanced">
                    <span className="player-name-balanced">
                        {player.firstName.charAt(0)}. {player.lastName}
                    </span>
                    <span className="player-stats-balanced">
                        {player.position.charAt(0)}:{player.skillRating}
                    </span>
                    <div className="player-badges-balanced">
                        {player.status === 'Veteran' && <span className="badge badge-vet-balanced">V</span>}
                        {player.isGm && <span className="badge badge-gm-balanced">GM</span>}
                        {player.isRef && <span className="badge badge-ref-balanced">REF</span>}
                    </div>
                    {buddyNames && <span className="buddy-balanced" title={`Buddy: ${buddyNames}`}>🤝</span>}
                </div>
            </div>
        );
    };

    // Render player card - Overview View
    const renderPlayerCardOverview = (player, source, teamId = null) => {
        const initials = `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`;
        const posIcon = player.position === 'Forward' ? 'F' : 'D';

        return (
            <div
                key={player.email}
                className="player-card overview"
                draggable={isLive}
                onDragStart={(e) => isLive ? handleDragStart(e, player, source) : null}
                title={`${player.firstName} ${player.lastName} - ${player.position} (${player.skillRating}) - ${player.status || 'Rookie'}`}
            >
                <span className="player-initials">{initials}</span>
                <span className="player-pos-icon">{posIcon}</span>
                <span className="player-rating">{player.skillRating}</span>
                {player.isGm && <span className="badge-mini badge-gm-mini">GM</span>}
                {player.isRef && <span className="badge-mini badge-ref-mini">R</span>}
            </div>
        );
    };

    // Main render function that delegates to the appropriate view
    const renderPlayerCard = (player, source, teamId = null) => {
        switch (viewMode) {
            case 'detailed':
                return renderPlayerCardDetailed(player, source, teamId);
            case 'balanced':
                return renderPlayerCardBalanced(player, source, teamId);
            case 'overview':
                return renderPlayerCardOverview(player, source, teamId);
            default:
                return renderPlayerCardBalanced(player, source, teamId);
        }
    };

    // Check if we should show "Assign GMs" button
    const shouldShowAssignGMs = () => {
        // Show if ANY team is missing a GM
        return teams.some(team => !team.players.some(p => p.isGm));
    };

    // Check if we should show "Assign GM Buddies" button
    const shouldShowAssignGMBuddies = () => {
        // Show if there are any GMs on teams whose buddies are still in the pool
        // This is a simplified check. A more robust one mimics `handleAssignGMBuddies` logic without side effects.

        let hasWorkToDo = false;

        // Iterate teams to find GMs
        teams.forEach(team => {
            if (hasWorkToDo) return;
            const gms = team.players.filter(p => p.isGm);

            gms.forEach(gm => {
                if (hasWorkToDo) return;
                const buddies = buddyPickMap[gm.email] || [];
                // Check if any direct buddy is in the pool
                const buddyInPool = buddies.some(email => playerPool.some(p => p.email === email));
                if (buddyInPool) hasWorkToDo = true;
            });
        });

        return hasWorkToDo;
    };

    const handleCancelDrop = () => {
        // Cancel the current action (whether from Queue or Drag)
        // Does NOT add player to team.
        setShowBuddyModal(false);
        setModalPlayer(null);
        setModalTargetTeam(null);
        setModalSource(null);
        setModalBuddies([]);
        setSelectedBuddies([]);

        // If in wizard, we might want to stop? 
        // User said "cancel the action of moving...". 
        // If it's a wizard flow, "Cancel" implies aborting the wizard or skipping?
        // Let's assume Abort Wizard for safety, user can restart.
        setBuddyQueue([]);
    };

    return (
        <div className={`draft-dashboard ${viewMode}`}>
            {/* Unsaved Changes Navigation Guard Modal */}
            {blocker.state === 'blocked' && (
                <div className="resume-modal-overlay">
                    <div className="resume-modal-content">
                        <h2>⚠️ Unsaved Draft Changes</h2>
                        <p>
                            You have unsaved changes to your draft. If you leave now, any picks made since
                            your last save will be lost.
                        </p>
                        <div className="resume-modal-actions">
                            <button
                                className="btn-draft btn-start"
                                onClick={async () => {
                                    const saved = await handleSaveDraft();
                                    if (saved) blocker.proceed();
                                }}
                            >
                                Save &amp; Leave
                            </button>
                            <button
                                className="btn-draft"
                                style={{ backgroundColor: '#e74c3c' }}
                                onClick={() => blocker.proceed()}
                            >
                                Leave Without Saving
                            </button>
                            <button
                                className="btn-draft btn-secondary"
                                onClick={() => blocker.reset()}
                            >
                                Stay on Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resume Draft Prompt Modal */}
            {showResumePrompt && savedDraft && (
                <div className="resume-modal-overlay">
                    <div className="resume-modal-content">
                        <h2>Resume Draft?</h2>
                        <p>
                            Found saved draft: <strong>{JSON.parse(savedDraft.draftData).seasonName}</strong>
                            <br />
                            Last saved: {new Date(savedDraft.updatedAt).toLocaleString()}
                        </p>
                        <div className="resume-modal-actions">
                            <button
                                className="btn-draft btn-start"
                                onClick={handleResumeDraft}
                            >
                                Resume Draft
                            </button>
                            <button
                                className="btn-draft btn-secondary"
                                onClick={handleStartNewDraft}
                            >
                                Start New Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Draft Confirmation Modal */}
            {showNewDraftConfirm && (
                <div className="resume-modal-overlay">
                    <div className="resume-modal-content">
                        <h2>Start New Draft?</h2>
                        <p>
                            <strong>Warning:</strong> This will completely clear all current players, teams, and progress.
                            <br />
                            Any unsaved changes will be lost.
                        </p>
                        <div className="resume-modal-actions">
                            <button
                                className="btn-draft btn-secondary"
                                onClick={cancelNewDraft}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-draft btn-start"
                                onClick={confirmNewDraft}
                                style={{
                                    backgroundColor: '#eab308',
                                    border: '1px solid #ca8a04',
                                    color: '#000',
                                    fontWeight: '600'
                                }}
                            >
                                Start New Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Finalize Draft Confirmation Modal */}
            {showFinalizeDraftConfirm && (
                <div className="resume-modal-overlay">
                    <div className="resume-modal-content">
                        <h2>Finalize Draft?</h2>
                        <p>
                            Are you sure you want to finalize the draft for <strong>"{seasonName}"</strong>?
                            <br />
                            <br />
                            This will create the season, teams, and players in the database.
                            <br />
                            This action cannot be undone.
                        </p>
                        <div className="resume-modal-actions">
                            <button
                                className="btn-draft btn-secondary"
                                onClick={cancelFinalizeDraft}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-draft btn-finalize"
                                onClick={performFinalizeDraft}
                            >
                                Finalize Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Controls */}
            <div className="draft-controls">
                <div className="control-group">
                    <select
                        className="draft-input"
                        value={selectedSeasonId || ''}
                        onChange={(e) => {
                            const id = e.target.value ? Number(e.target.value) : null;
                            setSelectedSeasonId(id);
                            const season = availableSeasons.find(s => s.id === id);
                            setSeasonName(season ? season.name : '');
                        }}
                        disabled={isLive || seasonsLoading}
                        style={{ minWidth: '200px' }}
                        title="Select a season from the database"
                    >
                        {seasonsLoading ? (
                            <option value="">Loading seasons...</option>
                        ) : availableSeasons.length === 0 ? (
                            <option value="">No active or upcoming seasons</option>
                        ) : (
                            <>
                                <option value="">-- Select a Season --</option>
                                {availableSeasons.map(season => (
                                    <option key={season.id} value={season.id}>
                                        {season.name} ({season.status})
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                    <button
                        className="btn-draft btn-create-season"
                        onClick={() => setShowCreateSeasonModal(true)}
                        disabled={isLive}
                        title="Create a new season without leaving the draft tool"
                    >
                        + New Season
                    </button>
                    <select
                        className="draft-input"
                        value={teamCount}
                        onChange={(e) => setTeamCount(e.target.value)}
                        disabled={isLive}
                    >
                        {[...Array(14)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1} Teams</option>
                        ))}
                    </select>
                    <div className="view-mode-selector">
                        <span className="view-mode-label">View:</span>
                        <button
                            className={`view-mode-option ${viewMode === 'detailed' ? 'active' : ''}`}
                            onClick={() => setViewMode('detailed')}
                        >
                            Detailed
                        </button>
                        <button
                            className={`view-mode-option ${viewMode === 'balanced' ? 'active' : ''}`}
                            onClick={() => setViewMode('balanced')}
                        >
                            Balanced
                        </button>
                        <button
                            className={`view-mode-option ${viewMode === 'overview' ? 'active' : ''}`}
                            onClick={() => setViewMode('overview')}
                        >
                            Overview
                        </button>
                    </div>
                    <div className="view-mode-selector">
                        <span className="view-mode-label">Zoom:</span>
                        <button
                            className="view-mode-option"
                            onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))}
                            title="Zoom Out"
                        >
                            -
                        </button>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e0', padding: '0 0.2rem', minWidth: '40px', textAlign: 'center' }}>
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                            className="view-mode-option"
                            onClick={() => setZoomLevel(z => Math.min(1.5, z + 0.1))}
                            title="Zoom In"
                        >
                            +
                        </button>
                        <button
                            className="view-mode-option"
                            onClick={() => setZoomLevel(1)}
                            title="Reset Zoom"
                            style={{ marginLeft: '0.2rem' }}
                        >
                            ↺
                        </button>
                    </div>
                    {isReadyToStart() && (
                        <span className="ready-indicator">✓ Ready to start draft!</span>
                    )}
                </div>

                <div className="control-group">
                    {!isLive ? (
                        <button className="btn-draft btn-start" onClick={handleStartDraft}>Start Draft</button>
                    ) : (
                        <>
                            {shouldShowAssignGMs() && (
                                <button className="btn-draft btn-secondary" onClick={handleAssignGMs}>Assign GMs</button>
                            )}
                            {shouldShowAssignGMBuddies() && (
                                <button className="btn-draft btn-secondary" onClick={handleAssignGMBuddies}>Assign GM Buddies</button>
                            )}
                            <button
                                className="btn-draft btn-undo"
                                onClick={handleUndo}
                                disabled={history.length === 0}
                                title="Undo last action"
                                style={{
                                    opacity: history.length === 0 ? 0.5 : 1,
                                    cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                                    backgroundColor: history.length === 0 ? '#718096' : '#e53e3e',
                                    color: 'white',
                                    marginLeft: '0.5rem'
                                }}
                            >
                                Undo {history.length > 0 && `(${history.length})`}
                            </button>
                            {/* Export Button */}
                            <button
                                className="btn-draft"
                                onClick={handleExportCSV}
                                style={{ backgroundColor: '#10b981', color: 'white', marginLeft: '10px' }}
                                title="Download draft as CSV"
                            >
                                💾 Export CSV
                            </button>
                            <button className="btn-draft btn-save" onClick={handleSaveDraft}>Save Draft</button>
                            <button className="btn-draft btn-finalize" onClick={handleFinalizeDraft}>Finalize Draft</button>
                            <button
                                className="btn-draft btn-reset"
                                onClick={handleStartNewDraft}
                                style={{
                                    backgroundColor: '#eab308',
                                    border: '1px solid #ca8a04',
                                    color: '#000',
                                    fontWeight: '600',
                                    marginLeft: '1rem'
                                }}
                                title="Clear everything and start fresh"
                            >
                                New Draft
                            </button>
                        </>
                    )}
                    {/* Show New Draft button even if not live IF there's data (e.g. uploaded file but not started) */}
                    {!isLive && (playerPool.length > 0 || teams.length > 0) && (
                        <button
                            className="btn-draft btn-reset"
                            onClick={handleStartNewDraft}
                            style={{
                                backgroundColor: '#eab308',
                                border: '1px solid #ca8a04',
                                color: '#000',
                                fontWeight: '600',
                                marginLeft: '0.5rem'
                            }}
                            title="Clear everything and start fresh"
                        >
                            New Draft
                        </button>
                    )}
                    <button className="btn-draft btn-reset" onClick={handleReset}>Reset Draft</button>
                </div>

                {!isLive && (
                    <div className="menu-section">
                        <label className="btn-draft btn-secondary">
                            Upload File
                            <input type="file" hidden accept=".xlsx" onChange={(e) => handleFileUpload(e, 'registration')} disabled={isLive} />
                        </label>
                        <button className="btn-draft btn-secondary" onClick={handleDownloadTemplate}>Download Template</button>
                    </div>
                )}
            </div>

            {warning && (
                <div className="warnings-area visible">
                    <span className="warning-text">{warning}</span>
                    <button className="close-warning-btn" onClick={() => setWarning('')} title="Dismiss">×</button>
                </div>
            )}

            <div className="draft-workspace">
                {/* Left Column: Player Pool */}
                <div
                    className={`player-pool-container ${isPoolCollapsed ? 'collapsed' : ''}`}
                    onDrop={(e) => handleDrop(e, 'pool')}
                    onDragOver={handleDragOver}
                >
                    <div className="pool-header">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPoolCollapsed ? '0' : '0.75rem' }}>
                            {!isPoolCollapsed && <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Player Pool</h3>}
                            <button
                                onClick={() => setIsPoolCollapsed(!isPoolCollapsed)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#cbd5e0',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    fontSize: '1.2rem',
                                    lineHeight: 1,
                                    margin: isPoolCollapsed ? '0 auto' : '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title={isPoolCollapsed ? "Expand Pool" : "Collapse Pool"}
                            >
                                {isPoolCollapsed ? '▶' : '◀'}
                            </button>
                        </div>
                        {!isPoolCollapsed && (
                            <>
                                <div className="pool-search" style={{ marginBottom: '0.75rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Search players..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="draft-input"
                                        style={{ width: '100%', padding: '0.5rem', background: '#3a3a3a' }}
                                    />
                                </div>
                                <div className="pool-filters">
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.25rem' }}>FILTER</label>
                                    <select
                                        className="draft-input"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        {['All', 'Forwards', 'Defense', 'Refs', 'GMs', 'Has Buddy'].map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pool-sorting" style={{ marginTop: '0.5rem', display: 'block' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.25rem' }}>SORT</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select className="draft-input" value={sortOption} onChange={(e) => setSortOption(e.target.value)} style={{ flex: 1 }}>
                                            <option>Name</option>
                                            <option>Position</option>
                                            <option>Skill</option>
                                            <option>Veteran</option>
                                        </select>
                                        <button className="filter-btn" onClick={() => setSortAsc(!sortAsc)} style={{ padding: '0 0.5rem' }}>
                                            {sortAsc ? '↑' : '↓'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {!isPoolCollapsed && (
                        <div className="pool-list">
                            {getFilteredPlayers().map(player => renderPlayerCard(player, 'pool'))}
                        </div>
                    )}
                </div>

                {/* Main Area: Teams */}
                <div className="teams-area">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '1rem',
                        alignItems: 'stretch',
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: 'top left',
                        width: `${100 / zoomLevel}%`,
                        height: `${100 / zoomLevel}%`
                    }}>
                        {teams.map(team => {
                            const stats = calculateTeamStats(team.players);
                            const sortedPlayers = getSortedTeamPlayers(team.players, teamSortOptions[team.id] || 'Position + Rating');
                            const teamColor = TEAM_COLORS[teamColors[team.id]] || TEAM_COLORS['White'];

                            // Determine text color based on background
                            const textColor = (teamColors[team.id] === 'White' || teamColors[team.id] === 'Lt. Blue') ? '#000000' : '#ffffff';

                            return (
                                <div
                                    key={team.id}
                                    className={`draft-team-card ${viewMode}`}
                                    style={{ borderColor: teamColor, borderWidth: '3px' }}
                                    onDrop={(e) => handleDrop(e, team.id)}
                                    onDragOver={handleDragOver}
                                >
                                    <div className="team-header" style={{ backgroundColor: teamColor, color: textColor }}>
                                        {editingTeamId === team.id ? (
                                            <input
                                                type="text"
                                                value={team.name}
                                                onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                                                onBlur={() => setEditingTeamId(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') setEditingTeamId(null);
                                                }}
                                                autoFocus
                                                className="team-name-input"
                                                style={{ color: textColor }}
                                            />
                                        ) : (
                                            <h3
                                                onClick={() => setEditingTeamId(team.id)}
                                                style={{ cursor: 'text' }}
                                                title="Click to edit team name"
                                            >
                                                {team.name}
                                            </h3>
                                        )}
                                        <div className="team-controls">
                                            <select
                                                className="team-color-select"
                                                value={teamColors[team.id] || 'White'}
                                                onChange={(e) => handleTeamColorChange(team.id, e.target.value)}
                                            >
                                                {Object.keys(TEAM_COLORS).map(color => (
                                                    <option key={color} value={color}>{color}</option>
                                                ))}
                                            </select>
                                            <select
                                                className="team-sort-select"
                                                value={teamSortOptions[team.id] || 'Position + Rating'}
                                                onChange={(e) => handleTeamSortChange(team.id, e.target.value)}
                                            >
                                                {['Position + Rating', 'Position + Name', 'Rating Only', 'Name Only'].map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="team-stats">
                                        <div className="stat-row">
                                            <span>Players: {team.players.length}</span>
                                            <span>Skill: {stats.total}</span>
                                        </div>
                                        <div className="stat-row">
                                            <span>F/D: {stats.forwards}/{stats.defense}</span>
                                            <span>Avg: {stats.avg}</span>
                                        </div>
                                        <div className="stat-row" title="Average Rating (Forwards / Defense)">
                                            <span>Avg F/D: {stats.avgF} / {stats.avgD}</span>
                                        </div>
                                    </div>
                                    <div className="team-roster">
                                        {sortedPlayers.map(player => renderPlayerCard(player, `team-${team.id}`, team.id))}
                                        {team.players.length === 0 && <div className="roster-slot">Empty Slot</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Buddy Pick Modal */}
            {showBuddyModal && modalPlayer && (
                <div className="buddy-modal-overlay" onClick={handleSkipBuddies}>
                    <div className="buddy-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="buddy-modal-header">
                            <h3>{buddyQueue.length > 0 ? `Assign Buddies for GM (${buddyQueue.length + 1} Remaining)` : 'Buddy Picks Available'}</h3>
                            <p>{modalPlayer.firstName} {modalPlayer.lastName} has buddy picks!</p>
                        </div>

                        <div className="buddy-modal-body">
                            <p className="buddy-modal-instruction">
                                Select which buddies to add to the team:
                            </p>

                            {modalBuddies.map(buddy => {
                                const buddyHasPicks = buddyPickMap[buddy.email] && buddyPickMap[buddy.email].length > 0;
                                // Check if it's reciprocal: does the modal player ALSO pick this buddy back?
                                const modalPlayerPicks = buddyPickMap[modalPlayer.email] || [];
                                const isReciprocal = modalPlayerPicks.includes(buddy.email) && buddyHasPicks && buddyPickMap[buddy.email].includes(modalPlayer.email);

                                return (
                                    <div key={buddy.email} className="buddy-option">
                                        <label className="buddy-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={selectedBuddies.includes(buddy.email)}
                                                onChange={() => toggleBuddySelection(buddy.email)}
                                            />
                                            <div className="buddy-info">
                                                <div className="buddy-name-row">
                                                    <span className="buddy-name">{buddy.firstName} {buddy.lastName}</span>
                                                    {isReciprocal && <span className="reciprocal-badge">↔️ Reciprocal</span>}
                                                </div>
                                                <div className="buddy-details">
                                                    <span>{buddy.position}</span>
                                                    <span>•</span>
                                                    <span>Skill: {buddy.skillRating}</span>
                                                    {buddyHasPicks && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="buddy-has-picks" title={buddy.buddyPick}>
                                                                Picks: {buddy.buddyPick}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="buddy-modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={handleCancelDrop}
                                style={{ backgroundColor: '#e53e3e', color: 'white', marginRight: 'auto' }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={handleSkipBuddies}
                            >
                                {buddyQueue.length > 0 ? 'Skip & Next' : 'Skip Buddies'}
                            </button>
                            <button
                                className="btn-start"
                                onClick={handleConfirmBuddies}
                                disabled={selectedBuddies.length === 0}
                            >
                                {buddyQueue.length > 0 ? `Add & Next (${selectedBuddies.length})` : `Add Selected (${selectedBuddies.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create New Season Modal */}
            {showCreateSeasonModal && (
                <div className="modal-overlay" onClick={() => !newSeasonSaving && setShowCreateSeasonModal(false)}>
                    <div className="modal-content-light" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New Season</h3>
                            <button
                                className="modal-close"
                                onClick={() => setShowCreateSeasonModal(false)}
                                disabled={newSeasonSaving}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleCreateSeason} className="season-form">
                            <div className="form-group">
                                <label>Season Name</label>
                                <input
                                    type="text"
                                    value={newSeasonForm.name}
                                    onChange={(e) => setNewSeasonForm({ ...newSeasonForm, name: e.target.value })}
                                    required
                                    placeholder="e.g., 2026-2027 Season"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={newSeasonForm.startDate}
                                        onChange={(e) => setNewSeasonForm({ ...newSeasonForm, startDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={newSeasonForm.endDate}
                                        onChange={(e) => setNewSeasonForm({ ...newSeasonForm, endDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={newSeasonForm.status}
                                    onChange={(e) => setNewSeasonForm({ ...newSeasonForm, status: e.target.value })}
                                    required
                                >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="active">Active</option>
                                </select>
                            </div>
                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={newSeasonForm.isActive}
                                        onChange={(e) => setNewSeasonForm({ ...newSeasonForm, isActive: e.target.checked })}
                                    />
                                    Set as Active Season
                                </label>
                            </div>
                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowCreateSeasonModal(false)}
                                    disabled={newSeasonSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={newSeasonSaving}
                                >
                                    {newSeasonSaving ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Unrated Veterans Modal */}
            {showUnratedVeteransModal && (
                <div className="modal-overlay">
                    <div className="modal-content-light" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Missing Veteran Ratings</h3>
                        </div>
                        <div className="modal-body" style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ marginBottom: '15px' }}>
                                The following imported players are marked as Veterans but their skill ratings were not found in the database. Please assign them a skill rating before proceeding.
                            </p>
                            {unratedVeterans.map(uv => (
                                <div key={uv.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #ddd' }}>
                                    <div>
                                        <strong>{uv.firstName} {uv.lastName}</strong>
                                        <div style={{ fontSize: '12px', color: '#666' }}>{uv.position} • {uv.email}</div>
                                    </div>
                                    <div>
                                        <label style={{ marginRight: '10px' }}>Rating:</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="10" 
                                            value={uv.skillRating} 
                                            onChange={(e) => handleUnratedVeteranRatingChange(uv.email, e.target.value)}
                                            style={{ width: '60px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer" style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', gap: '10px' }}>
                            <button
                                className="btn-secondary"
                                onClick={handleCancelUnratedVeterans}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSaveUnratedVeterans}
                            >
                                Save Ratings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPotentialMatchesModal && (
                <div className="modal-overlay">
                    <div className="modal-content-light" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Potential Matches Found</h3>
                        </div>
                        <div className="modal-body" style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ marginBottom: '15px' }}>
                                The following players registered with a different email, but their names match existing profiles in the database. 
                                Do you want to use their existing database skill ratings for this draft?
                            </p>
                            {potentialMatches.map(pm => (
                                <div key={pm.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #ddd' }}>
                                    <div>
                                        <strong>{pm.firstName} {pm.lastName}</strong>
                                        <div style={{ fontSize: '12px', color: '#666' }}>New Email: {pm.email} • Old Email: {pm.potentialMatchEmail}</div>
                                        <div style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>Database Skill Rating: {pm.potentialMatchSkill}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                checked={pm.adoptRating === true}
                                                onChange={() => toggleAdoptPotentialMatch(pm.email, true)}
                                                style={{ marginRight: '5px' }}
                                            />
                                            Use Old Rating ({pm.potentialMatchSkill})
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                checked={pm.adoptRating === false}
                                                onChange={() => toggleAdoptPotentialMatch(pm.email, false)}
                                                style={{ marginRight: '5px' }}
                                            />
                                            No
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer" style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', gap: '10px' }}>
                            <button
                                className="btn-secondary"
                                onClick={handleCancelPotentialMatches}
                            >
                                Cancel Upload
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSavePotentialMatches}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDuplicateResolutionModal && (
                <div className="modal-overlay">
                    <div className="modal-content-light" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Resolve Duplicate Players</h3>
                        </div>
                        <div className="modal-body" style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ marginBottom: '15px' }}>
                                Before finalizing the draft, please confirm how you want to save the following players who registered with new emails.
                            </p>
                            {duplicatePlayersToResolve.map(d => (
                                <div key={d.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #ddd' }}>
                                    <div>
                                        <strong>{d.firstName} {d.lastName}</strong>
                                        <div style={{ fontSize: '12px', color: '#666' }}>New Email: {d.email}</div>
                                        <div style={{ fontSize: '12px', color: '#e67e22', fontWeight: 'bold' }}>Matched DB Profile: {d.potentialMatchEmail}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                checked={d.resolveAction === 'update'}
                                                onChange={() => toggleDuplicateResolutionAction(d.email, 'update')}
                                                style={{ marginRight: '5px' }}
                                            />
                                            Update Profile
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                checked={d.resolveAction === 'new'}
                                                onChange={() => toggleDuplicateResolutionAction(d.email, 'new')}
                                                style={{ marginRight: '5px' }}
                                            />
                                            Create New
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer" style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', gap: '10px' }}>
                            <button
                                className="btn-secondary"
                                onClick={handleCancelDuplicateResolution}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSaveDuplicateResolution}
                            >
                                Confirm & Finalize Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DraftDashboard;
