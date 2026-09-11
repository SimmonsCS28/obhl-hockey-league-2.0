import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './SectionTip.css';

/**
 * The ⓘ that sits beside a section heading, and the "what you can do here" popover behind it.
 *
 * Copy is the only prop, and it lives next to the section it describes rather than in here — a
 * capability and the line that promises it then change in the same diff. The anatomy is fixed on
 * purpose: an accent eyebrow, up to five short lines, one optional footnote for the "why can't I
 * edit this" case. A section needing more than that needs a help page, not a bubble.
 *
 * Not a <button>. index.css has two bare `button` rules; the second forces height:36px,
 * inline-flex, 0.875rem, white text and `border-radius: 4px !important`, and a plain class cannot
 * beat that !important. A div with role="button" inherits none of it. The ✕ is the same for the
 * same reason.
 */

// Only one tip is open at a time, page-wide. The tips render in three separate component trees
// (Dashboard, GMTeam, ChickenLicksSection) with no common provider between them, so the registry
// is module-level rather than a context.
const closers = new Set();

// Below this the popover stops being an anchored bubble and spans the viewport instead: 320px
// pinned to an ⓘ that is itself near the left edge leaves no usable margin on a phone.
const PHONE_MAX = 480;
const GUTTER = 12;

const seenKey = (id) => `obhl.sectiontip.seen.${id}`;

/**
 * Whether this tip has ever been opened. Storage being unavailable reads as *seen*, not unseen:
 * a browser with storage blocked would otherwise pulse every ⓘ on every page load forever.
 */
const readSeen = (id) => {
    try {
        return localStorage.getItem(seenKey(id)) === '1';
    } catch {
        return true;
    }
};

const markSeen = (id) => {
    try {
        localStorage.setItem(seenKey(id), '1');
    } catch {
        /* private mode, storage disabled — the pulse is cosmetic, so losing it is fine */
    }
};

function SectionTip({ id, section, lines = [], footnote = '' }) {
    const [open, setOpen] = useState(false);
    const [seen, setSeen] = useState(() => readSeen(id));
    // Set only on phones: the horizontal shift and width that break the popover out of its
    // anchor and across the viewport.
    const [breakout, setBreakout] = useState(null);
    const wrapRef = useRef(null);
    const { pathname } = useLocation();

    const close = useCallback(() => setOpen(false), []);

    const toggle = useCallback(() => {
        if (open) { setOpen(false); return; }
        // Closing the others first is safe: this tip is shut, so it is not in the registry yet.
        closers.forEach((fn) => fn());
        if (!readSeen(id)) {
            markSeen(id);
            setSeen(true);
        }
        setOpen(true);
    }, [open, id]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    };

    // Join the single-open registry only while actually open.
    useEffect(() => {
        if (!open) return undefined;
        closers.add(close);
        return () => closers.delete(close);
    }, [open, close]);

    // A popover, not a modal: Esc and an outside click dismiss it, and nothing traps focus or
    // locks scrolling. Focus stays on the ⓘ, so the ✕ is simply the next thing Tab reaches.
    useEffect(() => {
        if (!open) return undefined;
        const onEsc = (e) => { if (e.key === 'Escape') close(); };
        const onOutside = (e) => { if (!wrapRef.current?.contains(e.target)) close(); };
        document.addEventListener('keydown', onEsc);
        document.addEventListener('mousedown', onOutside);
        document.addEventListener('touchstart', onOutside);
        return () => {
            document.removeEventListener('keydown', onEsc);
            document.removeEventListener('mousedown', onOutside);
            document.removeEventListener('touchstart', onOutside);
        };
    }, [open, close]);

    // Leaving the page closes it. Returned as cleanup rather than called in the effect body, so
    // it fires on the way *out* of a pathname instead of on the way in. /dashboard moves between
    // sections by hash, which is not a pathname change, so only a real navigation trips it.
    useEffect(() => {
        if (!open) return undefined;
        return close;
    }, [open, pathname, close]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        // The same media query the stylesheet uses, rather than window.innerWidth. The two can
        // disagree — under pinch zoom, and in scaled embedded frames, innerWidth reads wider than
        // the CSS viewport — and when they do the arrow hides while the bubble stays anchored at
        // 320px and overflows. One source of truth for both halves of the phone case.
        const phone = window.matchMedia(`(max-width: ${PHONE_MAX}px)`);
        const place = () => {
            if (!phone.matches) { setBreakout(null); return; }
            // clientWidth is the layout viewport the media query resolved against.
            const vw = document.documentElement.clientWidth;
            const rect = wrapRef.current?.getBoundingClientRect();
            // A hidden or detached frame reports 0, which would compute a negative width and
            // collapse the bubble. Anything that narrow is not a layout to solve for.
            if (!rect || vw < 2 * GUTTER + 120) { setBreakout(null); return; }
            setBreakout({ left: GUTTER - rect.left, width: vw - GUTTER * 2 });
        };
        place();
        window.addEventListener('resize', place);
        phone.addEventListener('change', place);
        return () => {
            window.removeEventListener('resize', place);
            phone.removeEventListener('change', place);
        };
    }, [open]);

    // The capability lists have gone stale twice already. Shout in dev when copy outgrows the
    // shape the popover was drawn for, rather than letting it quietly overflow in production.
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (lines.length > 5) {
            console.warn(`SectionTip "${id}": ${lines.length} lines, max is 5.`);
        }
        lines.forEach((line) => {
            const words = line.trim().split(/\s+/).length;
            if (words > 14) console.warn(`SectionTip "${id}": "${line}" is ${words} words, max is 14.`);
        });
    }, [id, lines]);

    const title = `What you can do in ${section}`;

    return (
        <span className="obi-sectiontip" ref={wrapRef}>
            <span
                role="button"
                tabIndex={0}
                aria-label={title}
                aria-expanded={open}
                aria-haspopup="dialog"
                className={`obi-sectiontip-btn${open ? ' obi-sectiontip-btn--open' : ''}${seen ? '' : ' obi-sectiontip-btn--unseen'}`}
                onClick={toggle}
                onKeyDown={onKeyDown}
            >
                i
            </span>

            {open && (
                <span
                    role="dialog"
                    aria-modal="false"
                    aria-label={title}
                    className="obi-sectiontip-pop"
                    style={breakout ? { left: breakout.left, width: breakout.width } : undefined}
                >
                    <span className="obi-sectiontip-arrow" aria-hidden="true" />
                    <span className="obi-sectiontip-head">
                        <span className="obi-sectiontip-eyebrow">What you can do here</span>
                        <span
                            role="button"
                            tabIndex={0}
                            aria-label="Close"
                            className="obi-sectiontip-close"
                            onClick={close}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); }
                            }}
                        >
                            &times;
                        </span>
                    </span>
                    <span className="obi-sectiontip-lines">
                        {lines.map((line) => (
                            <span className="obi-sectiontip-line" key={line}>
                                <span className="obi-sectiontip-chevron" aria-hidden="true">&#8250;</span>
                                <span>{line}</span>
                            </span>
                        ))}
                    </span>
                    {footnote && <span className="obi-sectiontip-foot">{footnote}</span>}
                </span>
            )}
        </span>
    );
}

export default SectionTip;
