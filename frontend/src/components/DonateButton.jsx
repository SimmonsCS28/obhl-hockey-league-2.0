import { PAYPAL_URL } from '../constants/config';
import './DonateButton.css';

// Header CTA — gold-outline link straight to PayPal (per v2 design handoff).
function DonateButton() {
    return (
        <a
            href={PAYPAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="obi-donate-btn"
        >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.3 5c1.9 0 3.4 1 4.7 2.6C11.3 6 12.8 5 14.7 5 18 5 19.6 8.4 18 11.7 15.5 16.4 12 21 12 21z" />
            </svg>
            Donate
        </a>
    );
}

export default DonateButton;
