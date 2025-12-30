import { Link, Outlet } from 'react-router-dom';
import logo from '../assets/images/obi-logo-nav.png';
import './PublicLayout.css';

function PublicLayout() {
    return (
        <div className="public-layout">
            <header className="public-header">
                <div className="header-content">
                    <Link to="/" className="logo">
                        <img src={logo} alt="OBHL Logo" className="logo-img" />
                    </Link>
                    <nav className="main-nav">
                        <Link to="/">Home</Link>
                        <Link to="/seasons">Seasons</Link>
                        <Link to="/teams">Teams</Link>
                        <Link to="/players">Players</Link>
                        <Link to="/standings">Standings</Link>
                        <Link to="/schedule">Schedule</Link>
                    </nav>
                    <Link to="/admin" className="admin-link">Admin</Link>
                </div>
            </header>

            <main className="public-main">
                <Outlet />
            </main>

            <footer className="public-footer">
                <p>&copy; {new Date().getFullYear()} Old Buzzard Hockey League. All rights reserved.</p>
            </footer>
        </div>
    );
}

export default PublicLayout;
