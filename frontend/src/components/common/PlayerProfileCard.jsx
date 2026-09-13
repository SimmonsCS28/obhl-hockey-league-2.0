import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveTeamColor, textOn } from '../../constants/teamColors';
import api from '../../services/api';
import {
    precheckPhoto, decodePhoto, previewGeometry, clampOffset, cropToBlob, ERR_DECODE
} from '../../utils/photoCrop';
import './PlayerProfileCard.css';

/**
 * The player profile card: one modal, two modes.
 *
 * Read mode is public and opens from any player row (Players page, team roster, the
 * dashboard banner). Edit mode is reachable only when the server says the viewer IS this
 * player (card.isSelf) — the client never decides ownership. Everything above the divider
 * is "this season" (team, #, position, from the row that was clicked); everything below is
 * "this person" and survives the draft.
 *
 * Photo saves are their own action, independent of the form's Save: pick → position the
 * square by dragging → "Save photo" → one upload. That is a deliberate change from the
 * design prototype, which re-uploaded on every drag release.
 *
 * Classnames are all obi-pcard-*: this codebase has no CSS scoping, and .modal-* /
 * .player-card are already defined several conflicting times.
 */

const FRAME = 104; // px, the photo preview window in edit mode (matches the read-mode avatar)
const NEUTRAL_DOT = '#3a424c';

const POSITION_LABELS = { F: 'Forward', C: 'Forward', LW: 'Forward', RW: 'Forward', D: 'Defense', G: 'Goalie' };
const posLabel = (p) => POSITION_LABELS[p] || p || '';

const initialsOf = (first, last) =>
    `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || 'OB';

const heightLabel = (inches) => {
    if (inches == null) return null;
    const ft = Math.floor(inches / 12);
    const rem = inches - ft * 12;
    return `${ft}'${rem}"`;
};

const shootsLabel = (s) => (s === 'L' ? 'Left' : s === 'R' ? 'Right' : null);

const BADGES = {
    gm: { label: 'GM', title: 'General manager of this team', cls: 'is-gm' },
    vet: { label: 'VET', title: 'Veteran', cls: 'is-vet' },
    '2gl': { label: '2GL', title: 'Two-goal limit', cls: 'is-2gl' }
};

// Hex + alpha, for the team wash / pill tints. Named colours resolve through the theme map.
const withAlpha = (color, alphaHex) => {
    const hex = resolveTeamColor(color);
    return hex.startsWith('#') && hex.length === 7 ? `${hex}${alphaHex}` : hex;
};

const todayMinusYears = (n) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    return d;
};

function validateForm(f) {
    const errors = {};
    if (f.birthDate) {
        const d = new Date(`${f.birthDate}T00:00:00`);
        if (Number.isNaN(d.getTime()) || d > todayMinusYears(16) || d < todayMinusYears(100)) {
            errors.birthDate = 'Enter a valid birth date.';
        }
    }
    if ((f.hometown || '').length > 100) errors.hometown = 'Keep it under 100 characters.';
    const feet = f.feet === '' ? null : Number(f.feet);
    const inches = f.inches === '' ? null : Number(f.inches);
    if (feet != null || inches != null) {
        const total = (feet || 0) * 12 + (inches || 0);
        if (!Number.isInteger(total) || total < 48 || total > 96 || (inches != null && (inches < 0 || inches > 11))) {
            errors.height = 'Enter a height between 4\'0" and 8\'0".';
        }
    }
    if (f.weight !== '') {
        const w = Number(f.weight);
        if (!Number.isInteger(w) || w < 80 || w > 400) errors.weight = 'Enter a weight between 80 and 400 lb.';
    }
    return errors;
}

function formFromProfile(p) {
    const h = p?.heightInches;
    return {
        birthDate: p?.birthDate || '',
        hometown: p?.hometown || '',
        feet: h != null ? String(Math.floor(h / 12)) : '',
        inches: h != null ? String(h % 12) : '',
        weight: p?.weightLbs != null ? String(p.weightLbs) : '',
        shoots: p?.shoots || '',
        usePhotoAvatar: !!p?.usePhotoAvatar
    };
}

