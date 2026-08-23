import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoginModal from '../LoginModal';
import UserPill from '../common/UserPill';
import tournamentApi from '../../services/tournamentApi';
import { PAYPAL_URL } from '../../constants/config';
import crest from '../../assets/tournament/crow-crest.png';
import { TournamentContext } from './useTournament';
import './tournament-theme.css';
import './TournamentLayout.css';

const NAV = [
    { to: 'bracket', label: 'Bracket' },
    { to: 'schedule', label: 'Schedule' },
    { to: 'teams', label: 'Teams' },
    { to: 'players', label: 'Players' },
    { to: 'rules', label: 'Rules' },
];

/**
 * Chrome for the C League Classic microsite.
 *
 * A sibling of PublicLayout rather than a child: the tournament has its own identity, its own nav,
 * and exactly one outbound link back to the league site. Auth is shared with the league — that is
 * deliberate and is not a tie between tournament and season teams.
 *
 * Loads the tournament once here and hands it to every page through context, so each page is not
 * separately resolving the slug before it can render anything.
 */
function TournamentLayout() {
    const { slug } = useParams();
    const { isAuthenticated } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);

    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (slug) {
                setTournament(await tournamentApi.getBySlug(slug));
            } else {
                // No slug: show the most recent published tournament. One runs per year, so this
                // is "the Classic" without needing a picker.
                const list = await tournamentApi.list();
                setTournament(list.length ? list[0] : null);
            }
            setError(null);
        } catch (e) {
            setError(e.message || 'Could not load the tournament');
            setTournament(null);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => { load(); }, [load]);

    // Links stay on the current tournament so the nav keeps working when browsing an archived year.
    const base = tournament ? `/tournaments/${tournament.slug}` : '/tournaments';

    const ctx = useMemo(
        () => ({ tournament, loading, error, seasonId: tournament?.seasonId ?? null, base, reload: load }),
        [tournament, loading, error, base, load]
    );

    return (
        <div className="tcc-root">
            <header className="tcc-header">
                <div className="tcc-header-inner">
                    <Link to={base} className="tcc-brand" onClick={() => setMenuOpen(false)}>
                        <img src={crest} alt="" className="tcc-brand-crest" />
                        <span className="tcc-brand-text">
                            <span className="tcc-brand-name">The C League Classic</span>
                            <span className="tcc-brand-sub">An OBHL Tournament</span>
                        </span>
                    </Link>

                    <nav className={`tcc-nav ${menuOpen ? 'is-open' : ''}`} data-open={menuOpen}>
                        {NAV.map(item => (
                            <NavLink
                                key={item.to}
                                to={`${base}/${item.to}`}
                                className={({ isActive }) => `tcc-nav-link ${isActive ? 'is-active' : ''}`}
                                onClick={() => setMenuOpen(false)}
                            >
                                {item.label}
                            </NavLink>
                        ))}
                        {/* The only link back to the league site. */}
                        <Link to="/" className="tcc-nav-out" onClick={() => setMenuOpen(false)}>
                            OBHL Season Site ↗
                        </Link>

                        {/*
                          * Auth actions, mounted a SECOND time inside the collapsible nav.
                          *
                          * Below 1120px the burger appears and the bar has no room left: the user
                          * pill alone is 312px, which pushed the header 359px past a 375px
                          * viewport. The bar copy is hidden at that width and this one takes over,
                          * so the account actions ride in the dropdown like the nav links do.
                          *
                          * Two mounts rather than one relocated node because CSS cannot move an
                          * element between parents. UserPill is stateless -- both copies read the
                          * same auth context -- and only ever one is displayed.
                          */}
                        <div className="tcc-nav-auth">
                            {isAuthenticated ? (
                                <UserPill />
                            ) : (
                                <>
                                    <Link to="/signup" className="tcc-btn tcc-btn-ghost" onClick={() => setMenuOpen(false)}>
                                        Create Account
                                    </Link>
                                    <button
                                        className="tcc-btn tcc-btn-solid"
                                        onClick={() => { setLoginOpen(true); setMenuOpen(false); }}
                                    >
                                        Log In
                                    </button>
                                </>
                            )}
                        </div>
                    </nav>

                    <div className="tcc-header-actions">
                        <a
                            className="tcc-btn tcc-btn-gold tcc-donate"
                            href={PAYPAL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z" />
                            </svg>
                            Donate
                        </a>
                        {isAuthenticated ? (
                            <UserPill />
                        ) : (
                            <>
                                <Link to="/signup" className="tcc-btn tcc-btn-ghost tcc-auth-btn">Create Account</Link>
                                <button className="tcc-btn tcc-btn-solid tcc-auth-btn" onClick={() => setLoginOpen(true)}>
                                    Log In
                                </button>
                            </>
                        )}
                        <button
                            className="tcc-burger"
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label="Toggle menu"
                            aria-expanded={menuOpen}
                        >
                            <span /><span /><span />
                        </button>
                    </div>
                </div>
            </header>

            <TournamentContext.Provider value={ctx}>
                <main className="tcc-main">
                    {loading && <div className="tcc-empty">Loading…</div>}
                    {!loading && error && (
                        <div className="tcc-empty">
                            <div className="tcc-empty-title">Tournament unavailable</div>
                            {error}
                        </div>
                    )}
                    {!loading && !error && !tournament && (
                        <div className="tcc-empty">
                            <div className="tcc-empty-title">No Classic announced yet</div>
                            Check back once this year&rsquo;s tournament is published.
                        </div>
                    )}
                    {!loading && !error && tournament && <Outlet />}
                </main>
            </TournamentContext.Provider>

            <footer className="tcc-footer">
                <div className="tcc-footer-inner">
                    <span className="tcc-footer-copy">
                        © {new Date().getFullYear()} Old Buzzard Hockey League · Sun Prairie, WI
                    </span>
                    <Link to={base} className="tcc-footer-link">← Back to Tournament Home</Link>
                </div>
            </footer>

            {loginOpen && <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />}
        </div>
    );
}

export default TournamentLayout;
