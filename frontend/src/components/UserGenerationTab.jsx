import { useRef, useState } from 'react';
import { generateUsers, importGoalies } from '../services/api';

const UserGenerationTab = ({ onUserGenerated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedUsers, setGeneratedUsers] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');

    // Goalie Import State
    const [showGoalieModal, setShowGoalieModal] = useState(false);
    const [goalieCandidates, setGoalieCandidates] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importError, setImportError] = useState(null);
    const fileInputRef = useRef(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage('');
        setGeneratedUsers([]);

        try {
            const users = await generateUsers();
            setGeneratedUsers(users);
            if (users.length > 0) {
                setSuccessMessage(`Successfully generated ${users.length} new user(s).`);
                if (onUserGenerated) {
                    onUserGenerated();
                }
            } else {
                setSuccessMessage('No new users needed to be generated. All players already have accounts.');
            }
        } catch (err) {
            console.error('Error generating users:', err);
            setError(err.message || 'Failed to generate users.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoalieImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset file input value to allow re-selecting the same file
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target.result;
            processGoalieCSV(csvText);
        };
        reader.readAsText(file);
    };

    const processGoalieCSV = (csvText) => {
        setImportError(null);
        try {
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            // Validate headers
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
                    skillRating: 5 // Default skill rating
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
        if (!confirm(`Are you sure you want to import ${goalieCandidates.length} new goalies?`)) {
            return;
        }

        setImportLoading(true);
        setImportError(null);

        try {
            const result = await importGoalies(goalieCandidates);
            setSuccessMessage(`Successfully imported ${result.length} new goalies.`);
            setShowGoalieModal(false);
            setGoalieCandidates([]);
            if (onUserGenerated) {
                onUserGenerated(); // Refresh user list
            }
        } catch (err) {
            console.error('Error importing goalies:', err);
            setImportError(err.message || 'Failed to import goalies');
        } finally {
            setImportLoading(false);
        }
    };

    return (
        <div className="user-generation-tab">
            <div className="generation-controls">
                <h3>Auto-Generate Users</h3>
                <p>
                    This tool will check for players in the database who do not yet have a user account.
                    It matches players by email address.
                </p>
                <div>
                    <strong>New users will be created with:</strong>
                    <ul>
                        <li>Username: Email Address</li>
                        <li>Role: USER</li>
                        <li>Status: Active</li>
                        <li>Password: <code>Welcome1!</code> (Must change on first login)</li>
                    </ul>
                </div>

                <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="generate-btn"
                        onClick={handleGenerate}
                        disabled={loading || importLoading}
                    >
                        {loading ? 'Generating...' : 'Generate New Users'}
                    </button>

                    <button
                        className="generate-btn"
                        onClick={handleGoalieImportClick}
                        disabled={loading || importLoading}
                        style={{ backgroundColor: '#17a2b8' }}
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

            {error && <div className="error-message">{error}</div>}
            {importError && <div className="error-message">{importError}</div>}

            {successMessage && <div className="success-message">{successMessage}</div>}

            {generatedUsers.length > 0 && (
                <div className="generated-results">
                    <h4>Generated Users</h4>
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Name</th>
                                <th>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {generatedUsers.map(user => (
                                <tr key={user.id}>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td>{user.firstName} {user.lastName}</td>
                                    <td>{Array.from(user.roles || []).join(', ') || user.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Goalie Import Modal */}
            {showGoalieModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Review Goalie Import</h3>
                        <p>Found {goalieCandidates.length} potential goalies. Please review and assign skill ratings.</p>

                        <div className="table-container">
                            <table className="users-table">
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
                                            <td>{candidate.firstName} {candidate.lastName}</td>
                                            <td>{candidate.email}</td>
                                            <td>{candidate.phoneNumber}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={candidate.skillRating}
                                                    onChange={(e) => handleSkillChange(index, e.target.value)}
                                                    style={{ width: '60px', padding: '5px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="modal-actions">
                            <button
                                onClick={() => setShowGoalieModal(false)}
                                disabled={importLoading}
                                className="cancel-btn"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={importLoading}
                                className="confirm-btn"
                            >
                                {importLoading ? 'Importing...' : 'Confirm Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .user-generation-tab {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .generation-controls {
                    margin-bottom: 20px;
                }
                .generation-controls ul {
                    margin-top: 5px;
                    margin-bottom: 15px;
                    padding-left: 20px;
                }
                .generate-btn {
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                .generate-btn:disabled {
                    background-color: #94d3a2;
                    cursor: not-allowed;
                }
                .error-message {
                    color: #dc3545;
                    padding: 10px;
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
                .success-message {
                    color: #155724;
                    padding: 10px;
                    background-color: #d4edda;
                    border: 1px solid #c3e6cb;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
                .users-table {
                    width: auto;
                    min-width: 50%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .users-table th, .users-table td {
                    border: 1px solid #dee2e6;
                    padding: 6px 10px;
                    text-align: left;
                    white-space: nowrap;
                }
                .users-table th {
                    background-color: #e9ecef;
                }
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content {
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    width: auto;
                    max-width: 95vw;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .table-container {
                    max-height: 500px;
                    overflow: auto;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: center;
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .cancel-btn {
                    padding: 8px 16px;
                    cursor: pointer;
                    background-color: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                }
                .confirm-btn {
                    padding: 8px 16px;
                    cursor: pointer;
                    background-color: #28a745;
                    color: white;
                    border: none;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
};

export default UserGenerationTab;
