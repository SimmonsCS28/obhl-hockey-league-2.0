import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import DraftService from '../services/DraftService';
import './DraftDashboard.css';

const DraftDashboard = () => {
    // State
    const [seasonName, setSeasonName] = useState('');
    const [teamCount, setTeamCount] = useState(4);
    const [playerPool, setPlayerPool] = useState([]);
    const [teams, setTeams] = useState([]);
    const [isLive, setIsLive] = useState(false);
    const [warning, setWarning] = useState('');
    const [viewMode, setViewMode] = useState('balanced'); // 'detailed', 'balanced', 'overview'

    // Filters & Sorting
    const [filter, setFilter] = useState('All');
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

    // Check for saved drafts on mount
    useEffect(() => {
        checkForSavedDraft();
    }, []);

    // Rebuild buddy pick map when players move between pool and teams
    useEffect(() => {
        if (playerPool.length > 0 || teams.some(t => t.players && t.players.length > 0)) {
            buildBuddyPickMap(playerPool, teams);
        }
    }, [playerPool, teams]);

    const checkForSavedDraft = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/league/draft/latest');
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
        console.log('Buddy pick map built:', buddyMap);
    };

    // Handlers
    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (type === 'registration') {
                const players = await DraftService.uploadRegistration(file);
                setPlayerPool(players);

                // Build buddy pick map
                buildBuddyPickMap(players);

                setWarning('');
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

        setTeams(updatedTeams);
        setPlayerPool(updatedPool);
        setWarning(`Successfully assigned ${teamsWithoutGM.length} GMs to teams without GMs!`);
    };

    // Handler for assigning GM buddy picks to teams
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

        let totalAssigned = 0;
        let warnings = [];
        const updatedTeams = [...teams];

        // For each GM on a team, find and assign their buddies
        gmsOnTeams.forEach(({ gm, teamId }) => {
            const buddyEmails = buddyPickMap[gm.email];

            if (!buddyEmails || buddyEmails.length === 0) {
                return; // GM has no buddy picks
            }

            // Find buddies still in player pool
            const availableBuddies = buddyEmails
                .map(email => playerPool.find(p => p.email === email))
                .filter(buddy => buddy !== undefined);

            if (availableBuddies.length === 0) {
                warnings.push(`${gm.firstName} ${gm.lastName}'s buddies are already assigned or not found`);
                return;
            }

            // Assign buddies to the same team as the GM
            const teamIndex = updatedTeams.findIndex(t => t.id === teamId);
            if (teamIndex !== -1) {
                updatedTeams[teamIndex] = {
                    ...updatedTeams[teamIndex],
                    players: [...updatedTeams[teamIndex].players, ...availableBuddies]
                };
                totalAssigned += availableBuddies.length;
            }
        });

        if (totalAssigned === 0) {
            setWarning('No buddy picks were available to assign. ' + (warnings.length > 0 ? warnings.join('. ') : ''));
            return;
        }

        // Remove assigned buddies from player pool
        const assignedEmails = [];
        gmsOnTeams.forEach(({ gm }) => {
            const buddyEmails = buddyPickMap[gm.email] || [];
            assignedEmails.push(...buddyEmails);
        });
        const updatedPool = playerPool.filter(player => !assignedEmails.includes(player.email));

        setTeams(updatedTeams);
        setPlayerPool(updatedPool);

        let message = `Successfully assigned ${totalAssigned} buddy picks to GM teams!`;
        if (warnings.length > 0) {
            message += ` Note: ${warnings.join('. ')}`;
        }
        setWarning(message);
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
        // Validate GM assignments
        if (!validateGMAssignments()) {
            return;
        }

        try {
            const draftData = {
                seasonName,
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
                ? `http://localhost:8000/api/league/draft/save/${currentDraftSaveId}`
                : 'http://localhost:8000/api/league/draft/save';
            const method = currentDraftSaveId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draftData)
            });

            if (response.ok) {
                const result = await response.json();
                setCurrentDraftSaveId(result.id);
                const action = currentDraftSaveId ? 'updated' : 'saved';
                setWarning(`Draft "${seasonName}" ${action} successfully! (ID: ${result.id})`);
            } else {
                setWarning('Failed to save draft');
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            setWarning('Error saving draft. Check console for details.');
        }
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

    const handleStartNewDraft = () => {
        setShowResumePrompt(false);
        setSavedDraft(null);
        setCurrentDraftSaveId(null); // Clear ID so next save creates new draft
        // Keep current empty state
    };

    const handleFinalizeDraft = async () => {
        if (!currentDraftSaveId) {
            setWarning('Please save the draft first');
            return;
        }

        // Validate GM assignments
        if (!validateGMAssignments()) {
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:8000/api/league/draft/${currentDraftSaveId}/complete`,
                { method: 'PUT' }
            );

            if (response.ok) {
                setWarning('Draft finalized successfully!');
                setCurrentDraftSaveId(null);
            } else {
                setWarning('Failed to finalize draft');
            }
        } catch (error) {
            console.error('Error finalizing draft:', error);
            setWarning('Error finalizing draft');
        }
    };



    // Fallback download function for browsers without File System Access API
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
        const player = JSON.parse(e.dataTransfer.getData('player'));
        const source = e.dataTransfer.getData('source');

        if (targetTeamId === 'pool') {
            if (source === 'pool') return;
            const sourceTeamId = parseInt(source.split('-')[1]);
            setTeams(prev => prev.map(t =>
                t.id === sourceTeamId
                    ? { ...t, players: t.players.filter(p => p.email !== player.email) }
                    : t
            ));
            setPlayerPool(prev => [...prev, player]);
        } else {
            if (source === 'pool') {
                setPlayerPool(prev => prev.filter(p => p.email !== player.email));
            } else {
                const sourceTeamId = parseInt(source.split('-')[1]);
                setTeams(prev => prev.map(t =>
                    t.id === sourceTeamId
                        ? { ...t, players: t.players.filter(p => p.email !== player.email) }
                        : t
                ));
            }
            setTeams(prev => prev.map(t =>
                t.id === targetTeamId
                    ? { ...t, players: [...t.players, player] }
                    : t
            ));
        }
    };

    const handleDragOver = (e) => e.preventDefault();

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
        switch (sortOption) {
            case 'Rating: High to Low':
                return sorted.sort((a, b) => (b.skillRating || 0) - (a.skillRating || 0));
            case 'Rating: Low to High':
                return sorted.sort((a, b) => (a.skillRating || 0) - (b.skillRating || 0));
            case 'Position':
                return sorted.sort((a, b) => a.position.localeCompare(b.position));
            case 'Position + Rating':
                return sorted.sort((a, b) => {
                    if (a.position !== b.position) return a.position.localeCompare(b.position);
                    return (b.skillRating || 0) - (a.skillRating || 0);
                });
            default:
                return sorted;
        }
    };

    // Filtering & Sorting Logic for Player Pool
    const getFilteredPlayers = () => {
        let filtered = [...playerPool];

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

    return (
        <div className={`draft-dashboard ${viewMode}`}>
            {/* Resume Draft Prompt Modal */}
            {showResumePrompt && savedDraft && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Resume Draft?</h2>
                        <p>
                            Found saved draft: <strong>{JSON.parse(savedDraft.draftData).seasonName}</strong>
                            <br />
                            Last saved: {new Date(savedDraft.updatedAt).toLocaleString()}
                        </p>
                        <div className="modal-actions">
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

            {/* Top Controls */}
            <div className="draft-controls">
                <div className="control-group">
                    <input
                        type="text"
                        placeholder="Season Name"
                        className="draft-input"
                        value={seasonName}
                        onChange={(e) => setSeasonName(e.target.value)}
                        disabled={isLive}
                    />
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
                    {isReadyToStart() && (
                        <span className="ready-indicator">✓ Ready to start draft!</span>
                    )}
                </div>

                <div className="control-group">
                    {!isLive ? (
                        <button className="btn-draft btn-start" onClick={handleStartDraft}>Start Draft</button>
                    ) : (
                        <>
                            <button className="btn-draft btn-secondary" onClick={handleAssignGMs}>Assign GMs</button>
                            <button className="btn-draft btn-secondary" onClick={handleAssignGMBuddies}>Assign GM Buddies</button>
                            <button className="btn-draft btn-save" onClick={handleSaveDraft}>Save Draft</button>
                            <button className="btn-draft btn-finalize" onClick={handleFinalizeDraft}>Finalize Draft</button>
                        </>
                    )}
                    <button className="btn-draft btn-reset" onClick={handleReset}>Reset Draft</button>
                </div>

                <div className="menu-section">
                    <label className="btn-draft btn-secondary">
                        Upload File
                        <input type="file" hidden accept=".xlsx" onChange={(e) => handleFileUpload(e, 'registration')} disabled={isLive} />
                    </label>
                    <button className="btn-draft btn-secondary" onClick={handleDownloadTemplate}>Download Template</button>
                </div>
            </div>

            {warning && <div className="warnings-area visible">{warning}</div>}

            <div className="draft-workspace">
                {/* Left Column: Player Pool */}
                <div
                    className="player-pool-container"
                    onDrop={(e) => handleDrop(e, 'pool')}
                    onDragOver={handleDragOver}
                >
                    <div className="pool-header">
                        <div className="pool-filters">
                            {['All', 'Forwards', 'Defense', 'Refs', 'GMs', 'Has Buddy'].map(f => (
                                <button
                                    key={f}
                                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <div className="pool-sorting">
                            <select className="draft-input" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                                <option>Name</option>
                                <option>Position</option>
                                <option>Skill</option>
                                <option>Veteran</option>
                            </select>
                            <button className="filter-btn" onClick={() => setSortAsc(!sortAsc)}>
                                {sortAsc ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                    <div className="pool-list">
                        {getFilteredPlayers().map(player => renderPlayerCard(player, 'pool'))}
                    </div>
                </div>

                {/* Main Area: Teams */}
                <div className="teams-area">
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
                                            style={{ color: textColor, cursor: 'pointer' }}
                                            onClick={() => setEditingTeamId(team.id)}
                                            title="Click to edit team name"
                                        >
                                            {team.name}
                                        </h3>
                                    )}
                                    <div className="team-controls">
                                        <select
                                            value={teamColors[team.id] || 'White'}
                                            onChange={(e) => handleTeamColorChange(team.id, e.target.value)}
                                            className="team-color-select"
                                        >
                                            {Object.keys(TEAM_COLORS).map(color => (
                                                <option key={color} value={color}>{color}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={teamSortOptions[team.id] || 'Position + Rating'}
                                            onChange={(e) => handleTeamSortChange(team.id, e.target.value)}
                                            className="team-sort-select"
                                        >
                                            <option>Rating: High to Low</option>
                                            <option>Rating: Low to High</option>
                                            <option>Position</option>
                                            <option>Position + Rating</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="team-stats">
                                    <div className="stat-row">
                                        <span>Forwards:</span>
                                        <span>{stats.forwards}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span>Defense:</span>
                                        <span>{stats.defense}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span>Avg Fwd Rating:</span>
                                        <span>{stats.avgF}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span>Avg Def Rating:</span>
                                        <span>{stats.avgD}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span>Total Skill:</span>
                                        <span>{stats.total}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span>Avg Rating:</span>
                                        <span>{stats.avg}</span>
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
    );
};

export default DraftDashboard;
