import { useEffect, useRef, useState } from 'react';
import ReactQuillNew from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../services/api';
import './LeagueRulesAdmin.css';

const TOOLBAR_OPTIONS = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['clean']
];

function LeagueRulesAdmin() {
    const [content, setContent] = useState('');
    const [lastUpdatedBy, setLastUpdatedBy] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
    const saveTimerRef = useRef(null);

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
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaving(true);
        setSaveStatus(null);
        try {
            const data = await api.updateRules(content);
            setLastUpdatedBy(data.updatedByName || '');
            setLastUpdatedAt(data.updatedAt || '');
            setSaveStatus('success');
        } catch (err) {
            console.error('Failed to save rules:', err);
            setSaveStatus('error');
        } finally {
            setSaving(false);
            saveTimerRef.current = setTimeout(() => setSaveStatus(null), 4000);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
            return d.toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit'
            });
        } catch {
            return iso;
        }
    };

    if (loading) {
        return (
            <div className="rules-admin-loading">
                <div className="rules-spinner" />
                <span>Loading rules content...</span>
            </div>
        );
    }

    return (
        <div className="rules-admin">
            <div className="rules-admin-header">
                <div className="rules-admin-title">
                    <h2>📜 League Rules Editor</h2>
                    <p className="rules-admin-subtitle">
                        Edit the rules below and click <strong>Save Changes</strong>. 
                        Your updates will appear instantly on the public site.
                    </p>
                </div>
                <div className="rules-admin-actions">
                    {lastUpdatedBy && (
                        <div className="rules-last-updated">
                            <span className="rules-updated-icon">🕐</span>
                            <span>
                                Last updated by <strong>{lastUpdatedBy}</strong>
                                {lastUpdatedAt && <> on {formatDate(lastUpdatedAt)}</>}
                            </span>
                        </div>
                    )}
                    <button
                        className={`rules-save-btn ${saving ? 'saving' : ''}`}
                        onClick={handleSave}
                        disabled={saving}
                        id="save-rules-btn"
                    >
                        {saving ? '⏳ Saving...' : '💾 Save Changes'}
                    </button>
                    {saveStatus === 'success' && (
                        <div className="rules-save-status success">✅ Rules saved successfully!</div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="rules-save-status error">❌ Failed to save. Please try again.</div>
                    )}
                </div>
            </div>

            <div className="rules-editor-container">
                <ReactQuillNew
                    value={content}
                    onChange={setContent}
                    modules={{ toolbar: TOOLBAR_OPTIONS }}
                    theme="snow"
                    placeholder="Enter the league rules here..."
                    id="rules-quill-editor"
                />
            </div>

            <div className="rules-admin-footer">
                <button
                    className={`rules-save-btn ${saving ? 'saving' : ''}`}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
                {saveStatus === 'success' && (
                    <div className="rules-save-status success">✅ Rules saved successfully!</div>
                )}
                {saveStatus === 'error' && (
                    <div className="rules-save-status error">❌ Failed to save. Please try again.</div>
                )}
            </div>
        </div>
    );
}

export default LeagueRulesAdmin;
