import React, { useState } from 'react';
import './AnnouncementBanner.css';

function AnnouncementBanner({ announcement }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return d.toLocaleDateString();
    };

    // Process HTML to ensure links have http protocol
    const processHtml = (html) => {
        if (!html) return '';
        // Match href="something", where something doesn't start with http://, https://, mailto:, tel:, #, or /
        return html.replace(/href="(?!(?:https?|mailto|tel|#|\/))([^"]+)"/ig, 'href="https://$1"');
    };

    return (
        <div className="announcement-banner">
            <div 
                className={`announcement-header ${isExpanded ? 'expanded' : ''}`}
                onClick={toggleExpand}
            >
                <div className="announcement-title">
                    <span className="announcement-icon">🚨</span>
                    <h3>{announcement.title}</h3>
                </div>
                <div className="announcement-meta">
                    <span className="announcement-date">{formatDate(announcement.createdAt)}</span>
                    <button className="toggle-btn" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                        {isExpanded ? '▲' : '▼'}
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <div className="announcement-body">
                    {/* Render HTML content securely relying on React's dangerouslySetInnerHTML */}
                    <div 
                        className="announcement-content ql-editor-display" 
                        dangerouslySetInnerHTML={{ __html: processHtml(announcement.content) }} 
                    />
                </div>
            )}
        </div>
    );
}

export default AnnouncementBanner;
