import { useCallback, useEffect, useRef, useState } from 'react';
import leagueDraftApi from '../../../services/leagueDraftApi';
import { toDraftPayload } from './draftReducer';

export const SAVE_DEBOUNCE_MS = 1200;
export const SAVE_MAX_WAIT_MS = 5000;

/** idle -> dirty -> saving -> saved, or -> error. Error is sticky until a retry succeeds. */
export const SAVE_STATES = {
    IDLE: 'idle',
    DIRTY: 'dirty',
    SAVING: 'saving',
    SAVED: 'saved',
    ERROR: 'error'
};

/**
 * Debounced auto-save for the draft board.
 *
 * The hazard this is built around: there is no unique constraint on draft_saves, so if a
 * debounced flush fires while a create is still in flight, the second call POSTs again and
 * the operator silently ends up with two draft rows - and the next save updates only one of
 * them. savingRef is the interlock. A flush that arrives mid-save sets pendingRef instead of
 * issuing a request, and the in-flight save re-runs itself once on completion.
 *
 * Start Draft is expected to mint the row up front (see createNow); after that every write is
 * a PUT. The create path here is a backstop for a board that somehow goes live without one,
 * and is guarded by the same interlock.
 */
export function useAutoSave({ doc, enabled, draftId, onDraftId, onError }) {
    const [status, setStatus] = useState(SAVE_STATES.IDLE);
    const [lastSavedAt, setLastSavedAt] = useState(null);

    const savingRef = useRef(false);
    const pendingRef = useRef(false);
    const timerRef = useRef(null);
    const firstDirtyAtRef = useRef(null);

    // Latest values, read at flush time rather than captured in the debounce closure.
    const docRef = useRef(doc);
    const draftIdRef = useRef(draftId);
    const lastSavedJsonRef = useRef(null);
    const onDraftIdRef = useRef(onDraftId);
    const onErrorRef = useRef(onError);

    // Assigned during render, NOT in an effect. persist() is re-entered from a promise
    // resolution (the pending-save path), and an effect-updated ref can still hold the
    // previous document at that moment - which made persist() compare a stale payload
    // against lastSavedJson, decide nothing had changed, and report "All changes saved"
    // while the newest edit was silently dropped, with no timer left to catch it.
    docRef.current = doc;

    useEffect(() => { draftIdRef.current = draftId; }, [draftId]);
    useEffect(() => { onDraftIdRef.current = onDraftId; }, [onDraftId]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const persist = useCallback(async () => {
        if (savingRef.current) {
            // A save is already in flight. Record that the board moved again and let the
            // in-flight save pick it up; issuing a second request here is what duplicates rows.
            pendingRef.current = true;
            return;
        }

        const payload = toDraftPayload(docRef.current);
        const json = JSON.stringify(payload);
        if (json === lastSavedJsonRef.current) {
            setStatus(prev => (prev === SAVE_STATES.ERROR ? prev : SAVE_STATES.SAVED));
            return;
        }

        savingRef.current = true;
        clearTimer();
        firstDirtyAtRef.current = null;
        setStatus(SAVE_STATES.SAVING);

        try {
            const id = draftIdRef.current;
            const result = id
                ? await leagueDraftApi.update(id, payload)
                : await leagueDraftApi.create(payload);

            if (!id && result && result.id) {
                draftIdRef.current = result.id;
                if (onDraftIdRef.current) onDraftIdRef.current(result.id);
            }

            lastSavedJsonRef.current = json;
            setLastSavedAt(Date.now());
            setStatus(SAVE_STATES.SAVED);
        } catch (err) {
            setStatus(SAVE_STATES.ERROR);
            if (onErrorRef.current) onErrorRef.current(err);
        } finally {
            savingRef.current = false;
            const settledJson = JSON.stringify(toDraftPayload(docRef.current));
            if (pendingRef.current || settledJson !== lastSavedJsonRef.current) {
                pendingRef.current = false;
                // The board moved while we were saving. Re-check against the document as
                // it stands now rather than trusting the pending flag alone, so a change
                // landing mid-flight cannot end up with neither a flag nor a timer.
                persist();
            }
        }
    }, []);

    // Schedule a save whenever the document changes.
    useEffect(() => {
        if (!enabled) return undefined;

        const json = JSON.stringify(toDraftPayload(doc));
        if (json === lastSavedJsonRef.current) return undefined;

        setStatus(prev => (prev === SAVE_STATES.SAVING ? prev : SAVE_STATES.DIRTY));

        if (firstDirtyAtRef.current === null) firstDirtyAtRef.current = Date.now();
        const waited = Date.now() - firstDirtyAtRef.current;

        clearTimer();
        // A board being dragged continuously would otherwise never settle, so the debounce
        // is capped: after SAVE_MAX_WAIT_MS of unbroken activity the next change writes.
        const delay = waited >= SAVE_MAX_WAIT_MS
            ? 0
            : Math.min(SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS - waited);

        timerRef.current = setTimeout(() => { persist(); }, delay);
        return clearTimer;
    }, [doc, enabled, persist]);

    useEffect(() => clearTimer, []);

    /** Explicit "Save now", and the Retry on the error state. */
    const saveNow = useCallback(() => {
        clearTimer();
        return persist();
    }, [persist]);

    /**
     * Mints the draft_saves row up front, so every later write is an update. Called by Start
     * Draft. Returns the new id, or the existing one if there already is one.
     */
    const createNow = useCallback(async (documentOverride) => {
        if (draftIdRef.current) return draftIdRef.current;
        if (savingRef.current) return null;

        savingRef.current = true;
        setStatus(SAVE_STATES.SAVING);
        try {
            const payload = toDraftPayload(documentOverride || docRef.current);
            const result = await leagueDraftApi.create(payload);
            if (result && result.id) {
                draftIdRef.current = result.id;
                if (onDraftIdRef.current) onDraftIdRef.current(result.id);
                lastSavedJsonRef.current = JSON.stringify(payload);
                setLastSavedAt(Date.now());
                setStatus(SAVE_STATES.SAVED);
                return result.id;
            }
            setStatus(SAVE_STATES.ERROR);
            return null;
        } catch (err) {
            setStatus(SAVE_STATES.ERROR);
            if (onErrorRef.current) onErrorRef.current(err);
            return null;
        } finally {
            savingRef.current = false;
        }
    }, []);

    /** Marks the current board as the saved baseline without a request - used after a
     *  resume, so resuming does not immediately look dirty and trigger a redundant write. */
    const markClean = useCallback((documentOverride) => {
        lastSavedJsonRef.current = JSON.stringify(toDraftPayload(documentOverride || docRef.current));
        firstDirtyAtRef.current = null;
        setLastSavedAt(Date.now());
        setStatus(SAVE_STATES.SAVED);
    }, []);

    /** Forgets the baseline entirely - used when starting a brand new draft. */
    const reset = useCallback(() => {
        clearTimer();
        pendingRef.current = false;
        firstDirtyAtRef.current = null;
        lastSavedJsonRef.current = null;
        draftIdRef.current = null;
        setLastSavedAt(null);
        setStatus(SAVE_STATES.IDLE);
    }, []);

    const isDirty = status === SAVE_STATES.DIRTY
        || status === SAVE_STATES.SAVING
        || status === SAVE_STATES.ERROR;

    return { status, lastSavedAt, isDirty, saveNow, createNow, markClean, reset };
}

/** "All changes saved" / "Saved 2 min ago" - copy fixed in the design handoff. */
export function saveStatusLabel(status, lastSavedAt, now = Date.now()) {
    switch (status) {
        case SAVE_STATES.SAVING:
            return 'Saving…';
        case SAVE_STATES.ERROR:
            return 'Couldn’t save';
        case SAVE_STATES.DIRTY:
            return 'Unsaved changes';
        case SAVE_STATES.SAVED: {
            if (!lastSavedAt) return 'All changes saved';
            const mins = Math.floor((now - lastSavedAt) / 60000);
            if (mins < 1) return 'All changes saved';
            if (mins === 1) return 'Saved 1 min ago';
            return `Saved ${mins} min ago`;
        }
        default:
            return '';
    }
}
