import { useEffect, useState } from 'react';
import api from '../../services/api';
import './RulesPage.css';

function RulesPage() {
    const [content, setContent] = useState('');
    const [lastUpdatedBy, setLastUpdatedBy] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            setLoading(true);
            const data = await api.getRules();
            setContent(data.content || '');
            setLastUpdatedBy(data.updatedByName || '');
            setLastUpdatedAt(data.updatedAt || '');
        } catch (err) {
            setError('Unable to load the league rules. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
            return d.toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            });
        } catch {
            return '';
        }
    };

    return (
        <div className="rules-page">
            <div className="rules-page-hero">
                <div className="rules-hero-content">
                    <div className="rules-hero-icon">🏒</div>
                    <h1 className="rules-hero-title">League Rules</h1>
                    <p className="rules-hero-subtitle">
                        Official rules and guidelines for the Old Buzzard Hockey League
                    </p>
                </div>
            </div>

            <div className="rules-page-container">
                {loading && (
                    <div className="rules-loading">
                        <div className="rules-spinner" />
                        <span>Loading league rules...</span>
                    </div>
                )}

                {error && (
                    <div className="rules-error">
                        <span>⚠️ {error}</span>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {lastUpdatedAt && (
                            <div className="rules-meta-bar">
                                <span className="rules-meta-icon">📋</span>
                                <span>
                                    Last updated {formatDate(lastUpdatedAt)}
                                    {lastUpdatedBy && <> by <strong>{lastUpdatedBy}</strong></>}
                                </span>
                            </div>
                        )}

                        {content ? (
                            <div
                                className="rules-content"
                                dangerouslySetInnerHTML={{ __html: content }}
                            />
                        ) : (
                            <div className="rules-empty">
                                <p>League rules have not been posted yet. Check back soon!</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default RulesPage;
