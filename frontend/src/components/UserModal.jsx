import { useEffect, useState } from 'react';
import api from '../services/api';
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

const UserModal = ({ user, isCreating, onClose }) => {
    const [formData, setFormData] = useState({
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roles: ['USER'],
        teamId: null,
        mustChangePassword: true
    });
    const [alsoCreatePlayer, setAlsoCreatePlayer] = useState(false);
    const [playerData, setPlayerData] = useState({
        seasonId: '',
        teamId: '',
        firstName: '',
        lastName: '',
        jerseyNumber: '',
        position: 'F',
        shoots: 'L',
        skillRating: 5,
        isVeteran: false,
        birthDate: '',
        hometown: '',
        isActive: true
    });
    const [seasons, setSeasons] = useState([]);
    const [teams, setTeams] = useState([]);
    const [activeTeamsOnly, setActiveTeamsOnly] = useState(false);
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [hasMatchingPlayer, setHasMatchingPlayer] = useState(null); // null = not checked, true/false = result
    const [checkingCounterpart, setCheckingCounterpart] = useState(false);

    useEffect(() => {
        if (user && !isCreating) {
            // Handle migration from old single role to new multi-role system
            let rolesArray;
            if (user.roles && user.roles.length > 0) {
                rolesArray = Array.isArray(user.roles) ? user.roles : Array.from(user.roles);
            } else if (user.role) {
                rolesArray = [user.role];
            } else {
                rolesArray = ['USER'];
            }

            setFormData({
                username: user.username || '',
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                password: '',
                roles: rolesArray,
                teamId: user.teamId || null,
                mustChangePassword: true
            });
        }
    }, [user, isCreating]);

    // Check if a matching player exists when editing a user
    useEffect(() => {
        if (user && !isCreating && user.email) {
            const checkForPlayer = async () => {
                setCheckingCounterpart(true);
                try {
                    const players = await api.getPlayers();
                    const match = players.some(p => p.email && p.email.toLowerCase() === user.email.toLowerCase());
                    setHasMatchingPlayer(match);
                } catch (err) {
                    console.error('Failed to check for matching player:', err);
                    setHasMatchingPlayer(null);
                } finally {
                    setCheckingCounterpart(false);
                }
            };
            checkForPlayer();
        }
    }, [user, isCreating]);

    // Fetch seasons and teams when "Also create as Player" is checked
    useEffect(() => {
        if (alsoCreatePlayer && seasons.length === 0) {
            const fetchData = async () => {
                try {
                    const [seasonsData, teamsData] = await Promise.all([
                        api.getSeasons(),
                        api.getTeams()
                    ]);
                    setSeasons(seasonsData);
                    setTeams(teamsData);
                } catch (err) {
                    console.error('Failed to load seasons/teams:', err);
                }
            };
            fetchData();
        }
    }, [alsoCreatePlayer]);

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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'teamId' ? (value ? parseInt(value) : null) : value
        }));

        if (name === 'password') {
            const error = validatePassword(value);
            setPasswordError(error);
        }
    };

    const handlePlayerChange = (field, value) => {
        setPlayerData(prev => ({ ...prev, [field]: value }));
    };

    const handleRoleToggle = (roleName) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(roleName)
                ? prev.roles.filter(r => r !== roleName)
                : [...prev.roles, roleName]
        }));
    };

    // Filter teams for the player form
    const filteredTeams = teams.filter(team => {
        const matchesActive = activeTeamsOnly ? team.active : true;
        const matchesSeason = playerData.seasonId ? team.seasonId === parseInt(playerData.seasonId) : true;
        return matchesActive && matchesSeason;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.roles || formData.roles.length === 0) {
            setError('Please select at least one role');
            return;
        }

        if ((isCreating && formData.password) || (!isCreating && showPasswordReset && formData.password)) {
            const passwordValidation = validatePassword(formData.password);
            if (passwordValidation) {
                setPasswordError(passwordValidation);
                return;
            }
        }

        if (isCreating && !formData.password) {
            setError('Password is required for new users');
            return;
        }

        // Validate player fields if also creating player
        if (isCreating && alsoCreatePlayer) {
            if (!playerData.firstName || !playerData.lastName) {
                setError('First Name and Last Name are required for the player');
                return;
            }
            if (!playerData.seasonId) {
                setError('Season is required for the player');
                return;
            }
        }

        setLoading(true);

        try {
            if (isCreating) {
                // Create user first
                const createdUser = await api.createUser({
                    username: formData.username,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    password: formData.password,
                    roles: formData.roles,
                    teamId: formData.teamId,
                    mustChangePassword: formData.mustChangePassword
                });

                // If also creating player, do that next
                if (alsoCreatePlayer) {
                    try {
                        await api.createPlayer({
                            firstName: playerData.firstName,
                            lastName: playerData.lastName,
                            email: formData.email, // Use the user's email
                            position: playerData.position,
                            shoots: playerData.shoots,
                            jerseyNumber: playerData.jerseyNumber ? parseInt(playerData.jerseyNumber) : null,
                            skillRating: playerData.skillRating ? parseInt(playerData.skillRating) : 5,
                            seasonId: playerData.seasonId ? parseInt(playerData.seasonId) : null,
                            teamId: playerData.teamId ? parseInt(playerData.teamId) : null,
                            isVeteran: playerData.isVeteran,
                            isActive: playerData.isActive,
                            birthDate: playerData.birthDate || null,
                            hometown: playerData.hometown || null
                        });
                    } catch (playerErr) {
                        // Rollback: delete the user we just created
                        try {
                            await api.deleteUser(createdUser.id);
                        } catch (rollbackErr) {
                            console.error('Rollback failed:', rollbackErr);
                        }
                        throw new Error(`Player creation failed: ${playerErr.message}. User creation has been rolled back.`);
                    }
                }
            } else {
                // Update existing user
                const updateData = {
                    username: formData.username,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    teamId: formData.teamId
                };

                if (showPasswordReset && formData.password) {
                    updateData.newPassword = formData.password;
                }

                await api.updateUser(user.id, updateData);
                await api.updateUserRoles(user.id, formData.roles);

                // If creating a player from this user in edit mode
                if (alsoCreatePlayer) {
                    await api.createPlayer({
                        firstName: playerData.firstName,
                        lastName: playerData.lastName,
                        email: formData.email,
                        position: playerData.position,
                        shoots: playerData.shoots,
                        jerseyNumber: playerData.jerseyNumber ? parseInt(playerData.jerseyNumber) : null,
                        skillRating: playerData.skillRating ? parseInt(playerData.skillRating) : 5,
                        seasonId: playerData.seasonId ? parseInt(playerData.seasonId) : null,
                        teamId: playerData.teamId ? parseInt(playerData.teamId) : null,
                        isVeteran: playerData.isVeteran,
                        isActive: playerData.isActive,
                        birthDate: playerData.birthDate || null,
                        hometown: playerData.hometown || null
                    });
                }
            }

            onClose(true);
        } catch (err) {
            setError(err.message || 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isCreating ? 'Create New User' : `Edit User: ${user?.username}`}</h2>
                    <button className="modal-close" onClick={() => onClose(false)}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="user-form">
                    {error && <div className="form-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Username *</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label htmlFor="firstName">First Name</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email *</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Roles * (Select at least one)</label>
                        <div className="roles-checkbox-grid">
                            {AVAILABLE_ROLES.map(role => (
                                <label key={role.name} className="role-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={formData.roles.includes(role.name)}
                                        onChange={() => handleRoleToggle(role.name)}
                                        disabled={loading}
                                    />
                                    <div className="role-checkbox-label">
                                        <span className="role-checkbox-name">{role.name}</span>
                                        <span className="role-checkbox-desc">{role.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="teamId">Team ID (optional, for GMs)</label>
                        <input
                            type="number"
                            id="teamId"
                            name="teamId"
                            value={formData.teamId || ''}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="Leave blank if not GM"
                        />
                    </div>

                    {/* Password Section */}
                    {isCreating ? (
                        <div className="form-group">
                            <label htmlFor="password">Password *</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                            {passwordError && <div className="field-error">{passwordError}</div>}
                            <small className="password-hint">
                                Min 8 characters, 1 uppercase, 1 special character, no spaces
                            </small>
                        </div>
                    ) : (
                        <div className="form-group password-reset-section">
                            {!showPasswordReset ? (
                                <button
                                    type="button"
                                    className="btn-reset-password"
                                    onClick={() => setShowPasswordReset(true)}
                                    disabled={loading}
                                >
                                    Reset Password
                                </button>
                            ) : (
                                <>
                                    <label htmlFor="password">New Password</label>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                    {passwordError && <div className="field-error">{passwordError}</div>}
                                    <small className="password-hint">
                                        Min 8 characters, 1 uppercase, 1 special character, no spaces
                                    </small>
                                    <button
                                        type="button"
                                        className="btn-cancel-reset"
                                        onClick={() => {
                                            setShowPasswordReset(false);
                                            setFormData(prev => ({ ...prev, password: '' }));
                                            setPasswordError('');
                                        }}
                                        disabled={loading}
                                    >
                                        Cancel Reset
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Force Password Change Checkbox */}
                    {isCreating && (
                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={formData.mustChangePassword}
                                    onChange={(e) => setFormData(prev => ({ ...prev, mustChangePassword: e.target.checked }))}
                                    disabled={loading}
                                />
                                Force password change on first login
                            </label>
                        </div>
                    )}

                    {/* Also Create Player Checkbox - only when creating */}
                    {isCreating && (
                        <>
                            <hr style={{ margin: '16px 0', borderColor: '#444' }} />
                            <div className="form-group checkbox-group">
                                <label style={{ fontWeight: '600', fontSize: '1rem', color: '#4fc3f7' }}>
                                    <input
                                        type="checkbox"
                                        checked={alsoCreatePlayer}
                                        onChange={(e) => setAlsoCreatePlayer(e.target.checked)}
                                        disabled={loading}
                                    />
                                    Also create as Player
                                </label>
                            </div>

                            {alsoCreatePlayer && (
                                <div className="linked-form-section" style={{
                                    border: '1px solid #4fc3f7',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginTop: '8px',
                                    backgroundColor: 'rgba(79, 195, 247, 0.05)'
                                }}>
                                    <h4 style={{ marginTop: 0, color: '#4fc3f7' }}>Player Details</h4>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Season *</label>
                                            <select
                                                value={playerData.seasonId}
                                                onChange={(e) => handlePlayerChange('seasonId', e.target.value)}
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
                                                value={playerData.skillRating}
                                                onChange={(e) => handlePlayerChange('skillRating', e.target.value)}
                                                min="1"
                                                max="10"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>First Name *</label>
                                            <input
                                                type="text"
                                                value={playerData.firstName}
                                                onChange={(e) => handlePlayerChange('firstName', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Last Name *</label>
                                            <input
                                                type="text"
                                                value={playerData.lastName}
                                                onChange={(e) => handlePlayerChange('lastName', e.target.value)}
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
                                                value={playerData.teamId}
                                                onChange={(e) => handlePlayerChange('teamId', e.target.value)}
                                            >
                                                <option value="">N/A (Free Agent)</option>
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
                                                value={playerData.jerseyNumber}
                                                onChange={(e) => handlePlayerChange('jerseyNumber', e.target.value)}
                                                min="0"
                                                max="99"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Position *</label>
                                            <select
                                                value={playerData.position}
                                                onChange={(e) => handlePlayerChange('position', e.target.value)}
                                                required
                                            >
                                                <option value="F">Forward</option>
                                                <option value="D">Defense</option>
                                                <option value="G">Goalie</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Shoots</label>
                                            <select
                                                value={playerData.shoots}
                                                onChange={(e) => handlePlayerChange('shoots', e.target.value)}
                                            >
                                                <option value="L">Left</option>
                                                <option value="R">Right</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Birth Date</label>
                                        <input
                                            type="date"
                                            value={playerData.birthDate}
                                            onChange={(e) => handlePlayerChange('birthDate', e.target.value)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Hometown</label>
                                        <input
                                            type="text"
                                            value={playerData.hometown}
                                            onChange={(e) => handlePlayerChange('hometown', e.target.value)}
                                        />
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={playerData.isVeteran}
                                                    onChange={(e) => handlePlayerChange('isVeteran', e.target.checked)}
                                                />
                                                Veteran
                                            </label>
                                        </div>
                                        <div className="form-group checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={playerData.isActive}
                                                    onChange={(e) => handlePlayerChange('isActive', e.target.checked)}
                                                />
                                                Active
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Create Player from User - only in edit mode when no matching player exists */}
                    {!isCreating && hasMatchingPlayer === false && !checkingCounterpart && (
                        <>
                            <hr style={{ margin: '16px 0', borderColor: '#444' }} />
                            {!alsoCreatePlayer ? (
                                <button
                                    type="button"
                                    onClick={() => setAlsoCreatePlayer(true)}
                                    disabled={loading}
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
                                    ⚡ Create Player from this User
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
                                        <h4 style={{ marginTop: 0, color: '#4fc3f7' }}>Player Details</h4>
                                        <button
                                            type="button"
                                            onClick={() => setAlsoCreatePlayer(false)}
                                            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2rem' }}
                                        >×</button>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Season *</label>
                                            <select
                                                value={playerData.seasonId}
                                                onChange={(e) => handlePlayerChange('seasonId', e.target.value)}
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
                                                value={playerData.skillRating}
                                                onChange={(e) => handlePlayerChange('skillRating', e.target.value)}
                                                min="1"
                                                max="10"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>First Name *</label>
                                            <input
                                                type="text"
                                                value={playerData.firstName}
                                                onChange={(e) => handlePlayerChange('firstName', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Last Name *</label>
                                            <input
                                                type="text"
                                                value={playerData.lastName}
                                                onChange={(e) => handlePlayerChange('lastName', e.target.value)}
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
                                                value={playerData.teamId}
                                                onChange={(e) => handlePlayerChange('teamId', e.target.value)}
                                            >
                                                <option value="">N/A (Free Agent)</option>
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
                                                value={playerData.jerseyNumber}
                                                onChange={(e) => handlePlayerChange('jerseyNumber', e.target.value)}
                                                min="0"
                                                max="99"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Position *</label>
                                            <select
                                                value={playerData.position}
                                                onChange={(e) => handlePlayerChange('position', e.target.value)}
                                                required
                                            >
                                                <option value="F">Forward</option>
                                                <option value="D">Defense</option>
                                                <option value="G">Goalie</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Shoots</label>
                                            <select
                                                value={playerData.shoots}
                                                onChange={(e) => handlePlayerChange('shoots', e.target.value)}
                                            >
                                                <option value="L">Left</option>
                                                <option value="R">Right</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Birth Date</label>
                                        <input
                                            type="date"
                                            value={playerData.birthDate}
                                            onChange={(e) => handlePlayerChange('birthDate', e.target.value)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Hometown</label>
                                        <input
                                            type="text"
                                            value={playerData.hometown}
                                            onChange={(e) => handlePlayerChange('hometown', e.target.value)}
                                        />
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={playerData.isVeteran}
                                                    onChange={(e) => handlePlayerChange('isVeteran', e.target.checked)}
                                                />
                                                Veteran
                                            </label>
                                        </div>
                                        <div className="form-group checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={playerData.isActive}
                                                    onChange={(e) => handlePlayerChange('isActive', e.target.checked)}
                                                />
                                                Active
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => onClose(false)}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-save"
                            disabled={loading || (passwordError && formData.password)}
                        >
                            {loading ? 'Saving...' : (isCreating ? (alsoCreatePlayer ? 'Create User & Player' : 'Create User') : (alsoCreatePlayer ? 'Save & Create Player' : 'Save Changes'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
