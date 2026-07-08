import { Link, Outlet } from 'react-router-dom';
import logo from '../assets/images/buzzard-logo.png';
import UserPill from './common/UserPill';
import './ScorekeeperLayout.css';

const ScorekeeperLayout = () => {
    return (
        <div className="sk-layout">
            <header className="sk-header">
                <div className="sk-header-inner">
                    <Link to="/" className="sk-brand">
                        <img src={logo} alt="OBHL" className="sk-brand-logo" />
                        <span className="sk-wordmark">
                            <span className="sk-wordmark-top">OLD BUZZARD</span>
                            <span className="sk-wordmark-sub">HOCKEY LEAGUE</span>
                        </span>
                    </Link>
                    <nav className="sk-nav">
                        <Link to="/dashboard" className="sk-nav-link">Dashboard</Link>
                        <Link to="/scorekeeper" className="sk-nav-link">My Schedule</Link>
                        <UserPill />
                    </nav>
                </div>
            </header>
            <main className="sk-content">
                <Outlet />
            </main>
        </div>
    );
};

export default ScorekeeperLayout;