function payloadFromForm(f) {
    const feet = f.feet === '' ? null : Number(f.feet);
    const inches = f.inches === '' ? null : Number(f.inches);
    return {
        birthDate: f.birthDate || null,
        hometown: f.hometown.trim() || null,
        heightInches: feet == null && inches == null ? null : (feet || 0) * 12 + (inches || 0),
        weightLbs: f.weight === '' ? null : Number(f.weight),
        shoots: f.shoots || null,
        usePhotoAvatar: !!f.usePhotoAvatar
    };
}

export default function PlayerProfileCard({ playerId, onClose }) {
    const { isAdmin } = useAuth();

    const [load, setLoad] = useState('loading'); // loading | ready | error
    const [card, setCard] = useState(null);
    const [mode, setMode] = useState('read');    // read | edit
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    // edit mode
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState(formFromProfile(null));
    const [initialForm, setInitialForm] = useState(formFromProfile(null));
    const [touched, setTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    // photo
    const [pending, setPending] = useState(null);   // { decoded, geometry, x, y }
    const [dragging, setDragging] = useState(false);
    const [uploadPct, setUploadPct] = useState(null); // null = not uploading
    const [photoError, setPhotoError] = useState('');
    const [photoNotice, setPhotoNotice] = useState('');
    const [photoBusy, setPhotoBusy] = useState(false);

    const fileInputRef = useRef(null);
    const panelRef = useRef(null);
    const dragRef = useRef(null);

    // ── data ──
    const fetchCard = useCallback(async () => {
        setLoad('loading');
        try {
            const data = await api.getPlayerCard(playerId);
            setCard(data);
            setLoad('ready');
        } catch {
            setLoad('error');
        }
    }, [playerId]);

    useEffect(() => { fetchCard(); }, [fetchCard]);

    // ── modal mechanics (Escape, focus trap, scroll lock, focus restore) — same as DraftModal ──
    const modeRef = useRef(mode);
    const dirtyRef = useRef(false);
    const pendingRef = useRef(false);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);
    useEffect(() => { modeRef.current = mode; dirtyRef.current = dirty; pendingRef.current = !!pending; }, [mode, dirty, pending]);

    const requestClose = useCallback(() => {
        if (modeRef.current === 'edit' && (dirtyRef.current || pendingRef.current)) {
            setConfirmDiscard(true);
            return;
        }
        onCloseRef.current();
    }, []);

    useEffect(() => {
        const returnTo = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusables = () => Array.from(
            panelRef.current ? panelRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') : []
        ).filter(el => !el.disabled && el.offsetParent !== null);

        const onKeyDown = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); requestClose(); return; }
            if (e.key !== 'Tab') return;
            const items = focusables();
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.body.style.overflow = previousOverflow;
            if (returnTo && typeof returnTo.focus === 'function') returnTo.focus();
        };
    }, [requestClose]);

    // Park focus once content is in (not on mount: the skeleton has nothing to focus). Prefer a
    // control in the body, then the footer's Close, then the ×: opening a dialog with focus on
    // "close" is a poor place to start, and the × is the last resort.
    useEffect(() => {
        if (load !== 'ready') return;
        const panel = panelRef.current;
        const target = panel?.querySelector('.obi-pcard-body button, .obi-pcard-body input')
            || panel?.querySelector('.obi-pcard-foot button')
            || panel?.querySelector('.obi-pcard-x');
        target?.focus?.();
    }, [load, mode]);

    // Release the decoded bitmap when the pending photo is replaced, dropped, saved, or the
    // card unmounts. Keyed on the decoded image, NOT on `pending` — dragging updates x/y on
    // every pointer move and would otherwise close the bitmap mid-drag.
    const pendingDecoded = pending?.decoded;
    useEffect(() => () => { pendingDecoded?.release?.(); }, [pendingDecoded]);

    // ── edit mode ──
    const startEdit = async () => {
        setSaveError('');
        setFieldErrors({});
        setPhotoError('');
        setPhotoNotice('');
        try {
            const p = await api.getMyPlayerProfile();
            setProfile(p);
            const f = formFromProfile(p);
            setForm(f);
            setInitialForm(f);
            setTouched(false);
            setMode('edit');
        } catch (err) {
            setSaveError(err.message || "Couldn't open your profile.");
        }
    };

    const leaveEdit = () => {
        setPending(null);
        setConfirmDiscard(false);
        setMode('read');
        fetchCard();
    };

    const requestCancel = () => {
        if (dirty || pending) { setConfirmDiscard(true); return; }
        leaveEdit();
    };

    const setField = (key, value) => {
        setTouched(true);
        setSaveError('');
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const errors = useMemo(() => (touched ? validateForm(form) : {}), [form, touched]);
    const anyError = Object.keys(errors).length > 0;
    const shownErrors = { ...fieldErrors, ...errors };

    const save = async () => {
        if (!dirty || anyError || saving) return;
        setSaving(true);
        setSaveError('');
        setFieldErrors({});
        try {
            const updated = await api.updateMyPlayerProfile(payloadFromForm(form));
            setProfile(updated);
            const f = formFromProfile(updated);
            setForm(f);
            setInitialForm(f);
            setSaving(false);
            leaveEdit();
        } catch (err) {
            setSaving(false);
            setSaveError(err.message || "Couldn't save your profile. Try again.");
        }
    };

    // ── photo ──
    const pickPhoto = () => fileInputRef.current?.click();

    const onFileChosen = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setPhotoError('');
        setPhotoNotice('');
        const pre = precheckPhoto(file);
        if (pre) { setPhotoError(pre); return; }
        try {
            const decoded = await decodePhoto(file);
            const geometry = previewGeometry(decoded.width, decoded.height, FRAME);
            setPending({ decoded, geometry, x: geometry.startX, y: geometry.startY });
        } catch {
            setPhotoError(ERR_DECODE);
        }
    };

    const dropPending = () => {
        setPending(null);
        setPhotoError('');
    };

    const savePhoto = async () => {
        if (!pending || photoBusy) return;
        setPhotoBusy(true);
        setPhotoError('');
        setUploadPct(0);
        try {
            const blob = await cropToBlob(pending.decoded, pending.geometry, pending.x, pending.y, FRAME);
            const updated = await api.uploadMyPlayerPhoto(blob, setUploadPct);
            setProfile(updated);
            setPending(null);
            setPhotoNotice('✓ Photo saved — no need to hit Save.');
        } catch (err) {
            setPhotoError(err.message || ERR_DECODE);
        } finally {
            setUploadPct(null);
            setPhotoBusy(false);
        }
    };

    const removeOwnPhoto = async () => {
        if (photoBusy) return;
        setPhotoBusy(true);
        setPhotoError('');
        try {
            await api.deleteMyPlayerPhoto();
            setProfile(prev => ({ ...prev, photoUrl: null }));
            setPhotoNotice('✓ Photo removed.');
        } catch (err) {
            setPhotoError(err.message || "Couldn't remove the photo.");
        } finally {
            setPhotoBusy(false);
        }
    };

    // drag-to-reposition on the pending preview (mouse + touch via pointer events)
    const onPointerDown = (e) => {
        if (!pending) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, x: pending.x, y: pending.y };
        setDragging(true);
    };
    const onPointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag || !pending) return;
        // Compute the target offset NOW, not inside the updater: pointerup can null the ref
        // before React runs a queued functional update, which crashed with "reading 'x' of null".
        const nextX = drag.x + (e.clientX - drag.startX);
        const nextY = drag.y + (e.clientY - drag.startY);
        setPending(prev => prev && ({
            ...prev,
            x: clampOffset(nextX, prev.geometry.minX),
            y: clampOffset(nextY, prev.geometry.minY)
        }));
    };
    const onPointerUp = () => { dragRef.current = null; setDragging(false); };

    // pending preview canvas
    const previewCanvasRef = useRef(null);
    useEffect(() => {
        if (!pending || !previewCanvasRef.current) return;
        const c = previewCanvasRef.current;
        const { width, height } = pending.geometry;
        c.width = Math.round(width);
        c.height = Math.round(height);
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(pending.decoded.source, 0, 0, c.width, c.height);
    }, [pending?.decoded, pending?.geometry]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── admin moderation ──
    const adminRemovePhoto = async () => {
        try {
            await api.adminDeletePlayerPhoto(playerId);
            setConfirmRemove(false);
            fetchCard();
        } catch (err) {
            setConfirmRemove(false);
            setSaveError(err.message || "Couldn't remove the photo.");
        }
    };

    // ── derived display ──
    const teamColor = resolveTeamColor(card?.team?.teamColor);
    const hasTeam = !!card?.team;
    const avatarBg = hasTeam ? teamColor : NEUTRAL_DOT;
    const initials = initialsOf(card?.firstName, card?.lastName);
    const fullName = card ? `${card.firstName || ''} ${card.lastName || ''}`.trim() : '';
    const numberAndPos = card
        ? `${card.jerseyNumber != null ? `#${card.jerseyNumber} · ` : ''}${posLabel(card.position)}`
        : '';
    const eyebrow = card
        ? `${card.seasonName || 'Season'} · ${card.seasonIsCurrent ? 'this season' : 'as drafted'}`
        : '';
    const badges = card ? [
        card.badges?.isGm && BADGES.gm,
        card.badges?.isVeteran && BADGES.vet,
        card.badges?.twoGoalLimit && BADGES['2gl']
    ].filter(Boolean) : [];

    const details = card ? [
        card.age != null && { label: 'Age', value: String(card.age) },
        card.hometown && { label: 'Hometown', value: card.hometown },
        card.heightInches != null && { label: 'Height', value: heightLabel(card.heightInches) },
        card.weightLbs != null && { label: 'Weight', value: `${card.weightLbs} lb` },
        shootsLabel(card.shoots) && { label: 'Shoots', value: shootsLabel(card.shoots) }
    ].filter(Boolean) : [];

    const history = card?.seasonHistory || [];
    const showOnboard = !!card?.isSelf && details.length === 0 && !card?.photoUrl;
    const editPhotoUrl = profile?.photoUrl ?? card?.photoUrl;

    const scrimClick = () => {
        if (mode === 'edit') { if (dirty || pending) setConfirmDiscard(true); return; }
        onClose();
    };

    // ── render ──
    return (
        <div className="obi-pcard-scrim" onClick={scrimClick}>
            <div
                className="obi-pcard"
                role="dialog"
                aria-modal="true"
                aria-label={mode === 'edit' ? 'Edit my profile' : 'Player profile'}
                onClick={(e) => e.stopPropagation()}
                ref={panelRef}
            >
                <div className="obi-pcard-head">
                    <span className="obi-pcard-eyebrow">{mode === 'edit' ? 'Edit my profile' : 'Player profile'}</span>
                    <button type="button" className="obi-pcard-x" onClick={requestClose} aria-label="Close">×</button>
                </div>

                {load === 'loading' && (
                    <div className="obi-pcard-loading" aria-busy="true">
                        <div className="obi-pcard-skel-id">
                            <div className="obi-pcard-skel-avatar" />
                            <div className="obi-pcard-skel-lines">
                                <span style={{ width: '62%', height: 22 }} />
                                <span style={{ width: '44%' }} />
                                <span style={{ width: '34%' }} />
                            </div>
                        </div>
                        <div className="obi-pcard-skel-grid"><span /><span /><span /><span /></div>
                        <div className="obi-pcard-skel-note">Loading profile…</div>
                    </div>
                )}

                {load === 'error' && (
                    <div className="obi-pcard-error">
                        <div className="obi-pcard-error-disc">!</div>
                        <div className="obi-pcard-error-title">Couldn't load this player</div>
                        <div className="obi-pcard-error-sub">Check your connection and try again.</div>
                        <div className="obi-pcard-error-actions">
                            <button type="button" className="obi-pcard-btn obi-pcard-btn-primary" onClick={fetchCard}>Try again</button>
                            <button type="button" className="obi-pcard-btn obi-pcard-btn-ghost" onClick={onClose}>Close</button>
                        </div>
                    </div>
                )}

                {load === 'ready' && mode === 'read' && card && (
                    <>
                        <div className="obi-pcard-body">
                            {/* identity: this season */}
                            <div className="obi-pcard-identity">
                                <div
                                    className="obi-pcard-wash"
                                    style={{ background: `linear-gradient(160deg, ${hasTeam ? withAlpha(teamColor, '26') : 'rgba(157,185,205,0.08)'}, rgba(22,27,34,0) 62%)` }}
                                />
                                <div className="obi-pcard-identity-inner">
                                    {card.photoUrl ? (
                                        <img className="obi-pcard-avatar" src={card.photoUrl} alt="" />
                                    ) : (
                                        <div className="obi-pcard-avatar obi-pcard-initials" style={{ background: avatarBg, color: textOn(avatarBg) }}>{initials}</div>
                                    )}
                                    <div className="obi-pcard-id">
                                        <div className="obi-pcard-season-eyebrow">{eyebrow}</div>
                                        <div className="obi-pcard-name">{fullName}</div>
                                        <div className="obi-pcard-line">
                                            <span
                                                className="obi-pcard-team-pill"
                                                style={hasTeam
                                                    ? { background: withAlpha(teamColor, '26'), borderColor: withAlpha(teamColor, '66') }
                                                    : undefined}
                                            >
                                                <span className="obi-pcard-dot" style={{ background: hasTeam ? teamColor : NEUTRAL_DOT }} />
                                                {hasTeam ? card.team.name : 'Free agent'}
                                            </span>
                                            <span className="obi-pcard-numpos">{numberAndPos}</span>
                                        </div>
                                        {badges.length > 0 && (
                                            <div className="obi-pcard-badges">
                                                {badges.map(b => (
                                                    <span key={b.label} className={`obi-pcard-badge ${b.cls}`} title={b.title}>{b.label}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {saveError && <div className="obi-pcard-banner">{saveError}</div>}

                            {/* self, nothing yet: onboarding */}
                            {showOnboard && (
                                <div className="obi-pcard-onboard">
                                    <div className="obi-pcard-onboard-title">Add your photo and details</div>
                                    <div className="obi-pcard-onboard-sub">A face and a hometown make the roster feel like a locker room. Takes a minute, and it carries to every future season.</div>
                                    <button type="button" className="obi-pcard-btn obi-pcard-btn-primary" onClick={startEdit}>Set up my profile</button>
                                </div>
                            )}

                            {/* details: this person */}
                            <div className="obi-pcard-section">
                                <div className="obi-pcard-section-title">Details</div>
                                {details.length > 0 ? (
                                    <div className="obi-pcard-details">
                                        {details.map(d => (
                                            <div key={d.label} className="obi-pcard-detail">
                                                <div className="obi-pcard-detail-label">{d.label}</div>
                                                <div className="obi-pcard-detail-value">{d.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : !showOnboard && (
                                    <div className="obi-pcard-empty">No profile details yet.</div>
                                )}
                            </div>

                            {/* season history */}
                            <div className="obi-pcard-section obi-pcard-history">
                                <div className="obi-pcard-section-head">
                                    <span className="obi-pcard-section-title">Season history</span>
                                    <span className="obi-pcard-section-count">{history.length} {history.length === 1 ? 'season' : 'seasons'}</span>
                                </div>
                                <div className="obi-pcard-hist-list">
                                    {history.map(h => {
                                        const hc = h.team ? resolveTeamColor(h.team.teamColor) : NEUTRAL_DOT;
                                        const isT = h.seasonType === 'TOURNAMENT';
                                        return (
                                            <div key={h.seasonId} className={`obi-pcard-hist-row ${h.isCurrent ? 'is-current' : ''} ${isT ? 'is-tournament' : ''}`}>
                                                <span className="obi-pcard-hist-bar" />
                                                <span className="obi-pcard-hist-season">
                                                    {isT && <span className="obi-pcard-hist-tag">Tournament</span>}
                                                    <span className="obi-pcard-hist-season-name">{h.seasonName}</span>
                                                </span>
                                                <span className="obi-pcard-hist-team">
                                                    <span className="obi-pcard-dot" style={{ background: hc }} />
                                                    <span className={`obi-pcard-hist-team-name ${h.team ? '' : 'is-free'}`}>{h.team ? h.team.name : 'Free agent'}</span>
                                                </span>
                                                <span className="obi-pcard-hist-pos">{posLabel(h.position)}</span>
                                                <span className={`obi-pcard-hist-num ${h.jerseyNumber == null ? 'is-none' : ''}`}>{h.jerseyNumber != null ? `#${h.jerseyNumber}` : '—'}</span>
                                                <span className="obi-pcard-hist-now-slot">{h.isCurrent && <span className="obi-pcard-now">Now</span>}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {history.length === 1 && <div className="obi-pcard-rookie">First season. This list grows every draft.</div>}
                            </div>

                            {/* admin: inline confirm */}
                            {confirmRemove && (
                                <div className="obi-pcard-confirm">
                                    <div className="obi-pcard-confirm-title">Remove this player's photo?</div>
                                    <div className="obi-pcard-confirm-sub">The card falls back to initials. The player can upload a new one; the removed file can't be restored.</div>
                                    <div className="obi-pcard-confirm-actions">
                                        <button type="button" className="obi-pcard-btn obi-pcard-btn-danger" onClick={adminRemovePhoto}>Remove photo</button>
                                        <button type="button" className="obi-pcard-btn obi-pcard-btn-ghost obi-pcard-btn-sm" onClick={() => setConfirmRemove(false)}>Keep it</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="obi-pcard-foot">
                            {isAdmin && card.photoUrl && !confirmRemove && (
                                <button type="button" className="obi-pcard-btn obi-pcard-btn-danger-outline" onClick={() => setConfirmRemove(true)}>Remove photo</button>
                            )}
                            <span className="obi-pcard-foot-spacer" />
                            <button type="button" className="obi-pcard-btn obi-pcard-btn-ghost" onClick={onClose}>Close</button>
                            {card.isSelf && (
                                <button type="button" className="obi-pcard-btn obi-pcard-btn-primary" onClick={startEdit}>Edit Profile</button>
                            )}
                        </div>
                    </>
                )}

                {load === 'ready' && mode === 'edit' && card && (
                    <div className="obi-pcard-body obi-pcard-edit">
                        {saveError && <div className="obi-pcard-banner"><b>!</b><span>{saveError}</span></div>}

                        {/* photo editor */}
                        <div className="obi-pcard-photo-editor">
                            <div className="obi-pcard-photo-frame-wrap">
                                {pending ? (
                                    <div
                                        className={`obi-pcard-photo-frame is-pending ${dragging ? 'is-dragging' : ''}`}
                                        title="Drag to reposition"
                                        onPointerDown={onPointerDown}
                                        onPointerMove={onPointerMove}
                                        onPointerUp={onPointerUp}
                                        onPointerCancel={onPointerUp}
                                    >
                                        <canvas
                                            ref={previewCanvasRef}
                                            className="obi-pcard-photo-canvas"
                                            style={{ left: pending.x, top: pending.y, width: pending.geometry.width, height: pending.geometry.height }}
                                        />
                                        <div className="obi-pcard-photo-grid" />
                                        <div className="obi-pcard-photo-hint">{dragging ? 'release' : 'drag to reposition'}</div>
                                    </div>
                                ) : editPhotoUrl ? (
                                    <img className="obi-pcard-photo-frame" src={editPhotoUrl} alt="" />
                                ) : (
                                    <div className="obi-pcard-photo-frame obi-pcard-initials" style={{ background: avatarBg, color: textOn(avatarBg) }}>{initials}</div>
                                )}
                                {uploadPct != null && (
                                    <div className="obi-pcard-upload-veil">
                                        <div className="obi-pcard-upload-pct">{uploadPct}%</div>
                                        <div className="obi-pcard-upload-bar"><div style={{ width: `${uploadPct}%` }} /></div>
                                    </div>
                                )}
                            </div>
                            <div className="obi-pcard-photo-side">
                                <div className="obi-pcard-section-title">Photo</div>
                                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileChosen} />
                                <div className="obi-pcard-photo-actions">
                                    {pending ? (
                                        <>
                                            <button type="button" className="obi-pcard-btn obi-pcard-btn-primary obi-pcard-btn-sm" onClick={savePhoto} disabled={photoBusy}>Save photo</button>
                                            <button type="button" className="obi-pcard-btn obi-pcard-btn-ghost obi-pcard-btn-sm" onClick={dropPending} disabled={photoBusy}>Cancel</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="obi-pcard-btn obi-pcard-btn-gold-soft obi-pcard-btn-sm" onClick={pickPhoto} disabled={photoBusy}>
                                                {editPhotoUrl ? 'Replace photo' : 'Upload photo'}
                                            </button>
                                            {editPhotoUrl && (
                                                <button type="button" className="obi-pcard-btn obi-pcard-btn-ghost obi-pcard-btn-sm" onClick={removeOwnPhoto} disabled={photoBusy}>Remove</button>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="obi-pcard-hint">
                                    {pending
                                        ? 'Drag the photo to line it up, then save it.'
                                        : 'JPG or PNG, up to 5 MB. We square-crop it for you — drag the photo to line it up.'}
                                </div>
                                {photoError && <div className="obi-pcard-photo-error">{photoError}</div>}
                                {photoNotice && !photoError && <div className="obi-pcard-photo-ok">{photoNotice}</div>}
                            </div>
                        </div>

                        {/* read-only league context */}
                        <div className="obi-pcard-context">
                            <div className="obi-pcard-context-row">
                                <span className="obi-pcard-context-name">{fullName}</span>
                                <span className="obi-pcard-context-team"><span className="obi-pcard-dot" style={{ background: hasTeam ? teamColor : NEUTRAL_DOT }} />{hasTeam ? card.team.name : 'Free agent'}</span>
                                <span className="obi-pcard-context-numpos">{numberAndPos}</span>
                            </div>
                            <div className="obi-pcard-hint">Your name, team, and number are set by the league and your GM.</div>
                        </div>

                        {/* dashboard avatar preference — a profile setting, so it saves with the form */}
                        <div className="obi-pcard-field">
                            <span className="obi-pcard-label">Dashboard avatar</span>
                            <label className={`obi-pcard-toggle ${editPhotoUrl ? '' : 'is-muted'}`}>
                                <input
                                    type="checkbox"
                                    className="obi-pcard-toggle-input"
                                    checked={form.usePhotoAvatar}
                                    onChange={(e) => setField('usePhotoAvatar', e.target.checked)}
                                />
                                <span className="obi-pcard-toggle-track" aria-hidden="true"><span className="obi-pcard-toggle-thumb" /></span>
                                <span className="obi-pcard-toggle-text">
                                    <span className="obi-pcard-toggle-title">Show my photo instead of my initials</span>
                                    <span className="obi-pcard-toggle-sub">
                                        {editPhotoUrl
                                            ? 'Replaces the initials badge on your dashboard. Your card always shows the photo.'
                                            : 'Save a photo first — until then your initials stay on the dashboard.'}
                                    </span>
                                </span>
                            </label>
                        </div>

                        {/* fields */}
                        <div className="obi-pcard-field">
                            <label className="obi-pcard-label" htmlFor="obi-pcard-birth">Birth date</label>
                            <input
                                id="obi-pcard-birth"
                                type="date"
                                className={`obi-pcard-input ${shownErrors.birthDate ? 'is-invalid' : ''}`}
                                value={form.birthDate}
                                onChange={(e) => setField('birthDate', e.target.value)}
                                max={todayMinusYears(16).toISOString().slice(0, 10)}
                                min={todayMinusYears(100).toISOString().slice(0, 10)}
                            />
                            <div className="obi-pcard-hint">Only your age is shown on your card.</div>
                            {shownErrors.birthDate && <div className="obi-pcard-field-error">{shownErrors.birthDate}</div>}
                        </div>

                        <div className="obi-pcard-field">
                            <div className="obi-pcard-label-row">
                                <label className="obi-pcard-label" htmlFor="obi-pcard-hometown">Hometown</label>
                                <span className={`obi-pcard-count ${form.hometown.length > 100 ? 'is-over' : ''}`}>{form.hometown.length} / 100</span>
                            </div>
                            <input
                                id="obi-pcard-hometown"
                                type="text"
                                className={`obi-pcard-input ${shownErrors.hometown ? 'is-invalid' : ''}`}
                                value={form.hometown}
                                onChange={(e) => setField('hometown', e.target.value)}
                                placeholder="City, Province / State"
                                maxLength={120}
                            />
                            {shownErrors.hometown && <div className="obi-pcard-field-error">{shownErrors.hometown}</div>}
                        </div>

                        <div className="obi-pcard-field-row">
                            <div className="obi-pcard-field obi-pcard-field-height">
                                <label className="obi-pcard-label" htmlFor="obi-pcard-feet">Height</label>
                                <div className="obi-pcard-units">
                                    <input id="obi-pcard-feet" type="number" inputMode="numeric" min="4" max="8" placeholder="6"
                                        className={`obi-pcard-input obi-pcard-input-num ${shownErrors.height || shownErrors.heightInches ? 'is-invalid' : ''}`}
                                        value={form.feet} onChange={(e) => setField('feet', e.target.value)} />
                                    <span className="obi-pcard-unit">ft</span>
                                    <input type="number" inputMode="numeric" min="0" max="11" placeholder="1" aria-label="inches"
                                        className={`obi-pcard-input obi-pcard-input-num ${shownErrors.height || shownErrors.heightInches ? 'is-invalid' : ''}`}
                                        value={form.inches} onChange={(e) => setField('inches', e.target.value)} />
                                    <span className="obi-pcard-unit">in</span>
                                </div>
                                {(shownErrors.height || shownErrors.heightInches) && <div className="obi-pcard-field-error">{shownErrors.height || shownErrors.heightInches}</div>}
                            </div>
                            <div className="obi-pcard-field obi-pcard-field-weight">
                                <label className="obi-pcard-label" htmlFor="obi-pcard-weight">Weight</label>
                                <div className="obi-pcard-units">
                                    <input id="obi-pcard-weight" type="number" inputMode="numeric" min="80" max="400" placeholder="185"
                                        className={`obi-pcard-input obi-pcard-input-num obi-pcard-input-weight ${shownErrors.weight || shownErrors.weightLbs ? 'is-invalid' : ''}`}
                                        value={form.weight} onChange={(e) => setField('weight', e.target.value)} />
                                    <span className="obi-pcard-unit">lb</span>
                                </div>
                                {(shownErrors.weight || shownErrors.weightLbs) && <div className="obi-pcard-field-error">{shownErrors.weight || shownErrors.weightLbs}</div>}
                            </div>
                        </div>

                        <div className="obi-pcard-field">
                            <span className="obi-pcard-label">Shoots</span>
                            <div className="obi-pcard-seg" role="radiogroup" aria-label="Shoots">
                                {[['L', 'Left'], ['R', 'Right'], ['', '—']].map(([val, label]) => (
                                    <button
                                        key={label}
                                        type="button"
                                        role="radio"
                                        aria-checked={form.shoots === val}
                                        title={val ? label : 'Not set'}
                                        className={`obi-pcard-seg-btn ${form.shoots === val ? 'is-on' : ''} ${val ? '' : 'is-clear'}`}
                                        onClick={() => setField('shoots', val)}
                                    >{label}</button>
                                ))}
                            </div>
                            <div className="obi-pcard-hint">Goalies usually leave this blank — tap the dash to clear it.</div>
                        </div>

                        <div className="obi-pcard-edit-foot">
                            <button type="button" className="obi-pcard-btn obi-pcard-btn-ghost obi-pcard-btn-cancel" onClick={requestCancel}>Cancel</button>
                            <button
                                type="button"
                                className="obi-pcard-btn obi-pcard-btn-primary obi-pcard-btn-save"
                                onClick={save}
                                disabled={!dirty || anyError || saving}
                            >{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                )}

                {confirmDiscard && (
                    <div className="obi-pcard-discard-veil">
                        <div className="obi-pcard-discard">
                            <div className="obi-pcard-discard-title">Discard your changes?</div>
                            <div className="obi-pcard-discard-sub">
                                {pending
                                    ? "The photo you picked hasn't been saved yet, and neither have the details you typed."
                                    : "Your photo is already saved. The details you just typed aren't."}
                            </div>
                            <div className="obi-pcard-discard-actions">
                                <button type="button" className="obi-pcard-btn obi-pcard-btn-primary" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
                                <button type="button" className="obi-pcard-btn obi-pcard-btn-danger-soft" onClick={leaveEdit}>Discard</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
