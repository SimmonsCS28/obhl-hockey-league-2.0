import { useEffect, useState } from 'react';
import api from '../../services/api';
import { themeIsDesigned } from '../common/useHolidayTheme';
import {
    HOLIDAYS,
    getDefaultWindow,
    getUpcomingOccurrence,
    isEnabled,
    resolveActiveTheme,
} from '../../utils/holidayTheme';
import './HolidayThemesAdmin.css';

const fmt = (ymd) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC',
    });
};

/**
 * Admin panel for the public site's holiday themes: a master Auto/Off switch, and per holiday an
 * on/off toggle plus start/end dates pre-filled with the default window. Edited dates apply to
 * that one occurrence only; next year falls back to the default (Easter moves every year).
 */
function HolidayThemesAdmin() {
    const [saved, setSaved] = useState(null);
    const [mode, setMode] = useState('auto');
    const [overrides, setOverrides] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [banner, setBanner] = useState(null);

    useEffect(() => {
        api.getHolidayThemeConfig()
            .then(c => {
                setSaved(c);
                setMode(c.mode || 'auto');
                setOverrides(c.overrides || {});
            })
            .catch(e => setBanner({ type: 'error', text: e.message }))
            .finally(() => setLoading(false));
    }, []);

    const draft = { mode, overrides };
    const dirty = saved && JSON.stringify(draft) !== JSON.stringify({ mode: saved.mode, overrides: saved.overrides || {} });
    const activeNow = resolveActiveTheme(draft);

    const rows = HOLIDAYS.map(h => {
        const occ = getUpcomingOccurrence(h.key, overrides);
        return { ...h, occ, enabled: isEnabled(h.key, overrides), invalid: occ.start > occ.end };
    });
    const hasInvalid = rows.some(r => r.invalid);

    const patch = (key, changes) =>
        setOverrides(prev => ({ ...prev, [key]: { ...prev[key], ...changes } }));

    const setDate = (row, field, value) => {
        if (!value) return;
        patch(row.key, {
            year: row.occ.year,
            start: row.occ.start,
            end: row.occ.end,
            [field]: value,
        });
    };

    const resetDates = (key) =>
        setOverrides(prev => {
            const { year: _y, start: _s, end: _e, ...rest } = prev[key] || {};
            return { ...prev, [key]: rest };
        });

    const save = async () => {
        setSaving(true);
        setBanner(null);
        try {
            const c = await api.saveHolidayThemeConfig(draft);
            setSaved(c);
            setMode(c.mode);
            setOverrides(c.overrides || {});
            setBanner({ type: 'ok', text: 'Holiday themes saved.' });
        } catch (e) {
            setBanner({ type: 'error', text: e.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="obi-ht"><p className="obi-ht-muted">Loading…</p></div>;

    return (
        <div className="obi-ht">
            {banner && (
                <div className={`obi-ht-banner obi-ht-banner--${banner.type}`}>{banner.text}</div>
            )}

            <section className="obi-ht-card">
                <div className="obi-ht-card-hd">
                    <div>
                        <h3>Holiday Themes</h3>
                        <p>
                            Dresses up the public site for holidays. Month themes turn on the 1st of the
                            month; Easter and New Year&apos;s Eve turn on the day of. Change the dates for
                            this year&apos;s run below. Next year goes back to the defaults.
                        </p>
                    </div>
                    <div className="obi-ht-seg" role="group" aria-label="Holiday themes">
                        {['auto', 'off'].map(m => (
                            <button
                                key={m}
                                className={`obi-ht-seg-btn ${mode === m ? 'is-on' : ''}`}
                                onClick={() => setMode(m)}
                                aria-pressed={mode === m}
                            >
                                {m === 'auto' ? 'Auto' : 'Off'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`obi-ht-table-wrap ${mode === 'off' ? 'is-off' : ''}`}>
                    <table className="obi-ht-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Holiday</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Status</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => {
                                const def = getDefaultWindow(r.key, r.occ.year);
                                return (
                                    <tr key={r.key} className={r.enabled ? '' : 'is-disabled'}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={r.enabled}
                                                onChange={e => patch(r.key, { enabled: e.target.checked })}
                                                aria-label={`${r.name} theme on`}
                                            />
                                        </td>
                                        <td className="obi-ht-name">{r.name}</td>
                                        <td>
                                            <input
                                                type="date"
                                                className="obi-ht-date"
                                                value={r.occ.start}
                                                onChange={e => setDate(r, 'start', e.target.value)}
                                                disabled={!r.enabled}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="date"
                                                className="obi-ht-date"
                                                value={r.occ.end}
                                                onChange={e => setDate(r, 'end', e.target.value)}
                                                disabled={!r.enabled}
                                            />
                                        </td>
                                        <td>
                                            <div className="obi-ht-status">
                                                {r.invalid && <span className="obi-ht-pill obi-ht-pill--error">End before start</span>}
                                                {mode === 'auto' && activeNow === r.key && <span className="obi-ht-pill obi-ht-pill--live">On now</span>}
                                                {r.occ.custom && (
                                                    <span className="obi-ht-pill" title={`Default: ${fmt(def.start)} – ${fmt(def.end)}`}>
                                                        Custom dates
                                                    </span>
                                                )}
                                                {!themeIsDesigned(r.key) && <span className="obi-ht-pill obi-ht-pill--muted">Design pending</span>}
                                            </div>
                                        </td>
                                        <td className="obi-ht-actions">
                                            {r.occ.custom && (
                                                <button className="obi-ht-link" onClick={() => resetDates(r.key)}>
                                                    Reset to default
                                                </button>
                                            )}
                                            <a className="obi-ht-link" href={`/?theme=${r.key}`} target="_blank" rel="noreferrer">
                                                Preview
                                            </a>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="obi-ht-foot">
                    <span className="obi-ht-muted">
                        Preview opens the public site in that theme for the rest of the tab&apos;s session.
                        Visit <code>/?theme=auto</code> to go back to the schedule.
                    </span>
                    <button className="obi-ht-btn" onClick={save} disabled={!dirty || saving || hasInvalid}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default HolidayThemesAdmin;
