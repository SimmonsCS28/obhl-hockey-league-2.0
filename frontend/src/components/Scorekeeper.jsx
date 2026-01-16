import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ScorekeeperDashboard from './ScorekeeperDashboard';

function Scorekeeper() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="app">
            <header className="app-header scorekeeper-header">
                <h1>🏒 OBHL Scorekeeper</h1>
                <div className="user-info">
                    <span className="user-greeting">Welcome, {user?.email}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </header>

            <main className="app-main">
                <ScorekeeperDashboard />
            </main>
        </div>
    );
}

export default Scorekeeper;
