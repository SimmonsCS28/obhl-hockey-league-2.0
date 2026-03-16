import { useState, useEffect, useCallback } from 'react';

const VersionChecker = ({ interval = 300000 }) => { // Default to 5 minutes
    const [currentVersion, setCurrentVersion] = useState(null);
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

    const checkVersion = useCallback(async () => {
        try {
            // Add a cache-busting timestamp to the request
            const response = await fetch(`/version.json?t=${Date.now()}`);
            if (!response.ok) return;

            const data = await response.json();
            
            if (!currentVersion) {
                // Initial load
                setCurrentVersion(data.timestamp);
                // Also store in memory to survive some types of re-renders if needed
                window.__APP_VERSION__ = data.timestamp;
            } else if (data.timestamp > currentVersion) {
                console.log('New version detected:', data.buildDate);
                setIsUpdateAvailable(true);
            }
        } catch (error) {
            console.warn('Failed to check for version updates:', error);
        }
    }, [currentVersion]);

    useEffect(() => {
        // Initial check
        checkVersion();

        // Set up interval
        const timer = setInterval(checkVersion, interval);
        return () => clearInterval(timer);
    }, [checkVersion, interval]);

    const handleRefresh = () => {
        window.location.reload();
    };

    if (!isUpdateAvailable) return null;

    return (
        <div className="version-alert-overlay" style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 9999,
            maxWidth: '300px',
            border: '2px solid #3498db',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Update Available</h4>
            <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#64748b' }}>
                A new version of the application has been deployed. Please refresh to pick up the latest changes.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                    onClick={handleRefresh}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Refresh Now
                </button>
                <button 
                    onClick={() => setIsUpdateAvailable(false)}
                    style={{
                        padding: '10px',
                        background: '#e2e8f0',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Later
                </button>
            </div>
            <style>
                {`
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                `}
            </style>
        </div>
    );
};

export default VersionChecker;
