import { useState } from 'react';
import { generateUsers } from '../services/api';

const UserGenerationTab = ({ onUserGenerated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedUsers, setGeneratedUsers] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');

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

    return (
        <div className="user-generation-tab">
            <div className="generation-controls">
                <h3>Auto-Generate Users</h3>
                <p>
                    This tool will check for players in the database who do not yet have a user account.
                    It matches players by email address.
                </p>
                <p>
                    <strong>New users will be created with:</strong>
                    <ul>
                        <li>Username: Email Address</li>
                        <li>Role: USER</li>
                        <li>Status: Active</li>
                        <li>Password: <code>Welcome1!</code> (Must change on first login)</li>
                    </ul>
                </p>

                <button
                    className="generate-btn"
                    onClick={handleGenerate}
                    disabled={loading}
                >
                    {loading ? 'Generating...' : 'Generate New Users'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

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

            <style jsx>{`
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
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .users-table th, .users-table td {
                    border: 1px solid #dee2e6;
                    padding: 8px;
                    text-align: left;
                }
                .users-table th {
                    background-color: #e9ecef;
                }
            `}</style>
        </div>
    );
};

export default UserGenerationTab;
