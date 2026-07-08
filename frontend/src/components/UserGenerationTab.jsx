import { useRef, useState } from 'react';
import { generatePreview, generateUsers, importGoalies, updateUser } from '../services/api';
import './UserGenerationTab.css';

const UserGenerationTab = ({ onUserGenerated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 'idle' -> 'reviewing' (flagged name-collisions need a decision) -> 'done'
    const [phase, setPhase] = useState('idle');
    const [preview, setPreview] = useState(null); // { toCreate, potentialDuplicates }
    const [resolutions, setResolutions] = useState({}); // index -> 'update' | 'create'
    const [resolving, setResolving] = useState(false);
    const [createdUsers, setCreatedUsers] = useState([]);
    const [ranEmpty, setRanEmpty] = useState(false);

    // Goalie Import State
    const [showGoalieModal, setShowGoalieModal] = useState(false);
    const [goalieCandidates, setGoalieCandidates] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importError, setImportError] = useState(null);
    const [importSuccess, setImportSuccess] = useState('');
    const fileInputRef = useRef(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setCreatedUsers([]);
        setRanEmpty(false);

        try {
            const data = await generatePreview();
            const dups = data.potentialDuplicates || [];
            const toCreate = data.toCreate || [];

            if (dups.length > 0) {
                const defaults = {};
                dups.forEach((_, i) => { defaults[i] = 'update'; });
                setResolutions(defaults);
                setPreview(data);
                setPhase('reviewing');
                setLoading(false);
            } else if (toCreate.length > 0) {
                await runCreate(data, {});
            } else {
                setRanEmpty(true);
                setPhase('done');
                setLoading(false);
            }
        } catch (err) {
            console.error('Error previewing users:', err);
            setError(err.message || 'Failed to preview user generation.');
            setLoading(false);
        }
    };

    // Applies chosen resolutions for flagged duplicates, then generates.
    // A flagged player's account isn't safe to auto-create as-is: the backend only
    // skips players whose email already matches a user, so a name-only collision
    // would otherwise become a duplicate account. "Update Existing" repoints the
    // existing account's email to the player's current one first so generate skips it.
    const runCreate = async (previewData, res) => {
        setResolving(true);
        setError(null);
        try {
            const dups = previewData.potentialDuplicates || [];
            for (let i = 0; i < dups.length; i++) {
                if (res[i] === 'update') {
                    const { player, existingUser } = dups[i];
                    await updateUser(existingUser.id, { email: player.email, username: player.email });
                }
            }
            const users = await generateUsers();
            setCreatedUsers(users);
            setPhase('done');
            if (users.length > 0 && onUserGenerated) onUserGenerated();
        } catch (err) {
            console.error('Error generating users:', err);
            setError(err.message || 'Failed to generate users.');
        } finally {
            setResolving(false);
            setLoading(false);
        }
    };

    const handleConfirmGenerate = () => runCreate(preview, resolutions);

    const handleResolutionChange = (index, value) => {
        setResolutions(prev => ({ ...prev, [index]: value }));
    };

    const handleCancelReview = () => {
        setPhase('idle');
        setPreview(null);
    };

    const handleGoalieImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = (event) => processGoalieCSV(event.target.result);
        reader.readAsText(file);
    };

    const processGoalieCSV = (csvText) => {
        setImportError(null);
        setImportSuccess('');
        try {
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const requiredHeaders = ['first name', 'last name', 'email', 'phone'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                setImportError(`Missing headers: ${missingHeaders.join(', ')}`);
                return;
            }

            const candidates = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = line.split(',').map(v => v.trim());
                if (values.length < requiredHeaders.length) continue;
                const candidate = {
                    firstName: values[headers.indexOf('first name')],
                    lastName: values[headers.indexOf('last name')],
                    email: values[headers.indexOf('email')],
                    phoneNumber: values[headers.indexOf('phone')],
                    skillRating: 5
                };
                if (candidate.email && candidate.firstName && candidate.lastName) {
                    candidates.push(candidate);
                }
            }

            if (candidates.length === 0) {
                setImportError('No valid goalie entries found in CSV.');
                return;
            }

            setGoalieCandidates(candidates);
            setShowGoalieModal(true);
        } catch (err) {
            setImportError('Failed to parse CSV file.');
            console.error(err);
        }
    };

    const handleSkillChange = (index, value) => {
        const rating = parseInt(value);
        if (rating < 1 || rating > 10) return;
        const updated = [...goalieCandidates];
        updated[index].skillRating = rating;
        setGoalieCandidates(updated);
    };

    const handleConfirmImport = async () => {
        if (!confirm(`Are you sure you want to import ${goalieCandidates.length} new goalies?`)) return;
        setImportLoading(true);
        setImportError(null);
        try {
            const result = await importGoalies(goalieCandidates);
            setImportSuccess(`Successfully imported ${result.length} new goalies.`);
            setShowGoalieModal(false);
            setGoalieCandidates([]);
            if (onUserGenerated) onUserGenerated();
        } catch (err) {
            console.error('Error importing goalies:', err);
            setImportError(err.message || 'Failed to import goalies');
        } finally {
            setImportLoading(false);
        }
    };

    return (
        <div className="gen-tab">
            <div className="gen-card">
                <h3 className="gen-title">Auto-Generate Users</h3>
                <p className="gen-desc">
                    This tool checks for players who don't yet have a user account. It matches by email,
                    and will flag any player who shares a name with an existing user so you can decide what to do.
                </p>
                <div className="gen-list-label">New users will be created with:</div>
                <ul className="gen-list">
                    <li>Username: <b>Email Address</b></li>
                    <li>Role: <b>USER</b></li>
                    <li>Status: <b>Active</b></li>
                    <li>Password: <span className="gen-code">Welcome1!</span> <small>(Must change on first login)</small></li>
                </ul>

                <div className="gen-actions">
                    <button
                        type="button"
                        className="gen-btn gen-btn--generate"
                        onClick={handleGenerate}
                        disabled={loading || importLoading || phase === 'reviewing'}
                    >
                        {loading ? 'Checking...' : 'Generate New Users'}
                    </button>

                    <button
                        type="button"
                        className="gen-btn gen-btn--import"
                        onClick={handleGoalieImportClick}
                        disabled={loading || importLoading}
                    >
                        Import Goalies (CSV)
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".csv"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            {error && <div className="gen-alert gen-alert--error">{error}</div>}
            {importError && <div className="gen-alert gen-alert--error">{importError}</div>}
            {importSuccess && <div className="gen-alert gen-alert--success">{importSuccess}</div>}

            {phase === 'reviewing' && preview && (
                <div className="gen-card">
                    <div className="gen-result-head">
                        <span className="gen-result-title">Accounts to Create</span>
                        <span className="gen-result-summary">
                            {preview.toCreate.length} new · {preview.potentialDuplicates.length} flagged — review before confirming
                        </span>
                    </div>
                    <div className="gen-result-list">
                        {preview.toCreate.map((p, i) => (
                            <div className="gen-result-row" key={`create-${i}`}>
                                <span className="gen-result-name">{p.firstName} {p.lastName}</span>
                                <span className="gen-result-email">{p.email}</span>
                                <span className="gen-result-tag gen-result-tag--create">Will Create</span>
                            </div>
                        ))}
                        {preview.potentialDuplicates.map((dup, i) => (
                            <div className="gen-result-row" key={`dup-${i}`}>
                                <span className="gen-result-name">{dup.player.firstName} {dup.player.lastName}</span>
                                <span className="gen-result-email">
                                    {dup.player.email} — name matches existing user &ldquo;{dup.existingUser.username}&rdquo;
                                </span>
                                <span className="gen-result-tag gen-result-tag--flag">⚠ Review</span>
                                <div className="gen-resolve">
                                    <button
                                        type="button"
                                        className={`gen-resolve-btn${resolutions[i] === 'update' ? ' is-active' : ''}`}
                                        onClick={() => handleResolutionChange(i, 'update')}
                                    >Update Existing</button>
                                    <button
                                        type="button"
                                        className={`gen-resolve-btn${resolutions[i] === 'create' ? ' is-active' : ''}`}
                                        onClick={() => handleResolutionChange(i, 'create')}
                                    >Create New</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="gen-confirm-row">
                        <button type="button" className="btn-cancel" onClick={handleCancelReview} disabled={resolving}>
                            Cancel
                        </button>
                        <button type="button" className="gen-btn gen-btn--generate" onClick={handleConfirmGenerate} disabled={resolving}>
                            {resolving ? 'Creating...' : 'Confirm & Generate'}
                        </button>
                    </div>
                </div>
            )}

            {phase === 'done' && createdUsers.length > 0 && (
                <div className="gen-card">
                    <div className="gen-result-head">
                        <span className="gen-result-title">Accounts Created</span>
                        <span className="gen-result-summary">{createdUsers.length} new account{createdUsers.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="gen-result-list">
                        {createdUsers.map(user => (
                            <div className="gen-result-row" key={user.id}>
                                <span className="gen-result-name">{user.firstName} {user.lastName}</span>
                                <span className="gen-result-email">{user.email}</span>
                                <span className="gen-result-tag gen-result-tag--create">Created</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {phase === 'done' && ranEmpty && (
                <div className="gen-empty">Every drafted player already has a user account — nothing to generate.</div>
            )}

            {/* Goalie Import Modal */}
            {showGoalieModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '760px', width: '95vw' }}>
                        <div className="modal-header">
                            <h3>Review Goalie Import</h3>
                            <button className="modal-close" onClick={() => setShowGoalieModal(false)} aria-label="Close">×</button>
                        </div>
                        <div style={{ padding: '20px 24px' }}>
                            <p className="gen-modal-note">
                                Found {goalieCandidates.length} potential goalies. Please review and assign skill ratings.
                            </p>
                            <div className="gen-modal-table-wrap">
                                <table className="gen-modal-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Skill Rating (1-10)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {goalieCandidates.map((candidate, index) => (
                                            <tr key={index}>
                                                <td><b>{candidate.firstName} {candidate.lastName}</b></td>
                                                <td>{candidate.email}</td>
                                                <td>{candidate.phoneNumber}</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        className="gen-skill-input"
                                                        value={candidate.skillRating}
                                                        onChange={(e) => handleSkillChange(index, e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="gen-confirm-row">
                                <button className="btn-cancel" onClick={() => setShowGoalieModal(false)} disabled={importLoading}>
                                    Cancel
                                </button>
                                <button className="gen-btn gen-btn--import" onClick={handleConfirmImport} disabled={importLoading}>
                                    {importLoading ? 'Importing...' : 'Confirm Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserGenerationTab;
