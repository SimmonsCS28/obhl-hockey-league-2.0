import { useEffect, useState } from 'react';
import logo from '../assets/images/buzzard-logo.png';
import { useAuth } from '../contexts/AuthContext';
import { PAYPAL_URL } from '../constants/config';
import './DonatePopup.css';

const STORAGE_KEY = 'obhl-donate-prompt';

// First-visit donate prompt. Auto-opens ~900ms after load for logged-out
// visitors only, and never again once dismissed (per-device via localStorage).
function DonatePopup() {
    const [open, setOpen] = useState(false);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) return; // don't nag signed-in members
        let seen = false;
        try { seen = localStorage.getItem(STORAGE_KEY) === 'seen'; } catch { /* ignore */ }
        if (seen) return;
        const t = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(t);
    }, [isAuthenticated]);

    const markSeen = () => {
        try { localStorage.setItem(STORAGE_KEY, 'seen'); } catch { /* ignore */ }
    };

    const dismiss = () => {
        markSeen();
        setOpen(false);
    };

    if (!open) return null;

    return (
        <div className="obi-donate-overlay" onClick={dismiss}>
            <div className="obi-donate-modal" onClick={(e) => e.stopPropagation()}>
                <button className="obi-donate-close" onClick={dismiss} aria-label="Close">&times;</button>

                <div className="obi-donate-head">
                    <img src={logo} alt="OBHL" className="obi-donate-logo" />
                    <span className="obi-donate-titles">
                        <span className="obi-donate-title">SUPPORT THE OBHL</span>
                        <span className="obi-donate-subtitle">Help Keep The Lights On</span>
                    </span>
                </div>

                <p className="obi-donate-p">
                    This website is built by players, for players. We're committed to keeping the Old
                    Buzzard Hockey League running smoothly with tools that make managing our league easier
                    for everyone.
                </p>
                <p className="obi-donate-p obi-donate-p-dim">
                    Your contribution helps cover server costs, development time, and keeping this platform
                    free for all OBHL members. Any amount is greatly appreciated and goes directly toward
                    maintaining and improving our league's digital home.
                </p>

                <div className="obi-donate-actions">
                    <a
                        href={PAYPAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="obi-donate-paypal"
                        onClick={dismiss}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.3 5c1.9 0 3.4 1 4.7 2.6C11.3 6 12.8 5 14.7 5 18 5 19.6 8.4 18 11.7 15.5 16.4 12 21 12 21z" />
                        </svg>
                        Contribute via PayPal
                    </a>
                    <button className="obi-donate-later" onClick={dismiss}>Maybe Later</button>
                </div>
            </div>
        </div>
    );
}

export default DonatePopup;
