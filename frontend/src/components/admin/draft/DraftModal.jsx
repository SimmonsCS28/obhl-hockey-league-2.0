import { useEffect, useRef } from 'react';

/**
 * The one modal shell.
 *
 * The tool previously had seven bespoke overlays, none of which trapped focus, closed on
 * Escape, or restored focus afterwards. This is a single shell so those mechanics are
 * written once: Escape closes, focus is trapped inside while open, focus returns to
 * whatever opened it, and the page behind cannot scroll.
 *
 * Backdrop clicks dismiss only when the modal is not destructive - clicking slightly wide
 * of a "this cannot be undone" dialog should not be the same as answering it.
 */
export default function DraftModal({
    title,
    step,
    wide,
    destructive,
    onClose,
    children,
    footer,
    note
}) {
    const panelRef = useRef(null);
    const returnFocusRef = useRef(null);

    useEffect(() => {
        returnFocusRef.current = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const panel = panelRef.current;
        const focusables = () => Array.from(
            panel ? panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') : []
        ).filter(el => !el.disabled && el.offsetParent !== null);

        const first = focusables()[0];
        if (first) first.focus();

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = focusables();
            if (items.length === 0) return;
            const firstItem = items[0];
            const lastItem = items[items.length - 1];
            if (e.shiftKey && document.activeElement === firstItem) {
                e.preventDefault();
                lastItem.focus();
            } else if (!e.shiftKey && document.activeElement === lastItem) {
                e.preventDefault();
                firstItem.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.body.style.overflow = previousOverflow;
            const back = returnFocusRef.current;
            if (back && typeof back.focus === 'function') back.focus();
        };
    }, [onClose]);

    return (
        <div
            className="obi-draft-modal-backdrop"
            onClick={destructive ? undefined : onClose}
        >
            <div
                className={`obi-draft-modal ${wide ? 'is-wide' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                ref={panelRef}
            >
                <div className="obi-draft-modal-head">
                    <span className="obi-draft-modal-title">{title}</span>
                    {step && <span className="obi-draft-modal-step">{step}</span>}
                    <button type="button" className="obi-draft-modal-x" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="obi-draft-modal-body">{children}</div>
                {(footer || note) && (
                    <div className="obi-draft-modal-foot">
                        {note && <span className="obi-draft-modal-note">{note}</span>}
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
