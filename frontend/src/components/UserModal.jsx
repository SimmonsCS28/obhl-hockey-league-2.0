import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { FALLBACK_ROLES, toRoleOptions } from '../constants/roles';
import { useSeason } from '../contexts/SeasonContext';
import './UserModal.css';

const POSITIONS = [
    { value: 'F', label: 'Forward' },
    { value: 'D', label: 'Defense' },
    { value: 'G', label: 'Goalie' },
];
const SHOOTS = [
    { value: 'L', label: 'Left' },
    { value: 'R', label: 'Right' },
];

const validatePassword = (password) => {
    if (!password) return '';
    if (password.length < 8) return 'Min 8 characters, 1 uppercase, 1 special character, no spaces.';
    if (!/[A-Z]/.test(password)) return 'Min 8 characters, 1 uppercase, 1 special character, no spaces.';
    if (!/[!@#$%^&*()\-_=+[\]{}|;:',.<>?/~`]/.test(password)) return 'Min 8 characters, 1 uppercase, 1 special character, no spaces.';
    if (/\s/.test(password)) return 'Min 8 characters, 1 uppercase, 1 special character, no spaces.';
    return '';
};

const emptyPlayerData = () => ({
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
    isActive: true,
});

const UserModal = ({ user, isCreating, onClose }) => {
    const { selectedSeasonId } = useSeason();
    const scrollerRef = useRef(null);

    const [availableRoles, setAvailableRoles] = useState(FALLBACK_ROLES);
    const [formData, setFormData] = useState({
        username: '', firstName: '', lastName: '', email: '',
        roles: ['USER'], teamId: '',
        password: '', forceChange: true,
        resetOpen: false, newPassword: '',
    });
    const [playerExpanded, setPlayerExpanded] = useState(false);
    const [playerData, setPlayerData] = useState(emptyPlayerData());
    const [activeTeamsOnly, setActiveTeamsOnly] = useState(true);

    const [seasons, setSeasons] = useState([]);
    const [teams, setTeams] = useState([]);
    const [hasMatchingPlayer, setHasMatchingPlayer] = useState(null);
    const [checkingCounterpart, setCheckingCounterpart] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savedFlash, setSavedFlash] = useState('');

    useEffect(() => {
        api.getRoles().then(roles => setAvailableRoles(toRoleOptions(roles))).catch(() => {});
        Promise.all([api.getSeasons(), api.getTeams()])
            .then(([seasonsData, teamsData]) => {
                setSeasons(seasonsData);
                setTeams(teamsData);
            })
            .catch(err => console.error('Failed to load seasons/teams:', err));
    }, []);

    useEffect(() => {
        if (user && !isCreating) {
            let rolesArray;
            if (user.roles && user.roles.length > 0) {
                rolesArray = Array.isArray(user.roles) ? user.roles : Array.from(user.roles);
            } else if (user.role) {
                rolesArray = [user.role];
            } else {
                rolesArray = ['USER'];
            }
            setFormData(prev => ({
                ...prev,
                username: user.username || '',
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                roles: rolesArray,
                teamId: user.teamId || '',
            }));
        }
    }, [user, isCreating]);

    // Edit mode only: does this user already have a linked Player? Gate the CTA on that.
    useEffect(() => {
        if (user && !isCreating && user.email) {
            setCheckingCounterpart(true);
            api.getPlayers()
                .then(players => {
                    const match = players.some(p => p.email && p.email.toLowerCase() === user.email.toLowerCase());
                    setHasMatchingPlayer(match);
                })
                .catch(err => {
                    console.error('Failed to check for matching player:', err);
                    setHasMatchingPlayer(null);
                })
                .finally(() => setCheckingCounterpart(false));
        }
    }, [user, isCreating]);

    const clearBanners = () => { setError(''); setSavedFlash(''); };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        clearBanners();
    };

    const handlePlayerChange = (field, value) => {
        setPlayerData(prev => ({ ...prev, [field]: value }));
        clearBanners();
    };

    const toggleRole = (roleName) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(roleName) ? prev.roles.filter(r => r !== roleName) : [...prev.roles, roleName],
        }));
        clearBanners();
    };

    const filteredPlayerTeams = teams.filter(team => {
        const matchesActive = activeTeamsOnly ? team.active : true;
        const matchesSeason = playerData.seasonId ? team.seasonId === parseInt(playerData.seasonId) : true;
        return matchesActive && matchesSeason;
    });

    const gmTeams = teams.filter(t => !selectedSeasonId || t.seasonId === selectedSeasonId);

    const openPlayerPanel = () => {
        setPlayerExpanded(true);
        setPlayerData(prev => ({
            ...prev,
            firstName: prev.firstName || formData.firstName,
            lastName: prev.lastName || formData.lastName,
        }));
        clearBanners();
    };

    const togglePlayerPanel = () => {
        if (playerExpanded) {
            setPlayerExpanded(false);
            clearBanners();
        } else {
            openPlayerPanel();
        }
    };

    const scrollToTop = () => {
        const el = scrollerRef.current;
        if (!el) return;
        if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
        else el.scrollTop = 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.roles || formData.roles.length === 0) {
            setError('Please select at least one role.');
            scrollToTop();
            return;
        }

        if (isCreating) {
            if (!formData.password) {
                setError('Password is required.');
                scrollToTop();
                return;
            }
            const pwErr = validatePassword(formData.password);
            if (pwErr) {
                setError('Password does not meet requirements: ' + pwErr);
                scrollToTop();
                return;
            }
        } else if (formData.resetOpen && formData.newPassword) {
            const pwErr = validatePassword(formData.newPassword);
            if (pwErr) {
                setError('New password does not meet requirements: ' + pwErr);
                scrollToTop();
                return;
            }
        }

        if (playerExpanded) {
            const missing = [];
            if (!playerData.firstName.trim()) missing.push('First Name');
            if (!playerData.lastName.trim()) missing.push('Last Name');
            if (!playerData.seasonId) missing.push('Season');
            if (missing.length) {
                setError('Player requires: ' + missing.join(', ') + '.');
                scrollToTop();
                return;
            }
        }

        setLoading(true);
        setError('');

        const buildPlayerPayload = (email) => ({
            firstName: playerData.firstName,
            lastName: playerData.lastName,
            email,
            position: playerData.position,
            shoots: playerData.shoots,
            jerseyNumber: playerData.jerseyNumber ? parseInt(playerData.jerseyNumber) : null,
            skillRating: playerData.skillRating ? parseFloat(playerData.skillRating) : 5,
            seasonId: playerData.seasonId ? parseInt(playerData.seasonId) : null,
            teamId: playerData.teamId ? parseInt(playerData.teamId) : null,
            isVeteran: playerData.isVeteran,
            isActive: playerData.isActive,
            birthDate: playerData.birthDate || null,
            hometown: playerData.hometown || null,
        });

        try {
            let saveLabel;
            if (isCreating) {
                const createdUser = await api.createUser({
                    username: formData.username,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    password: formData.password,
                    roles: formData.roles,
                    teamId: formData.teamId ? parseInt(formData.teamId) : null,
                    mustChangePassword: formData.forceChange,
                });

                if (playerExpanded) {
                    try {
                        await api.createPlayer(buildPlayerPayload(formData.email));
                    } catch (playerErr) {
                        try { await api.deleteUser(createdUser.id); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
                        throw new Error(`Player creation failed: ${playerErr.message}. User creation has been rolled back.`);
                    }
                }
                saveLabel = playerExpanded ? 'Create User & Player' : 'Create User';
            } else {
                const updateData = {
                    username: formData.username,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    teamId: formData.teamId ? parseInt(formData.teamId) : null,
                };
                if (formData.resetOpen && formData.newPassword) {
                    updateData.newPassword = formData.newPassword;
                }
                await api.updateUser(user.id, updateData);
                await api.updateUserRoles(user.id, formData.roles);

                if (playerExpanded) {
                    await api.createPlayer(buildPlayerPayload(formData.email));
                }
                saveLabel = playerExpanded ? 'Save & Create Player' : 'Save Changes';
            }

            setSavedFlash('✓ ' + saveLabel + ' — saved successfully.');
            scrollToTop();
            setTimeout(() => onClose(true), 900);
        } catch (err) {
            const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save user';
            setError(message);
            scrollToTop();
        } finally {
            setLoading(false);
        }
    };

    const showAlsoPlayer = isCreating;
    const showPlayerCta = !isCreating && hasMatchingPlayer === false && !checkingCounterpart && !playerExpanded;
    const roleCount = formData.roles.length;

    const saveLabel = isCreating
        ? (playerExpanded ? 'Create User & Player' : 'Create User')
        : (playerExpanded ? 'Save & Create Player' : 'Save Changes');

    return (
        <div className="um-overlay" ref={scrollerRef} onClick={() => onClose(false)}>
            <div className="um-card" onClick={(e) => e.stopPropagation()}>
                <div className="um-header">
                    <div className="um-title">{isCreating ? 'Create New User' : `Edit User: ${user?.username}`}</div>
                    <button className="um-close" onClick={() => onClose(false)} aria-label="Close">×</button>
                </div>

                <form onSubmit={handleSubmit} className="um-body" autoComplete="off">
                    {error && (
                        <div className="um-banner um-banner--error">
                            <span style={{ fontWeight: 800, flex: 'none' }}>!</span><span>{error}</span>
                        </div>
                    )}
                    {savedFlash && <div className="um-banner um-banner--success">{savedFlash}</div>}

                    <div className="um-field">
                        <label className="um-label" htmlFor="um-username">Username <span className="um-label-required">*</span></label>
                        <input
                            id="um-username" name="username" type="text" className="um-input"
                            value={formData.username} onChange={handleChange} placeholder="jsmith"
                            required disabled={loading}
                            autoComplete="off" data-lpignore="true" data-1p-ignore="true"
                        />
                    </div>

                    <div className="um-row">
                        <div>
                            <label className="um-label" htmlFor="um-firstName">First Name</label>
                            <input
                                id="um-firstName" name="firstName" type="text" className="um-input"
                                value={formData.firstName} onChange={handleChange} placeholder="Jane" disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="um-label" htmlFor="um-lastName">Last Name</label>
                            <input
                                id="um-lastName" name="lastName" type="text" className="um-input"
                                value={formData.lastName} onChange={handleChange} placeholder="Smith" disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="um-field um-field--email">
                        <label className="um-label" htmlFor="um-email">Email <span className="um-label-required">*</span></label>
                        <input
                            id="um-email" name="email" type="email" className="um-input"
                            value={formData.email} onChange={handleChange} placeholder="jane@email.com"
                            required disabled={loading}
                        />
                    </div>

                    <div className="um-roles-head">
                        <label className="um-label" style={{ marginBottom: 0 }}>Roles <span className="um-label-required">*</span></label>
                        <span className="um-roles-count">{roleCount || 'No'} {roleCount === 1 ? 'role' : 'roles'} selected</span>
                    </div>
                    <div className="um-roles-grid">
                        {availableRoles.map(role => {
                            const selected = formData.roles.includes(role.name);
                            return (
                                <button
                                    type="button"
                                    key={role.name}
                                    className={`um-role-card${selected ? ' is-selected' : ''}`}
                                    onClick={() => toggleRole(role.name)}
                                    disabled={loading}
                                >
                                    <span className="um-role-box" aria-hidden="true">{selected ? '✓' : ''}</span>
                                    <span className="um-role-text">
                                        <span className="um-role-name">{role.name}</span>
                                        <span className="um-role-desc">{role.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="um-field um-field--team">
                        <label className="um-label" htmlFor="um-teamId">
                            Team <span className="um-label-note">(optional — for GM role)</span>
                        </label>
                        <select
                            id="um-teamId" name="teamId" className="um-select"
                            value={formData.teamId} onChange={handleChange} disabled={loading}
                        >
                            <option value="">— Select team —</option>
                            {gmTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {isCreating ? (
                        <>
                            <label className="um-label" htmlFor="um-password">Password <span className="um-label-required">*</span></label>
                            <input
                                id="um-password" name="password" type="text" className="um-input um-input--mono"
                                value={formData.password} onChange={handleChange}
                                placeholder="Set an initial password" required disabled={loading}
                                autoComplete="new-password" data-lpignore="true" data-1p-ignore="true"
                            />
                            <div className="um-hint">Min 8 characters, 1 uppercase, 1 special character, no spaces</div>
                            <button
                                type="button" className="um-check-row" style={{ marginBottom: 6 }}
                                onClick={() => { setFormData(prev => ({ ...prev, forceChange: !prev.forceChange })); clearBanners(); }}
                                disabled={loading}
                            >
                                <span className={`um-checkbox${formData.forceChange ? ' is-checked' : ''}`} aria-hidden="true">{formData.forceChange ? '✓' : ''}</span>
                                <span className="um-check-label">Force password change on first login</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <label className="um-label">Password</label>
                            {!formData.resetOpen ? (
                                <button
                                    type="button" className="um-reset-btn"
                                    onClick={() => setFormData(prev => ({ ...prev, resetOpen: true }))}
                                    disabled={loading}
                                >Reset Password</button>
                            ) : (
                                <div className="um-reset-panel">
                                    <label className="um-label" htmlFor="um-newPassword">New Password</label>
                                    <input
                                        id="um-newPassword" name="newPassword" type="text" className="um-input um-input--mono"
                                        value={formData.newPassword} onChange={handleChange}
                                        placeholder="Enter new password" disabled={loading}
                                        autoComplete="new-password" data-lpignore="true" data-1p-ignore="true"
                                    />
                                    <div className="um-hint">Min 8 characters, 1 uppercase, 1 special character, no spaces</div>
                                    <button
                                        type="button" className="um-cancel-reset"
                                        onClick={() => setFormData(prev => ({ ...prev, resetOpen: false, newPassword: '' }))}
                                        disabled={loading}
                                    >Cancel Reset</button>
                                </div>
                            )}
                        </>
                    )}

                    <div className="um-divider" />

                    {showAlsoPlayer && (
                        <>
                            <button type="button" className="um-check-row" onClick={togglePlayerPanel} disabled={loading}>
                                <span className={`um-checkbox${playerExpanded ? ' is-checked' : ''}`} aria-hidden="true">{playerExpanded ? '✓' : ''}</span>
                                <span className="um-role-name" style={{ color: '#EAEEF2' }}>Also create as Player</span>
                            </button>
                            <div className="um-also-desc">
                                Creates a linked Player profile in one action. If the player can't be created, the new user is rolled back.
                            </div>
                        </>
                    )}

                    {showPlayerCta && (
                        <>
                            <button type="button" className="um-player-cta" onClick={openPlayerPanel} disabled={loading}>
                                ⚡ Create Player from this User
                            </button>
                            <div className="um-player-cta-desc">
                                This user has no linked player. Creating one saves the user and the player together.
                            </div>
                        </>
                    )}

                    {playerExpanded && (
                        <div className="um-player-panel">
                            <div className="um-player-panel-head">
                                <div className="um-player-panel-title">Player Details</div>
                                {!isCreating && (
                                    <button type="button" className="um-player-panel-close" onClick={togglePlayerPanel} aria-label="Collapse player details">×</button>
                                )}
                            </div>

                            <div className="um-row">
                                <div>
                                    <label className="um-label" htmlFor="um-pSeason">Season <span className="um-label-required">*</span></label>
                                    <select
                                        id="um-pSeason" className="um-select" value={playerData.seasonId}
                                        onChange={(e) => handlePlayerChange('seasonId', e.target.value)} disabled={loading}
                                    >
                                        <option value="">Select Season...</option>
                                        {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: '0 0 118px' }}>
                                    <label className="um-label" htmlFor="um-pSkill">Skill (1–10)</label>
                                    <input
                                        id="um-pSkill" type="number" min="1" max="10" step="0.5" className="um-input um-skill-input"
                                        value={playerData.skillRating} onChange={(e) => handlePlayerChange('skillRating', e.target.value)} disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="um-row">
                                <div>
                                    <label className="um-label" htmlFor="um-pFirst">First Name <span className="um-label-required">*</span></label>
                                    <input
                                        id="um-pFirst" type="text" className="um-input" placeholder="Jane"
                                        value={playerData.firstName} onChange={(e) => handlePlayerChange('firstName', e.target.value)} disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="um-label" htmlFor="um-pLast">Last Name <span className="um-label-required">*</span></label>
                                    <input
                                        id="um-pLast" type="text" className="um-input" placeholder="Smith"
                                        value={playerData.lastName} onChange={(e) => handlePlayerChange('lastName', e.target.value)} disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="um-row">
                                <div>
                                    <div className="um-team-field-head">
                                        <label className="um-label" style={{ marginBottom: 0 }}>Team</label>
                                        <button
                                            type="button" className="um-active-teams-toggle"
                                            onClick={() => setActiveTeamsOnly(v => !v)} disabled={loading}
                                        >
                                            <span className={`um-checkbox um-checkbox--sm${activeTeamsOnly ? ' is-checked' : ''}`} aria-hidden="true">{activeTeamsOnly ? '✓' : ''}</span>
                                            <span className="um-check-label um-check-label--sm">Active teams only</span>
                                        </button>
                                    </div>
                                    <select
                                        className="um-select" value={playerData.teamId}
                                        onChange={(e) => handlePlayerChange('teamId', e.target.value)} disabled={loading}
                                    >
                                        <option value="">N/A (Free Agent)</option>
                                        {filteredPlayerTeams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: '0 0 118px' }}>
                                    <label className="um-label" htmlFor="um-pJersey">Jersey #</label>
                                    <input
                                        id="um-pJersey" type="number" min="0" max="99" placeholder="—" className="um-input um-jersey-input"
                                        value={playerData.jerseyNumber} onChange={(e) => handlePlayerChange('jerseyNumber', e.target.value)} disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="um-row">
                                <div>
                                    <label className="um-label" htmlFor="um-pPosition">Position <span className="um-label-required">*</span></label>
                                    <select
                                        id="um-pPosition" className="um-select" value={playerData.position}
                                        onChange={(e) => handlePlayerChange('position', e.target.value)} disabled={loading}
                                    >
                                        {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="um-label" htmlFor="um-pShoots">Shoots</label>
                                    <select
                                        id="um-pShoots" className="um-select" value={playerData.shoots}
                                        onChange={(e) => handlePlayerChange('shoots', e.target.value)} disabled={loading}
                                    >
                                        {SHOOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="um-row">
                                <div>
                                    <label className="um-label" htmlFor="um-pBirth">Birth Date</label>
                                    <input
                                        id="um-pBirth" type="date" className="um-input"
                                        value={playerData.birthDate} onChange={(e) => handlePlayerChange('birthDate', e.target.value)} disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="um-label" htmlFor="um-pHometown">Hometown</label>
                                    <input
                                        id="um-pHometown" type="text" className="um-input" placeholder="City, ST"
                                        value={playerData.hometown} onChange={(e) => handlePlayerChange('hometown', e.target.value)} disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="um-player-panel-checks">
                                <button
                                    type="button" className="um-check-row"
                                    onClick={() => handlePlayerChange('isVeteran', !playerData.isVeteran)} disabled={loading}
                                >
                                    <span className={`um-checkbox${playerData.isVeteran ? ' is-checked' : ''}`} aria-hidden="true">{playerData.isVeteran ? '✓' : ''}</span>
                                    <span className="um-check-label">Veteran</span>
                                </button>
                                <button
                                    type="button" className="um-check-row"
                                    onClick={() => handlePlayerChange('isActive', !playerData.isActive)} disabled={loading}
                                >
                                    <span className={`um-checkbox${playerData.isActive ? ' is-checked' : ''}`} aria-hidden="true">{playerData.isActive ? '✓' : ''}</span>
                                    <span className="um-check-label">Active</span>
                                </button>
                            </div>
                            <div className="um-player-panel-note">Player email is copied from the user's Email field above.</div>
                        </div>
                    )}

                    <div className="um-footer">
                        <button type="button" className="um-btn-cancel" onClick={() => onClose(false)} disabled={loading}>Cancel</button>
                        <button type="submit" className="um-btn-save" disabled={loading}>
                            {loading ? 'Saving...' : saveLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
