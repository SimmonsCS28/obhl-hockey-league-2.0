import { useEffect, useState } from 'react';
import * as api from '../services/api';
import { getPlayerStatsBulk } from '../services/api';
import './PlayerManagement.css';
import './UserManagement.css';

const AVAILABLE_ROLES = [
    { name: 'ADMIN', description: 'Full system access' },
    { name: 'GM', description: 'Team management' },
    { name: 'REF', description: 'Referee scheduling' },
    { name: 'SCOREKEEPER', description: 'Game scoring' },
    { name: 'GOALIE', description: 'Goalie scheduling' },
    { name: 'USER', description: 'Basic access' }
];

function PlayerManagement() {
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState('all');
    const [playerStats, setPlayerStats] = useState({});  // Map of playerId -> stats
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [playerToDelete, setPlayerToDelete] = useState(null);
    const [activeTeamsOnly, setActiveTeamsOnly] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState(null);
    const [formData, setFormData] = useState({
        seasonId: '',
        teamId: '',
        firstName: '',
        lastName: '',
        jerseyNumber: '',
        position: 'F',
        shoots: 'L',
        skillRating: 5,
        email: '',
        isVeteran: false,
        birthDate: '',
        hometown: '',
        isActive: true
    });
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [searchQuery, setSearchQuery] = useState('');
    const [alsoCreateUser, setAlsoCreateUser] = useState(false);
    const [userData, setUserData] = useState({
        username: '',
        email: '',
        password: '',
        roles: ['USER'],
        teamId: null
    });
    const [userPasswordError, setUserPasswordError] = useState('');
    const [hasMatchingUser, setHasMatchingUser] = useState(null); // null = not checked, true/false = result
    const [checkingCounterpart, setCheckingCounterpart] = useState(false);

    useEffect(() => {
        loadData();
    }, [selectedSeason]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [playersData, teamsData, seasonsData] = await Promise.all([
                api.getPlayers(selectedSeason !== 'all' ? { seasonId: selectedSeason } : {}),
                api.getTeams(),
                api.getSeasons()
            ]);
            setPlayers(playersData);
            setTeams(teamsData);
            setSeasons(seasonsData);

            // Fetch stats for selected season
            if (selectedSeason && selectedSeason !== 'all') {
                await fetchPlayerStats(selectedSeason);
            } else if (seasonsData.length > 0) {
                // If 'all', fetch stats for most recent season as default
                const mostRecentSeason = seasonsData[0];
                await fetchPlayerStats(mostRecentSeason.id);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayerStats = async (seasonId) => {
        try {
            const stats = await getPlayerStatsBulk(seasonId);
            // Create a map of playerId -> stats for easy lookup
            const statsMap = {};
            stats.forEach(stat => {
                statsMap[stat.playerId] = stat;
            });
            setPlayerStats(statsMap);
        } catch (error) {
            console.error('Failed to load player stats:', error);
        }
    };

    // Helper to get team name (moved up for sorting access)
    const getTeamName = (teamId) => {
        if (!teamId) return 'N/A';
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'N/A';
    };

    // Filter teams based on active status and season
    const filteredTeams = teams.filter(team => {
        const matchesActive = activeTeamsOnly ? team.active : true;
        const matchesSeason = formData.seasonId ? team.seasonId === parseInt(formData.seasonId) : true;
        return matchesActive && matchesSeason; // and move filteredTeams calculation after getTeamName just in case, though unrelated
    });

    // Filter players by search query
    const searchedPlayers = searchQuery.trim()
        ? players.filter(p => {
            const full = `${p.firstName} ${p.lastName}`.toLowerCase();
            return full.includes(searchQuery.trim().toLowerCase());
          })
        : players;

    // Sort players
    const sortedPlayers = [...searchedPlayers].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle special cases
        if (sortConfig.key === 'teamId') {
            aValue = getTeamName(a.teamId);
            bValue = getTeamName(b.teamId);
        }

        // Handle stats fields
        if (['goals', 'assists', 'points', 'penaltyMinutes'].includes(sortConfig.key)) {
            const aStats = playerStats[a.id] || {};
            const bStats = playerStats[b.id] || {};
            aValue = aStats[sortConfig.key] || 0;
            bValue = bStats[sortConfig.key] || 0;
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
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

    const validatePassword = (password) => {
        if (!password) return '';
        const minLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasSpecial = /[!@#$%^&*()\-_=+\[\]{}|;:',.<>?/~`]/.test(password);
        const noSpaces = !/\s/.test(password);
        if (!minLength) return 'Password must be at least 8 characters';
        if (!hasUppercase) return 'Password must contain at least 1 uppercase letter';
        if (!hasSpecial) return 'Password must contain at least 1 special character';
        if (!noSpaces) return 'Password cannot contain spaces';
        return '';
    };

    const handleUserChange = (field, value) => {
        setUserData(prev => ({ ...prev, [field]: value }));
        if (field === 'password') {
            setUserPasswordError(validatePassword(value));
        }
    };

    const handleUserRoleToggle = (roleName) => {
        setUserData(prev => ({
            ...prev,
            roles: prev.roles.includes(roleName)
                ? prev.roles.filter(r => r !== roleName)
                : [...prev.roles, roleName]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate user fields if also creating user
        if (alsoCreateUser) {
            if (!userData.username || !userData.email || !userData.password) {
                alert('Username, Email, and Password are required for the user');
                return;
            }
            if (!userData.roles || userData.roles.length === 0) {
                alert('Please select at least one role for the user');
                return;
            }
            const pwError = validatePassword(userData.password);
            if (pwError) {
                setUserPasswordError(pwError);
                return;
            }
        }

        try {
            // Prepare data with proper type conversions
            const playerData = {
                ...formData,
                jerseyNumber: formData.jerseyNumber ? parseInt(formData.jerseyNumber) : null,
                skillRating: formData.skillRating ? parseInt(formData.skillRating) : 5,
                teamId: formData.teamId ? parseInt(formData.teamId) : null,
                seasonId: formData.seasonId ? parseInt(formData.seasonId) : null,
                birthDate: formData.birthDate || null,
                hometown: formData.hometown || null
            };

            if (editingPlayer) {
                await api.updatePlayer(editingPlayer.id, playerData);

                // If creating a user from this player in edit mode
                if (alsoCreateUser) {
                    await api.createUser({
                        username: userData.username,
                        email: userData.email || formData.email,
                        password: userData.password,
                        roles: userData.roles,
                        teamId: userData.teamId
                    });
                }
            } else {
                // Create player first
                const createdPlayer = await api.createPlayer(playerData);

                // If also creating user, do that next
                if (alsoCreateUser) {
                    try {
                        await api.createUser({
                            username: userData.username,
                            email: userData.email || formData.email, // fall back to player email
                            password: userData.password,
                            roles: userData.roles,
                            teamId: userData.teamId
                        });
                    } catch (userErr) {
                        // Rollback: delete the player we just created
                        try {
                            await api.deletePlayer(createdPlayer.id);
                        } catch (rollbackErr) {
                            console.error('Rollback failed:', rollbackErr);
                        }
                        throw new Error(`User creation failed: ${userErr.message}. Player creation has been rolled back.`);
                    }
                }
            }
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving player:', error);
            alert(error.message || 'Failed to save player');
        }
    };

    const handleEdit = (player) => {
        setEditingPlayer(player);
        setFormData({
            seasonId: player.seasonId || '',
            teamId: player.teamId || '',
            firstName: player.firstName,
            lastName: player.lastName,
            jerseyNumber: player.jerseyNumber || '',
            position: player.position,
            shoots: player.shoots || 'L',
            skillRating: player.skillRating || 5,
            email: player.email || '',
            isVeteran: player.isVeteran || false,
            birthDate: player.birthDate || '',
            hometown: player.hometown || '',
            isActive: player.isActive
        });
        setShowModal(true);

        // Check if a matching user exists
        if (player.email) {
            setCheckingCounterpart(true);
            api.getUsers().then(users => {
                const match = users.some(u => u.email && u.email.toLowerCase() === player.email.toLowerCase());
                setHasMatchingUser(match);
            }).catch(err => {
                console.error('Failed to check for matching user:', err);
                setHasMatchingUser(null);
            }).finally(() => {
                setCheckingCounterpart(false);
            });
        }
    };

    const handleDelete = (id) => {
        setPlayerToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            await api.deletePlayer(playerToDelete);
            setShowDeleteModal(false);
            setPlayerToDelete(null);
            loadData();
        } catch (error) {
            console.error('Error deleting player:', error);
            alert('Failed to delete player');
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setPlayerToDelete(null);
    };

    const resetForm = () => {
        setEditingPlayer(null);
        setFormData({
            seasonId: '',
            teamId: '',
            firstName: '',
            lastName: '',
            jerseyNumber: '',
            position: 'F',
            shoots: 'L',
            skillRating: 5,
            email: '',
            isVeteran: false,
            birthDate: '',
            hometown: '',
            isActive: true
        });
        setAlsoCreateUser(false);
        setUserData({
            username: '',
            email: '',
            password: '',
            roles: ['USER'],
            teamId: null
        });
        setUserPasswordError('');
        setHasMatchingUser(null);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleCopyEmails = async () => {
        try {
            // Filter players to get those who have email addresses
            const emailAddresses = sortedPlayers
                .filter(player => player.email && player.email.trim() !== '')
                .map(player => player.email.trim());

            if (emailAddresses.length === 0) {
                alert('No email addresses found for current players.');
                return;
            }

            // Create comma-delimited string
            const emailString = emailAddresses.join(', ');

            // Copy to clipboard
            await navigator.clipboard.writeText(emailString);
            alert(`Copied ${emailAddresses.length} email address(es) to clipboard!`);
        } catch (error) {
            console.error('Error copying emails:', error);
            alert('Failed to copy emails to clipboard. Please try again.');
        }
    };



    if (loading) {
        return <div className="loading">Loading players...</div>;
    }

    return (
        <div className="player-management">
            <div className="management-header">
                <h2>Player Management</h2>
                <div className="header-actions">
                    <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        className="season-filter"
                    >
                        <option value="all">All Seasons</option>
                        {seasons.map(season => (
                            <option key={season.id} value={season.id}>
                                {season.name}
                            </option>
                        ))}
                    </select>
                    <div className="pm-search-wrapper">
                        <span className="pm-search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pm-search-input"
                        />
                        {searchQuery && (
                            <button
                                className="pm-search-clear"
                                onClick={() => setSearchQuery('')}
                                title="Clear search"
                            >✕</button>
                        )}
                    </div>
                    <button onClick={handleCopyEmails} className="btn-secondary">
                        📧 Copy All Emails
                    </button>
                    <button onClick={() => setShowModal(true)} className="btn-primary">
                        + Add Player
                    </button>
                </div>
            </div>

            <div className="players-table-container">
                <table className="players-table">
                    <thead>
                        <tr>
                            <th onClick={() => requestSort('jerseyNumber')} className="sortable">#{getSortIcon('jerseyNumber')}</th>
                            <th onClick={() => requestSort('lastName')} className="sortable">Name{getSortIcon('lastName')}</th>
                            <th onClick={() => requestSort('teamId')} className="sortable">Team{getSortIcon('teamId')}</th>
                            <th onClick={() => requestSort('position')} className="sortable">Position{getSortIcon('position')}</th>
                            <th onClick={() => requestSort('skillRating')} className="sortable">Skill{getSortIcon('skillRating')}</th>
                            <th onClick={() => requestSort('goals')} className="sortable">G{getSortIcon('goals')}</th>
                            <th onClick={() => requestSort('assists')} className="sortable">A{getSortIcon('assists')}</th>
                            <th onClick={() => requestSort('points')} className="sortable">P{getSortIcon('points')}</th>
                            <th onClick={() => requestSort('penaltyMinutes')} className="sortable">PM{getSortIcon('penaltyMinutes')}</th>
                            <th onClick={() => requestSort('isActive')} className="sortable">Status{getSortIcon('isActive')}</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPlayers.map(player => {
                            const team = teams.find(t => t.id === player.teamId);
                            const bg = team ? getValidColor(team.teamColor) : null;
                            const textColor = team ? getTextColor(bg) : 'inherit';
                            const stats = playerStats[player.id] || {};

                            return (
                                <tr key={player.id}>
                                    <td className="jersey-number">{player.jerseyNumber}</td>
                                    <td className="player-name">
                                        {player.firstName} {player.lastName}
                                        {team && team.gmId === player.id && <span className="gm-badge">GM</span>}
                                        {player.skillRating >= 9 && <span className="twogl-badge">2GL</span>}
                                    </td>
                                    <td>
                                        {team ? (
                                            <span style={{
                                                backgroundColor: bg,
                                                color: textColor,
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                display: 'inline-block',
                                                fontWeight: '600',
                                                textAlign: 'center'
                                            }}>
                                                {team.name}
                                            </span>
                                        ) : 'N/A'}
                                    </td>
                                    <td>{player.position}</td>
                                    <td>{player.skillRating}</td>
                                    <td>{stats.goals || 0}</td>
                                    <td>{stats.assists || 0}</td>
                                    <td>{stats.points || 0}</td>
                                    <td>{stats.penaltyMinutes || 0}</td>
                                    <td>
                                        <span className={`status-badge ${player.isActive ? 'active' : 'inactive'}`}>
                                            {player.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="actions">
                                        <button onClick={() => handleEdit(player)} className="btn-edit-small">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(player.id)} className="btn-delete-small">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingPlayer ? 'Edit Player' : 'Add New Player'}</h3>
                            <button onClick={handleCloseModal} className="modal-close">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="player-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Season</label>
                                    <select
                                        value={formData.seasonId}
                                        onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Season...</option>
                                        {seasons.map(season => (
                                            <option key={season.id} value={season.id}>
                                                {season.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Skill Rating (1-10)</label>
                                    <input
                                        type="number"
                                        value={formData.skillRating}
                                        onChange={(e) => setFormData({ ...formData, skillRating: e.target.value })}
                                        required
                                        min="1"
                                        max="10"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    placeholder="player@example.com"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <div className="label-with-filter">
                                        <label>Team</label>
                                        <label className="checkbox-filter">
                                            <input
                                                type="checkbox"
                                                checked={activeTeamsOnly}
                                                onChange={(e) => setActiveTeamsOnly(e.target.checked)}
                                            />
                                            Active teams only
                                        </label>
                                    </div>
                                    <select
                                        value={formData.teamId}
                                        onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                                    >
                                        <option value="">N/A (No Team)</option>
                                        {filteredTeams.map(team => (
                                            <option key={team.id} value={team.id}>
                                                {team.name} ({team.abbreviation})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Jersey Number</label>
                                    <input
                                        type="number"
                                        value={formData.jerseyNumber}
                                        onChange={(e) => setFormData({ ...formData, jerseyNumber: e.target.value })}
                                        required
                                        min="0"
                                        max="99"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Position</label>
                                    <select
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        required
                                    >
                                        <option value="F">Forward</option>
                                        <option value="D">Defense</option>
                                        <option value="G">Goalie</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Birth Date</label>
                                <input
                                    type="date"
                                    value={formData.birthDate}
                                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Hometown</label>
                                <input
                                    type="text"
                                    value={formData.hometown}
                                    onChange={(e) => setFormData({ ...formData, hometown: e.target.value })}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={formData.isVeteran}
                                            onChange={(e) => setFormData({ ...formData, isVeteran: e.target.checked })}
                                        />
                                        Veteran
                                    </label>
                                </div>
                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        Active
                                    </label>
                                </div>
                            </div>

                            {/* Also Create User - when creating OR editing without a matching user */}
                            {!editingPlayer && (
                                <>
                                    <hr style={{ margin: '16px 0', borderColor: '#444' }} />
                                    <div className="form-group checkbox-group">
                                        <label style={{ fontWeight: '600', fontSize: '1rem', color: '#4fc3f7' }}>
                                            <input
                                                type="checkbox"
                                                checked={alsoCreateUser}
                                                onChange={(e) => setAlsoCreateUser(e.target.checked)}
                                            />
                                            Also create as User
                                        </label>
                                    </div>

                                    {alsoCreateUser && (
                                        <div className="linked-form-section" style={{
                                            border: '1px solid #4fc3f7',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            marginTop: '8px',
                                            backgroundColor: 'rgba(79, 195, 247, 0.05)'
                                        }}>
                                            <h4 style={{ marginTop: 0, color: '#4fc3f7' }}>User Account Details</h4>

                                            <div className="form-group">
                                                <label>Username *</label>
                                                <input
                                                    type="text"
                                                    value={userData.username}
                                                    onChange={(e) => handleUserChange('username', e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Email * (defaults to player email)</label>
                                                <input
                                                    type="email"
                                                    value={userData.email || formData.email}
                                                    onChange={(e) => handleUserChange('email', e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Password *</label>
                                                <input
                                                    type="password"
                                                    value={userData.password}
                                                    onChange={(e) => handleUserChange('password', e.target.value)}
                                                    required
                                                />
                                                {userPasswordError && <div className="field-error" style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{userPasswordError}</div>}
                                                <small style={{ color: '#aaa' }}>
                                                    Min 8 characters, 1 uppercase, 1 special character, no spaces
                                                </small>
                                            </div>

                                            <div className="form-group">
                                                <label>Roles * (Select at least one)</label>
                                                <div className="roles-checkbox-grid">
                                                    {AVAILABLE_ROLES.map(role => (
                                                        <label key={role.name} className="role-checkbox-item">
                                                            <input
                                                                type="checkbox"
                                                                checked={userData.roles.includes(role.name)}
                                                                onChange={() => handleUserRoleToggle(role.name)}
                                                            />
                                                            <div className="role-checkbox-label">
                                                                <span className="role-checkbox-name">{role.name}</span>
                                                                <span className="role-checkbox-desc">{role.description}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Create User from Player - only in edit mode when no matching user exists */}
                            {editingPlayer && hasMatchingUser === false && !checkingCounterpart && (
                                <>
                                    <hr style={{ margin: '16px 0', borderColor: '#444' }} />
                                    {!alsoCreateUser ? (
                                        <button
                                            type="button"
                                            onClick={() => setAlsoCreateUser(true)}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                background: 'linear-gradient(135deg, #4fc3f7, #0288d1)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            ⚡ Create User from this Player
                                        </button>
                                    ) : (
                                        <div className="linked-form-section" style={{
                                            border: '1px solid #4fc3f7',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            marginTop: '8px',
                                            backgroundColor: 'rgba(79, 195, 247, 0.05)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h4 style={{ marginTop: 0, color: '#4fc3f7' }}>User Account Details</h4>
                                                <button
                                                    type="button"
                                                    onClick={() => setAlsoCreateUser(false)}
                                                    style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2rem' }}
                                                >×</button>
                                            </div>

                                            <div className="form-group">
                                                <label>Username *</label>
                                                <input
                                                    type="text"
                                                    value={userData.username}
                                                    onChange={(e) => handleUserChange('username', e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Email * (defaults to player email)</label>
                                                <input
                                                    type="email"
                                                    value={userData.email || formData.email}
                                                    onChange={(e) => handleUserChange('email', e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Password *</label>
                                                <input
                                                    type="password"
                                                    value={userData.password}
                                                    onChange={(e) => handleUserChange('password', e.target.value)}
                                                    required
                                                />
                                                {userPasswordError && <div className="field-error" style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{userPasswordError}</div>}
                                                <small style={{ color: '#aaa' }}>
                                                    Min 8 characters, 1 uppercase, 1 special character, no spaces
                                                </small>
                                            </div>

                                            <div className="form-group">
                                                <label>Roles * (Select at least one)</label>
                                                <div className="roles-checkbox-grid">
                                                    {AVAILABLE_ROLES.map(role => (
                                                        <label key={role.name} className="role-checkbox-item">
                                                            <input
                                                                type="checkbox"
                                                                checked={userData.roles.includes(role.name)}
                                                                onChange={() => handleUserRoleToggle(role.name)}
                                                            />
                                                            <div className="role-checkbox-label">
                                                                <span className="role-checkbox-name">{role.name}</span>
                                                                <span className="role-checkbox-desc">{role.description}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="form-actions">
                                <button type="button" onClick={handleCloseModal} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingPlayer ? (alsoCreateUser ? 'Update & Create User' : 'Update') : (alsoCreateUser ? 'Create Player & User' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Confirm Delete</h3>
                            <button onClick={cancelDelete} className="modal-close">&times;</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete this player?</p>
                            <p className="warning-text">This action cannot be undone.</p>
                        </div>
                        <div className="form-actions">
                            <button type="button" onClick={cancelDelete} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="button" onClick={confirmDelete} className="btn-delete">
                                Delete Player
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlayerManagement;
