import { useEffect, useState } from 'react';
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
    const [compactMode, setCompactMode] = useState(false);

    // Filters & Sorting
    const [filter, setFilter] = useState('All');
    const [sortOption, setSortOption] = useState('Name');
    const [sortAsc, setSortAsc] = useState(true);

    // Initialize Teams
    useEffect(() => {
        if (!isLive && teams.length !== parseInt(teamCount)) {
            const newTeams = Array.from({ length: parseInt(teamCount) }, (_, i) => ({
                id: i + 1,
                name: `Team ${i + 1}`,
                players: []
            }));
            setTeams(newTeams);
        }
    }, [teamCount, isLive]);

    // Handlers
    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (type === 'registration') {
                const players = await DraftService.uploadRegistration(file);
                setPlayerPool(players);
                setWarning('');
            } else if (type === 'draft') {
                const state = await DraftService.loadDraftState(file);
                setSeasonName(state.seasonName);
                setTeamCount(state.teamCount);
                setPlayerPool(state.playerPool);
                setTeams(state.teams);
                setIsLive(state.isLive);
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

    const handleAssignGMs = () => {
        const gms = playerPool.filter(p => p.isGm);
        if (gms.length === 0) {
            setWarning('No GMs found in the player pool.');
            return;
        }

        const newTeams = teams.map(t => ({ ...t, players: [...t.players] })); // Deep copy players array
        const assignedEmails = new Set();

        // Distribute GMs to teams (Round Robin)
        gms.forEach((gm, index) => {
            const teamIndex = index % newTeams.length;
            newTeams[teamIndex].players.push(gm);
            assignedEmails.add(gm.email);
        });

        setTeams(newTeams);
        setPlayerPool(prev => prev.filter(p => !assignedEmails.has(p.email)));
        setWarning(`Assigned ${gms.length} GMs to teams.`);
    };

    const handleSaveDraft = () => {
        const state = { seasonName, teamCount, playerPool, teams, isLive };
        DraftService.saveDraftState(state);
    };

    const handleFinalizeDraft = async () => {
        if (!window.confirm('Are you sure you want to finalize the draft? This will create the season and teams in the database.')) return;

        try {
            const state = { seasonName, teamCount, playerPool, teams, isLive };
            await DraftService.finalizeDraft(state);
            alert('Draft Finalized Successfully!');
            // Navigate or reset?
        } catch (error) {
            setWarning(`Finalization failed: ${error.message}`);
        }
    };

    const handleReset = () => {
        if (window.confirm('Reset everything? Unsaved progress will be lost.')) {
            setSeasonName('');
            setTeamCount(4);
            setPlayerPool([]);
            setIsLive(false);
            setWarning('');
        }
    };

    const handleDownloadTemplate = () => {
        // Logic to download the template file
        // For now, maybe a link to the public file if served, or generated
        alert("Template download not yet implemented (Backend needs to serve static file)");
    };

    // Drag and Drop Logic (Basic)
    const handleDragStart = (e, player, source) => {
        e.dataTransfer.setData('player', JSON.stringify(player));
        e.dataTransfer.setData('source', source); // 'pool' or 'team-X'
    };

    const handleDrop = (e, targetTeamId) => {
        e.preventDefault();
        const player = JSON.parse(e.dataTransfer.getData('player'));
        const source = e.dataTransfer.getData('source');

        // Remove from source
        if (source === 'pool') {
            setPlayerPool(prev => prev.filter(p => p.email !== player.email));
        } else if (source.startsWith('team-')) {
            const sourceTeamId = parseInt(source.split('-')[1]);
            setTeams(prev => prev.map(t => {
                if (t.id === sourceTeamId) {
                    return { ...t, players: t.players.filter(p => p.email !== player.email) };
                }
                return t;
            }));
        }

        // Add to target
        if (targetTeamId === 'pool') {
            setPlayerPool(prev => [...prev, player]);
        } else {
            setTeams(prev => prev.map(t => {
                if (t.id === targetTeamId) {
                    return { ...t, players: [...t.players, player] };
                }
                return t;
            }));
        }
    };

    const handleDragOver = (e) => e.preventDefault();

    // Filtering & Sorting Logic
    const getFilteredPlayers = () => {
        let result = [...playerPool];

        // Filter
        if (filter !== 'All') {
            if (filter === 'Forwards') result = result.filter(p => p.position === 'Forward' || p.position === 'F');
            if (filter === 'Defense') result = result.filter(p => p.position === 'Defense' || p.position === 'D');
            if (filter === 'Refs') result = result.filter(p => p.isRef);
            if (filter === 'GMs') result = result.filter(p => p.isGm);
            if (filter === 'Has Buddy') result = result.filter(p => p.buddyPick);
        }

        // Sort
        result.sort((a, b) => {
            let valA, valB;
            switch (sortOption) {
                case 'Name': valA = a.lastName; valB = b.lastName; break;
                case 'Position': valA = a.position; valB = b.position; break;
                case 'Skill': valA = a.skillRating; valB = b.skillRating; break;
                case 'Veteran': valA = a.isVeteran; valB = b.isVeteran; break;
                default: valA = a.lastName; valB = b.lastName;
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

        return result;
    };

    return (
        <div className={`draft-dashboard ${compactMode ? 'compact' : ''}`}>
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
                </div>

                <div className="control-group">
                    {!isLive ? (
                        <button className="btn-draft btn-start" onClick={handleStartDraft}>Start Draft</button>
                    ) : (
                        <>
                            <button className="btn-draft btn-secondary" onClick={handleAssignGMs}>Assign GMs</button>
                            <button className="btn-draft btn-save" onClick={handleSaveDraft}>Save Draft</button>
                            <button className="btn-draft btn-finalize" onClick={handleFinalizeDraft}>Finalize Draft</button>
                        </>
                    )}
                    <button className="btn-draft btn-reset" onClick={handleReset}>Reset</button>
                </div>

                <div className="control-group">
                    <label className="btn-draft btn-secondary">
                        Upload Reg
                        <input type="file" hidden accept=".xlsx" onChange={(e) => handleFileUpload(e, 'registration')} disabled={isLive} />
                    </label>
                    <label className="btn-draft btn-secondary">
                        Upload Draft
                        <input type="file" hidden accept=".json" onChange={(e) => handleFileUpload(e, 'draft')} disabled={isLive} />
                    </label>
                    <button className="btn-draft btn-secondary" onClick={handleDownloadTemplate}>Template</button>
                    <button className="btn-draft btn-secondary" onClick={() => setCompactMode(!compactMode)}>
                        {compactMode ? 'Expand' : 'Compact'}
                    </button>
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
                        {getFilteredPlayers().map(player => (
                            <div
                                key={player.email}
                                className="player-card"
                                draggable
                                onDragStart={(e) => handleDragStart(e, player, 'pool')}
                            >
                                <div className="player-info">
                                    <span className="player-name">{player.firstName} {player.lastName}</span>
                                    <span className="player-details">{player.position} | Skill: {player.skillRating}</span>
                                </div>
                                <div className="player-badges">
                                    {player.isVeteran && <span className="badge badge-vet">V</span>}
                                    {player.isGm && <span className="badge badge-gm">GM</span>}
                                    {player.buddyPick && <span className="badge badge-buddy">B</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Area: Teams */}
                <div className="teams-area">
                    {teams.map(team => (
                        <div
                            key={team.id}
                            className="draft-team-card"
                            onDrop={(e) => handleDrop(e, team.id)}
                            onDragOver={handleDragOver}
                        >
                            <div className="team-header">
                                <h3>{team.name}</h3>
                                <span>{team.players.length} Players</span>
                            </div>
                            <div className="team-roster">
                                {team.players.map(player => (
                                    <div
                                        key={player.email}
                                        className="player-card"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, player, `team-${team.id}`)}
                                    >
                                        <div className="player-info">
                                            <span className="player-name">{player.firstName} {player.lastName}</span>
                                            <span className="player-details">{player.position}</span>
                                        </div>
                                    </div>
                                ))}
                                {team.players.length === 0 && <div className="roster-slot">Empty Slot</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DraftDashboard;
