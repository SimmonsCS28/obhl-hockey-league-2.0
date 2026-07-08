import { useState } from 'react';
import './SeasonSelector.css';

// Shared season trigger+menu control — replaces the old bare <select class="obi-season-select">.
// One component, placed per-page per the design_handoff_season handoff (Teams/Players/Standings
// use size="md" align="left"; the admin shell topbar uses size="sm" align="right" + a caption).
// Class prefix is "obi-season-picker" (not "season-selector") — that plain name collides with
// the legacy .season-selector in SeasonsPage.css / ShiftSignup.css (unscoped global CSS).
function SeasonSelector({ seasons, selectedSeasonId, onChange, size = 'md', align = 'left', caption, menuHint = 'Select Season' }) {
    const [open, setOpen] = useState(false);

    if (!seasons || seasons.length === 0) return null;

    const sorted = [...seasons].sort((a, b) => {
        if (!!a.isActive !== !!b.isActive) return a.isActive ? -1 : 1;
        return new Date(b.startDate || 0) - new Date(a.startDate || 0);
    });

    const current = seasons.find(s => s.id === selectedSeasonId) || sorted[0];

    const handlePick = (id) => {
        onChange(id);
        setOpen(false);
    };

    return (
        <div className={`obi-season-picker obi-season-picker--${size} obi-season-picker--align-${align}`}>
            <button
                type="button"
                className={`obi-season-picker-trigger${open ? ' is-open' : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="obi-season-picker-id">
                    <span className="obi-season-picker-microlabel">Season</span>
                    <span className="obi-season-picker-name">{current?.name || '—'}</span>
                </span>
                {current?.isActive ? (
                    <span className="obi-season-picker-tag obi-season-picker-tag--active">
                        <span className="obi-season-picker-tag-dot" />Active
                    </span>
                ) : (
                    <span className="obi-season-picker-tag obi-season-picker-tag--archived">Archived</span>
                )}
                <span className="obi-season-picker-chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <>
                    <div className="obi-season-picker-backdrop" onClick={() => setOpen(false)} />
                    <div className="obi-season-picker-menu" role="listbox">
                        <div className="obi-season-picker-menu-hint">{menuHint}</div>
                        {sorted.map(s => (
                            <button
                                type="button"
                                key={s.id}
                                role="option"
                                aria-selected={s.id === selectedSeasonId}
                                className={`obi-season-picker-row${s.id === selectedSeasonId ? ' is-selected' : ''}`}
                                onClick={() => handlePick(s.id)}
                            >
                                <span className="obi-season-picker-row-name">{s.name}</span>
                                {s.isActive && (
                                    <span className="obi-season-picker-tag obi-season-picker-tag--active obi-season-picker-tag--sm">Active</span>
                                )}
                                {s.id === selectedSeasonId && <span className="obi-season-picker-check" aria-hidden="true">✓</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {caption && <span className="obi-season-picker-caption">{caption}</span>}
        </div>
    );
}

export default SeasonSelector;
