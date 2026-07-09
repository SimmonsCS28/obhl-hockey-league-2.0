import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactQuillNew from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../services/api';
import './LeagueRulesAdmin.css';

const QUILL_TOOLBAR = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
];

const GROUPS = [
    { key: 'gen', label: 'General Info' },
    { key: 'game', label: 'Game Rules' },
    { key: 'mou', label: 'Agreement' },
];
const groupLabel = (k) => (GROUPS.find(g => g.key === k) || GROUPS[0]).label;

const blankSection = () => ({ group: 'gen', title: 'New Section', content: '' });

function LeagueRulesAdmin() {
    const [sections, setSections] = useState([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [mode, setMode] = useState('edit'); // edit | preview
    const [publishedAt, setPublishedAt] = useState('');
    const [publishedBy, setPublishedBy] = useState('');
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [status, setStatus] = useState(null); // 'saved' | 'error'
    const [dirty, setDirty] = useState(false);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            setLoading(true);
            const data = await api.getAdminRules();
            const secs = (data.sections || []).map(s => ({ ...s }));
            setSections(secs.length ? secs : [blankSection()]);
            setActiveIdx(0);
            setPublishedAt(data.publishedAt || '');
            setPublishedBy(data.publishedBy || '');
            setDirty(false);
        } catch (err) {
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateActive = (patch) => {
        setSections(prev => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
        setDirty(true);
    };

    const addSection = () => {
        setSections(prev => [...prev, blankSection()]);
        setActiveIdx(sections.length);
        setDirty(true);
    };

    const deleteSection = (i) => {
        if (sections.length <= 1) return;
        setSections(prev => prev.filter((_, idx) => idx !== i));
        setActiveIdx(a => (a >= i ? Math.max(0, a - 1) : a));
        setDirty(true);
    };

    const move = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= sections.length) return;
        setSections(prev => {
            const n = [...prev];
            [n[i], n[j]] = [n[j], n[i]];
            return n;
        });
        setActiveIdx(j);
        setDirty(true);
    };

    const publish = async () => {
        setPublishing(true);
        setStatus(null);
        try {
            await api.saveRules(sections.map(({ group, title, content }) => ({ group, title, content })));
            const res = await api.publishRules();
            const secs = (res.sections || []).map(s => ({ ...s }));
            setSections(secs.length ? secs : [blankSection()]);
            setActiveIdx(a => Math.min(a, Math.max(0, secs.length - 1)));
            setPublishedAt(res.publishedAt || '');
            setPublishedBy(res.publishedBy || '');
            setDirty(false);
            setStatus('saved');
            setTimeout(() => setStatus(null), 4000);
        } catch (err) {
            console.error('Failed to publish rules:', err);
            setStatus('error');
        } finally {
            setPublishing(false);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return iso;
        }
    };

    if (loading) {
        return <div className="re-loading">Loading rules…</div>;
    }

    const active = sections[activeIdx] || sections[0];

    return (
        <div className="re">
            {/* Top bar */}
            <div className="re-topbar">
                <div className="re-tabs">
                    <button className={`re-tab${mode === 'edit' ? ' is-active' : ''}`} onClick={() => setMode('edit')}>Edit Sections</button>
                    <button className={`re-tab${mode === 'preview' ? ' is-active' : ''}`} onClick={() => setMode('preview')}>Preview</button>
                </div>
                <div className="re-topbar-right">
                    <span className="re-published">
                        {publishedAt ? <>Published {formatDate(publishedAt)}{publishedBy ? ` by ${publishedBy}` : ''}</> : 'Not published yet'}
                        {dirty && <span className="re-dirty"> · Unpublished changes</span>}
                    </span>
                    <Link to="/rules" className="re-view-link" target="_blank" rel="noreferrer">View Public Page →</Link>
                    <button className="re-publish-btn" onClick={publish} disabled={publishing}>
                        {publishing ? 'Publishing…' : 'Publish to Site'}
                    </button>
                    {status === 'saved' && <span className="re-status re-status--ok">✓ Published</span>}
                    {status === 'error' && <span className="re-status re-status--err">✗ Failed</span>}
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="re-editor">
                    {/* Sections list */}
                    <aside className="re-list">
                        <div className="re-list-label">Sections</div>
                        <div className="re-list-items">
                            {sections.map((s, i) => (
                                <div
                                    key={i}
                                    className={`re-list-item${i === activeIdx ? ' is-active' : ''}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setActiveIdx(i)}
                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveIdx(i)}
                                >
                                    <div className="re-list-item-text">
                                        <span className="re-list-item-title">{s.title || 'Untitled Section'}</span>
                                        <span className="re-list-item-group">{groupLabel(s.group)}</span>
                                    </div>
                                    <div className="re-reorder">
                                        <button
                                            className="re-arrow"
                                            disabled={i === 0}
                                            onClick={(e) => { e.stopPropagation(); move(i, -1); }}
                                            aria-label="Move up"
                                        >▲</button>
                                        <button
                                            className="re-arrow"
                                            disabled={i === sections.length - 1}
                                            onClick={(e) => { e.stopPropagation(); move(i, 1); }}
                                            aria-label="Move down"
                                        >▼</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="re-add-btn" onClick={addSection}>+ Add Section</button>
                    </aside>

                    {/* Editor */}
                    <div className="re-pane">
                        <label className="re-field-label" htmlFor="re-title">Section Title</label>
                        <input
                            id="re-title"
                            className="re-title-input"
                            value={active.title}
                            onChange={e => updateActive({ title: e.target.value })}
                            placeholder="e.g. Registration & Fees"
                        />

                        <label className="re-field-label" htmlFor="re-group">Group</label>
                        <select
                            id="re-group"
                            className="re-group-select"
                            value={active.group}
                            onChange={e => updateActive({ group: e.target.value })}
                        >
                            {GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                        </select>

                        <label className="re-field-label">Content</label>
                        <div className="re-quill">
                            <ReactQuillNew
                                key={activeIdx}
                                value={active.content}
                                onChange={v => updateActive({ content: v })}
                                modules={{ toolbar: QUILL_TOOLBAR }}
                                theme="snow"
                                placeholder="Write this section's rules…"
                            />
                        </div>

                        <button
                            className="re-delete-btn"
                            onClick={() => deleteSection(activeIdx)}
                            disabled={sections.length <= 1}
                            title={sections.length <= 1 ? 'At least one section is required' : 'Delete this section'}
                        >
                            Delete Section
                        </button>
                    </div>
                </div>
            ) : (
                /* Preview */
                <div className="re-preview">
                    {sections.map((s, i) => (
                        <section key={i} className="re-preview-section">
                            <span className="re-preview-chip">{groupLabel(s.group)}</span>
                            <h2 className="re-preview-title">{s.title || 'Untitled Section'}</h2>
                            <div className="re-preview-body" dangerouslySetInnerHTML={{ __html: (s.content || '').replace(/&nbsp;/g, ' ') }} />
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

export default LeagueRulesAdmin;
