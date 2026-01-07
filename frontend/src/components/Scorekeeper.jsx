import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ScorekeeperContent from './ScorekeeperContent';

function Scorekeeper() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>🏒 OBHL Scorekeeper</h1>
                <div className="user-info">
                    <button
                        className="nav-btn"
                        onClick={() => navigate('/')}
                        style={{ marginRight: '1rem', background: 'transparent', border: '1px solid white', color: 'white' }}
                    >
                        Back to Public Site
                    </button>
                    <span>Welcome, {user?.email}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </header>

            <main className="app-main">
                <ScorekeeperContent />
            </main>
        </div>
    );
}

export default Scorekeeper;
