import { useState } from 'react';
import './DonateButton.css';

function DonateButton() {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <button className="donate-button" onClick={() => setShowModal(true)}>
                ❤️ Donate
            </button>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content donate-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Support OBHL</h3>
                            <button onClick={() => setShowModal(false)} className="modal-close">&times;</button>
                        </div>
                        <div className="modal-body">
                            <p className="donate-message">
                                This website is built <strong>by players, for players</strong>. We're committed to
                                keeping the Old Buzzard Hockey League running smoothly with tools that make managing
                                our league easier for everyone.
                            </p>
                            <p className="donate-message">
                                Your contribution helps cover server costs, development time, and keeping this
                                platform free for all OBHL members. Any amount is greatly appreciated and goes
                                directly toward maintaining and improving our league's digital home.
                            </p>
                            <div className="donate-actions">
                                <a
                                    href="https://venmo.com/u/Cole-Simmons-6"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-donate-venmo"
                                >
                                    Donate via Venmo
                                </a>
                                <p className="donate-note">@Cole-Simmons-6</p>
                            </div>
                            <p className="donate-thanks">
                                Thank you for supporting your fellow players! 🏒
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default DonateButton;
