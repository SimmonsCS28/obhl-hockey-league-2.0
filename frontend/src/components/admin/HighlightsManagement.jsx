import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import './HighlightsManagement.css';

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;   // keep in step with HighlightStorageService
const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Widest a captured thumbnail is written at. The home page shows it in an ~880px box,
// so anything beyond this is bytes every visitor downloads and never sees.
const POSTER_MAX_WIDTH = 1600;

const fmtBytes = (bytes) => {
    if (bytes == null) return '—';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
};

const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s.endsWith('Z') ? s : s + 'Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtClock = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

function HighlightsManagement() {
    const [highlights, setHighlights] = useState([]);
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);

    // Form state
    const [editing, setEditing] = useState(null);   // null = create (with upload)
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [week, setWeek] = useState('');
    const [seasonId, setSeasonId] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Video + poster state (create only)
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);      // object URL for the preview
    const [duration, setDuration] = useState(0);
    const [frameTime, setFrameTime] = useState(0);
    const [posterBlob, setPosterBlob] = useState(null);
    const [posterPreview, setPosterPreview] = useState(null);
    const [posterMode, setPosterMode] = useState('frame'); // 'frame' | 'custom'
    const videoRef = useRef(null);

    useEffect(() => {
        loadHighlights();
        api.getSeasons()
            .then(setSeasons)
            .catch(err => console.error('Failed to load seasons:', err));
    }, []);

    // Object URLs leak until revoked, and a 25MB clip held in memory is worth
    // releasing as soon as the preview is replaced or the component unmounts.
    useEffect(() => () => {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        if (posterPreview) URL.revokeObjectURL(posterPreview);
    }, [videoUrl, posterPreview]);

    const loadHighlights = async () => {
        try {
            setLoading(true);
            const data = await api.getHighlights(false); // include hidden ones
            setHighlights(data);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load highlights');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const setPoster = useCallback((blob) => {
        setPosterBlob(blob);
        setPosterPreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return blob ? URL.createObjectURL(blob) : null;
        });
    }, []);

    /**
     * Grabs the frame currently shown in the scrub <video> and turns it into a JPEG.
     * Done in the browser on purpose: pulling a frame server-side would mean shipping
     * ffmpeg into the api-gateway image for one still image per week. The object URL
     * is same-origin, so the canvas is not tainted and toBlob works.
     */
    const captureFrame = useCallback(() => {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;
        // Downscale wide source frames. Live Barn's panoramic export is ~4080px across,
        // which captures to a ~275KB JPEG that every home-page visitor then downloads to
        // display in an 880px box. Capping the width cuts that by roughly two thirds with
        // no visible difference at the size it is actually shown.
        const scale = Math.min(1, POSTER_MAX_WIDTH / v.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => { if (blob) setPoster(blob); }, 'image/jpeg', 0.85);
    }, [setPoster]);

    const handleVideoSelected = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.mp4')) {
            alert('Only .mp4 files are supported. Live Barn clips download as mp4 already.');
            e.target.value = '';
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            alert(`That clip is ${fmtBytes(file.size)}. The limit is 100 MB.`);
            e.target.value = '';
            return;
        }

        setVideoFile(file);
        setVideoUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
        setPosterMode('frame');
        setPoster(null);
        setFrameTime(0);
        setDuration(0);
        if (!title.trim()) {
            setTitle(file.name.replace(/\.mp4$/i, '').replace(/[_-]+/g, ' ').trim());
        }
    };

    // Once metadata is in we know the duration. Seek a second in, because frame zero
    // of a Live Barn clip is often black or a mid-cut frame.
    const handleLoadedMetadata = () => {
        const v = videoRef.current;
        if (!v) return;
        const d = v.duration || 0;
        setDuration(d);
        const start = Math.min(1, d / 2);
        setFrameTime(start);
        v.currentTime = start;
    };

    const handleSeeked = () => {
        if (posterMode === 'frame') captureFrame();
    };

    // Safety net for clips so short that the seek above lands on the frame already
    // displayed — no 'seeked' fires in that case, and without this the thumbnail
    // would sit on "Reading video…" forever.
    const handleLoadedData = () => {
        if (posterMode === 'frame' && !posterBlob) captureFrame();
    };

    const handleScrub = (e) => {
        const t = Number(e.target.value);
        setFrameTime(t);
        if (videoRef.current) videoRef.current.currentTime = t;
    };

    const handleCustomPoster = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!POSTER_TYPES.includes(file.type)) {
            alert('Poster image must be a JPEG, PNG or WebP.');
            e.target.value = '';
            return;
        }
        if (file.size > MAX_POSTER_BYTES) {
            alert(`That image is ${fmtBytes(file.size)}. The limit is 5 MB.`);
            e.target.value = '';
            return;
        }
        setPosterMode('custom');
        setPoster(file);
    };

    const useFrameInstead = () => {
        setPosterMode('frame');
        captureFrame();
    };

    const resetForm = () => {
        setEditing(null);
        setTitle('');
        setDescription('');
        setWeek('');
        setYoutubeUrl('');
        setIsActive(true);
        setVideoFile(null);
        setVideoUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        setPoster(null);
        setPosterMode('frame');
        setDuration(0);
        setFrameTime(0);
        setProgress(0);
        const active = seasons.find(s => s.isActive);
        setSeasonId(active ? String(active.id) : '');
    };

    const handleAddClick = () => {
        resetForm();
        setShowForm(true);
    };

    const handleEditClick = (h) => {
        setEditing(h);
        setTitle(h.title || '');
        setDescription(h.description || '');
        setWeek(h.week == null ? '' : String(h.week));
        setSeasonId(h.seasonId == null ? '' : String(h.seasonId));
        setYoutubeUrl(h.youtubeUrl || '');
        setIsActive(h.isActive !== false);
        setVideoFile(null);
        setVideoUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        setPoster(null);
        setShowForm(true);
    };

    const handleCancel = () => {
        resetForm();
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('A title is required.');
            return;
        }
        if (!editing && !videoFile) {
            alert('Choose an mp4 clip to upload.');
            return;
        }

        setSaving(true);
        setProgress(0);
        try {
            if (editing) {
                // Metadata only — the clip itself is not replaceable in place.
                await api.updateHighlight(editing.id, {
                    title: title.trim(),
                    description: description.trim() || null,
                    seasonId: seasonId ? Number(seasonId) : null,
                    week: week === '' ? null : Number(week),
                    youtubeUrl: youtubeUrl.trim() || null,
                    isActive,
                });
            } else {
                const fd = new FormData();
                fd.append('file', videoFile);
                if (posterBlob) {
                    const posterName = posterBlob instanceof File ? posterBlob.name : 'poster.jpg';
                    fd.append('poster', posterBlob, posterName);
                }
                fd.append('title', title.trim());
                if (description.trim()) fd.append('description', description.trim());
                // Omit rather than send empty strings: the backend binds these to
                // Long/Integer and a blank value fails conversion with a 400.
                if (seasonId) fd.append('seasonId', seasonId);
                if (week !== '') fd.append('week', week);
                if (youtubeUrl.trim()) fd.append('youtubeUrl', youtubeUrl.trim());
                fd.append('isActive', String(isActive));

                await api.uploadHighlight(fd, setProgress);
            }

            await loadHighlights();
            resetForm();
            setShowForm(false);
        } catch (err) {
            alert(err.message || 'Failed to save highlight');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (h) => {
        try {
            await api.toggleHighlightActive(h.id, !h.isActive);
            await loadHighlights();
        } catch (err) {
            alert(err.message || 'Failed to update status');
            console.error(err);
        }
    };

    const handleDelete = async (h) => {
        if (!window.confirm(`Delete "${h.title}"? The video file will be permanently removed.`)) return;
        try {
            await api.deleteHighlight(h.id);
            await loadHighlights();
        } catch (err) {
            alert(err.message || 'Failed to delete highlight');
            console.error(err);
        }
    };

    // Only the newest active highlight actually appears on the home page. The list is
    // returned newest-first, so the first active row is the live one.
    const liveId = highlights.find(h => h.isActive)?.id;

    return (
        <div className="highlights-management">
            <div className="management-header">
                <h2>🎬 Weekly Highlights</h2>
                <div className="header-actions">
                    <button onClick={handleAddClick} className="btn-add-highlight">
                        + New Highlight
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {showForm && (
                <div className="highlight-form-card">
                    <h3>{editing ? 'Edit Highlight' : 'Upload Highlight'}</h3>
                    <form onSubmit={handleSubmit} className="highlight-form">
                        {!editing && (
                            <div className="form-group">
                                <label>Video Clip (.mp4)</label>
                                <input type="file" accept="video/mp4,.mp4" onChange={handleVideoSelected} />
                                <span className="field-hint">
                                    Download the 30-second clip from Live Barn and pick it here. Max 100 MB.
                                </span>
                            </div>
                        )}

                        {!editing && videoUrl && (
                            <div className="hl-poster-picker">
                                <div className="hl-poster-preview-col">
                                    <label>Thumbnail</label>
                                    {posterPreview ? (
                                        <img src={posterPreview} alt="Highlight thumbnail preview" className="hl-poster-img" />
                                    ) : (
                                        <div className="hl-poster-img hl-poster-empty">Reading video…</div>
                                    )}
                                    <span className="field-hint">
                                        {posterMode === 'custom'
                                            ? 'Using your uploaded image.'
                                            : 'Captured from the clip — drag the slider to pick a different frame.'}
                                    </span>
                                </div>

                                <div className="hl-poster-controls">
                                    {/* Source of the captured frame. Visually small but really
                                        rendered — it must be in the document for the canvas draw. */}
                                    <video
                                        ref={videoRef}
                                        src={videoUrl}
                                        className="hl-scrub-video"
                                        muted
                                        playsInline
                                        preload="auto"
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onLoadedData={handleLoadedData}
                                        onSeeked={handleSeeked}
                                    />
                                    <div className="hl-scrub-row">
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 0}
                                            step="0.1"
                                            value={frameTime}
                                            onChange={handleScrub}
                                            disabled={!duration}
                                        />
                                        <span className="hl-scrub-time">
                                            {fmtClock(frameTime)} / {fmtClock(duration)}
                                        </span>
                                    </div>
                                    <div className="hl-poster-actions">
                                        {posterMode === 'custom' && (
                                            <button type="button" className="btn-secondary-small" onClick={useFrameInstead}>
                                                Use a frame instead
                                            </button>
                                        )}
                                        <label className="btn-secondary-small hl-upload-label">
                                            Upload custom image
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={handleCustomPoster}
                                                hidden
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="E.g., Shorthanded breakaway goal"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Optional — a sentence of context shown under the video."
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Season</label>
                                <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                                    <option value="">—</option>
                                    {seasons.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Week</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={week}
                                    onChange={(e) => setWeek(e.target.value)}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>YouTube Link</label>
                            <input
                                type="url"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="https://youtu.be/..."
                            />
                            <span className="field-hint">
                                Optional. If you also post the clip to the league channel, paste the link here
                                and a Watch on YouTube link appears under the video.
                            </span>
                        </div>

                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                />
                                Active (the newest active highlight is the one shown on the home page)
                            </label>
                        </div>

                        {saving && !editing && (
                            <div className="hl-progress">
                                <div className="hl-progress-bar" style={{ width: `${progress}%` }} />
                                <span className="hl-progress-label">
                                    {progress < 100 ? `Uploading… ${progress}%` : 'Processing…'}
                                </span>
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="submit" className="btn-save" disabled={saving}>
                                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Upload Highlight')}
                            </button>
                            <button type="button" onClick={handleCancel} className="btn-cancel" disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="highlights-table-container">
                    {loading ? (
                        <div className="loading">Loading highlights…</div>
                    ) : highlights.length === 0 ? (
                        <div className="empty-state">No highlights yet. Upload one to get started!</div>
                    ) : (
                        <table className="highlights-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Thumb</th>
                                    <th>Title</th>
                                    <th>Week</th>
                                    <th>Posted</th>
                                    <th>Size</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {highlights.map(h => (
                                    <tr key={h.id} className={!h.isActive ? 'inactive-row' : ''}>
                                        <td>
                                            <button
                                                className={`status-toggle ${h.isActive ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggleActive(h)}
                                                title={h.isActive ? 'Click to hide' : 'Click to show'}
                                            >
                                                {h.id === liveId ? '🟢 On Home' : h.isActive ? '🟡 Active' : '⚪ Hidden'}
                                            </button>
                                        </td>
                                        <td>
                                            {h.posterUrl
                                                ? <img src={h.posterUrl} alt="" className="hl-row-thumb" />
                                                : <span className="hl-row-thumb hl-row-thumb-empty">—</span>}
                                        </td>
                                        <td><strong>{h.title}</strong></td>
                                        <td>{h.week ?? '—'}</td>
                                        <td>{fmtDate(h.createdAt)}</td>
                                        <td>{fmtBytes(h.fileSizeBytes)}</td>
                                        <td className="actions-cell">
                                            <a href={h.videoUrl} target="_blank" rel="noopener noreferrer" className="btn-view-small">View</a>
                                            <button onClick={() => handleEditClick(h)} className="btn-edit-small">Edit</button>
                                            <button onClick={() => handleDelete(h)} className="btn-delete-small">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

export default HighlightsManagement;
