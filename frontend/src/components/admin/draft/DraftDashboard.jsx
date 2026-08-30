import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import * as XLSX from 'xlsx';

import DraftService from '../../../services/DraftService';
import leagueDraftApi from '../../../services/leagueDraftApi';
import api from '../../../services/api';

import {
    ACTIONS, documentReducer, withUndo, initialUndoableState, fromDraftPayload,
    DEFAULT_TEAM_COLOR, DEFAULT_TEAM_SORT
} from './draftReducer';
import { useAutoSave, SAVE_STATES } from './useAutoSave';
import { useBoardSearch } from './useBoardSearch';
import { boardBalance } from './draftBalance';
import {
    CARD_SIZE, DENSITY, LAYOUT, GRID_ROSTERS, COLUMN_GAP,
    TEAM_COLORS, TEAM_COLOR_NAMES,
    boardGeometry, cardMetrics, columnWidth, columnWidthCss
} from './draftLayout';
import { getFilteredPlayers } from './draftSelectors';
import { transitiveBuddyEmails, isReciprocal } from './buddyGraph';

import DraftToolbar from './DraftToolbar';
import TeamColumn from './TeamColumn';
import PlayerCard from './PlayerCard';
import DraftModal from './DraftModal';
import './DraftBoard.css';

const undoableDraftReducer = withUndo(documentReducer);

const POOL_FILTERS = ['All', 'Forwards', 'Defense', 'Refs', 'GMs', 'Has Buddy'];
const POOL_SORTS = ['Name', 'Position', 'Skill', 'Veteran'];

const csvCell = (value) => {
    const s = value == null ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function DraftDashboard() {
    const [boardState, dispatch] = useReducer(undoableDraftReducer, undefined, () => initialUndoableState(4));
    const doc = boardState.present;
    const {
        seasonName, seasonId, teamCount, isLive,
        playerPool, teams, teamColors, teamSortOptions, buddyPickMap
    } = doc;
    const undoDepth = boardState.past.length;

    // ---- session state: how the board is being looked at. Never undone, never saved. ----
    const [density, setDensity] = useState(DENSITY.BALANCED);
    const [cardSize, setCardSize] = useState(CARD_SIZE.M);
    const [layout, setLayout] = useState(LAYOUT.ROWS);
    const [perRow, setPerRow] = useState(5);
    const [gridRosters, setGridRosters] = useState(GRID_ROSTERS.FULL);
    const [poolOpen, setPoolOpen] = useState(true);
    const [poolFilter, setPoolFilter] = useState('All');
    const [poolSort, setPoolSort] = useState('Name');
    const [sortAsc, setSortAsc] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [draggingEmail, setDraggingEmail] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [message, setMessage] = useState(null);

    // ---- seasons ----
    const [seasons, setSeasons] = useState([]);
    const [seasonsLoading, setSeasonsLoading] = useState(true);
    const [seasonModal, setSeasonModal] = useState(false);
    const [seasonForm, setSeasonForm] = useState({ name: '', startDate: '', endDate: '', status: 'upcoming', isActive: false });
    const [seasonSaving, setSeasonSaving] = useState(false);

    // ---- persistence ----
    const [draftId, setDraftId] = useState(null);
    const [savedDraft, setSavedDraft] = useState(null);
    const [resumePrompt, setResumePrompt] = useState(false);

    // ---- flows ----
    const [importStep, setImportStep] = useState(null);   // null | 1 | 2
    const [matchRows, setMatchRows] = useState([]);
    const [veteranRows, setVeteranRows] = useState([]);
    const [step1Summary, setStep1Summary] = useState(null);
    const [buddyModal, setBuddyModal] = useState(null);    // {anchor, targetTeamId, source, buddies, selected, queue}
    const [confirm, setConfirm] = useState(null);          // {kind, title, body, confirmLabel, onConfirm}
    const [duplicateRows, setDuplicateRows] = useState([]);

    const fileInputRef = useRef(null);

    const say = useCallback((kind, text) => setMessage({ kind, text }), []);

    // ---- autosave ----
    const autoSave = useAutoSave({
        doc,
        enabled: isLive && !!seasonId,
        draftId,
        onDraftId: setDraftId,
        onError: (err) => console.error('Autosave failed:', err)
    });

    // useBlocker is given a STABLE function reading a ref, not the boolean directly.
    // Passing the changing boolean makes react-router tear down and re-register the blocker
    // on every autosave transition, and that churn throws "Should have a queue" out of
    // React's hook dispatcher. The function form registers once and is asked each time.
    const dirtyRef = useRef(false);
    dirtyRef.current = autoSave.isDirty;
    const shouldBlock = useCallback(
        ({ currentLocation, nextLocation }) =>
            dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
        []
    );
    const blocker = useBlocker(shouldBlock);

    useEffect(() => {
        if (!autoSave.isDirty) return undefined;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [autoSave.isDirty]);

    // Success and info fade; errors stay until dismissed or replaced.
    useEffect(() => {
        if (!message || message.kind === 'error') return undefined;
        const t = setTimeout(() => setMessage(null), 9000);
        return () => clearTimeout(t);
    }, [message]);

    // ---- search ----
    const rawSearch = useBoardSearch({ playerPool, teams, density, cardSize, layout });
    const colourOf = useCallback(
        (teamId) => TEAM_COLORS[teamColors[teamId] || DEFAULT_TEAM_COLOR],
        [teamColors]
    );
    const onClearSearch = useCallback(() => {
        const { restored } = rawSearch.clear();
        say('info', restored ? 'Find cleared — board returned to where you were.' : 'Find cleared.');
    }, [rawSearch, say]);
    const search = useMemo(
        () => ({ ...rawSearch, colourOf, onClear: onClearSearch }),
        [rawSearch, colourOf, onClearSearch]
    );

    // ---- geometry ----
    const geometry = useMemo(
        () => boardGeometry({ density, cardSize, layout, gridRosters }),
        [density, cardSize, layout, gridRosters]
    );
    const metrics = useMemo(() => cardMetrics(density, cardSize), [density, cardSize]);
    const colW = useMemo(() => columnWidth(density, cardSize), [density, cardSize]);
    const colWCss = useMemo(
        () => columnWidthCss(density, cardSize, layout, perRow),
        [density, cardSize, layout, perRow]
    );

    const balance = useMemo(() => boardBalance(teams), [teams]);
    const balanceById = useMemo(() => {
        const map = {};
        balance.perTeam.forEach(entry => { map[entry.team.id] = entry.balance; });
        return map;
    }, [balance]);

    const filteredPool = useMemo(() => {
        const base = getFilteredPlayers(playerPool, {
            searchQuery: '', filter: poolFilter, sortOption: poolSort, sortAsc
        });
        if (!search.hasQuery) return base;
        const hits = new Set(search.poolHits.map(h => h.player.email));
        return base.filter(p => hits.has(p.email));
    }, [playerPool, poolFilter, poolSort, sortAsc, search.hasQuery, search.poolHits]);

    const selectedPlayer = useMemo(() => {
        if (!selectedEmail) return null;
        const inPool = playerPool.find(p => p.email === selectedEmail);
        if (inPool) return inPool;
        for (const t of teams) {
            const found = (t.players || []).find(p => p.email === selectedEmail);
            if (found) return found;
        }
        return null;
    }, [selectedEmail, playerPool, teams]);

    // ---- seasons ----
    const loadSeasons = useCallback(async (autoSelectId = null) => {
        setSeasonsLoading(true);
        try {
            // getSeasons() filters by TYPE, not status, and defaults to league seasons -
            // which is what we want here. Status is filtered client-side: a draft can only
            // target a season that has not already been played.
            const all = await api.getSeasons();
            const combined = (all || []).filter(s => s.status === 'active' || s.status === 'upcoming');
            setSeasons(combined);
            if (autoSelectId) {
                const created = combined.find(s => s.id === autoSelectId);
                if (created) dispatch({ type: ACTIONS.SET_SEASON, seasonId: created.id, seasonName: created.name });
            }
        } catch (err) {
            console.error('Error fetching seasons:', err);
            say('error', 'Could not load seasons.');
        } finally {
            setSeasonsLoading(false);
        }
    }, [say]);

    const checkSavedDraft = useCallback(async () => {
        try {
            const latest = await leagueDraftApi.getLatest();
            if (latest && latest.status === 'saved') {
                setSavedDraft(latest);
                setResumePrompt(true);
            }
        } catch (err) {
            console.error('Error checking for saved draft:', err);
        }
    }, []);

    useEffect(() => {
        loadSeasons();
        checkSavedDraft();
    }, [loadSeasons, checkSavedDraft]);

    // ---- keyboard: Escape unwinds one layer at a time ----
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (menuOpen) { setMenuOpen(false); return; }
            if (search.hasQuery) { onClearSearch(); return; }
            if (selectedEmail) setSelectedEmail(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuOpen, search.hasQuery, selectedEmail, onClearSearch]);

    // ---- import ----
    const onFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const players = await DraftService.importRegistration(file);
            dispatch({ type: ACTIONS.SET_POOL, players });
            setMessage(null);

            const matches = players.filter(p => p.potentialMatchFound);
            if (matches.length > 0) {
                setMatchRows(matches.map(m => ({ ...m, adoptRating: true })));
                setImportStep(1);
            } else {
                const unrated = players.filter(p => p.isVeteran && !p.ratingFoundInDb && !p.adoptedMatchSkill);
                if (unrated.length > 0) {
                    setVeteranRows(unrated.map(v => ({ ...v, skillRating: v.skillRating || 1 })));
                    setStep1Summary(null);
                    setImportStep(2);
                } else {
                    say('success', `Imported ${players.length} players.`);
                }
            }
        } catch (err) {
            say('error', `Upload failed: ${err.message}`);
        } finally {
            e.target.value = null;
        }
    };

    const applyStep1 = () => {
        const pool = playerPool.map(p => {
            const row = matchRows.find(m => m.email === p.email);
            if (!row) return p;
            return row.adoptRating
                ? { ...p, skillRating: row.potentialMatchSkill, dbId: row.potentialMatchId, adoptedMatchSkill: true, duplicateResolved: true }
                : { ...p, dbId: null, adoptedMatchSkill: false };
        });
        dispatch({ type: ACTIONS.SET_POOL, players: pool });

        const adopted = matchRows.filter(m => m.adoptRating).length;
        setStep1Summary(`${adopted} of ${matchRows.length} kept their existing rating.`);

        const unrated = pool.filter(p => p.isVeteran && !p.ratingFoundInDb && !p.adoptedMatchSkill);
        if (unrated.length > 0) {
            setVeteranRows(unrated.map(v => ({ ...v, skillRating: v.skillRating || 1 })));
            setImportStep(2);
        } else {
            setImportStep(null);
            say('success', `Imported ${pool.length} players.`);
        }
    };

    const applyStep2 = () => {
        const pool = playerPool.map(p => {
            const row = veteranRows.find(v => v.email === p.email);
            return row ? { ...p, skillRating: row.skillRating } : p;
        });
        dispatch({ type: ACTIONS.SET_POOL, players: pool });
        setImportStep(null);
        setVeteranRows([]);
        say('success', `Imported ${pool.length} players.`);
    };

    /**
     * Cancel never discards silently and never keeps half-resolved data invisibly.
     * At step 1 nothing has been decided yet, so the operator chooses. At step 2 the step-1
     * decisions are already real, so they are kept and the rest lands on the board flagged;
     * finalize refuses while anything is still flagged.
     */
    const cancelImport = () => {
        if (importStep === 1) {
            setConfirm({
                kind: 'import-cancel',
                title: 'Cancel the import?',
                body: `You have ${playerPool.length} players loaded and ${matchRows.length} still to review.`,
                confirmLabel: 'Discard the import',
                cancelLabel: `Keep the ${playerPool.length} players`,
                destructive: true,
                onConfirm: () => {
                    dispatch({ type: ACTIONS.SET_POOL, players: [] });
                    setImportStep(null); setMatchRows([]); setConfirm(null);
                    say('info', 'Import discarded.');
                },
                onCancel: () => {
                    setImportStep(null); setMatchRows([]); setConfirm(null);
                    say('info', `Kept ${playerPool.length} players. Unresolved matches are flagged on their cards.`);
                }
            });
            return;
        }
        setImportStep(null);
        setVeteranRows([]);
        say('info', 'Kept everything decided so far. Players still needing a rating are flagged on their cards.');
    };

    const unresolvedCount = useMemo(() => {
        const all = [...playerPool, ...teams.flatMap(t => t.players || [])];
        return all.filter(p => (p.potentialMatchFound && !p.duplicateResolved) || (p.isVeteran && !p.ratingFoundInDb && !p.adoptedMatchSkill && !p.skillRating)).length;
    }, [playerPool, teams]);

    // ---- draft actions ----
    const readyToStart = seasonName.trim() !== '' && !!seasonId && playerPool.length > 0;
    const startHint = !seasonId
        ? 'Pick a season first — autosave needs somewhere to write.'
        : playerPool.length === 0
            ? 'Upload the registration file to fill the pool.'
            : `Ready — ${playerPool.length} players, ${teamCount} teams.`;

    const startDraft = async () => {
        if (!readyToStart) return;
        dispatch({ type: ACTIONS.START_DRAFT });
        setMessage(null);
        const liveDoc = documentReducer(doc, { type: ACTIONS.START_DRAFT });
        await autoSave.createNow(liveDoc);
        say('success', 'Draft started. Autosave is on.');
    };

    const assignGMs = () => {
        const everyone = [...playerPool, ...teams.flatMap(t => t.players || [])];
        const gms = everyone.filter(p => p.isGm);
        if (gms.length < teams.length) {
            say('error', `Not enough GMs — found ${gms.length}, need ${teams.length}.`);
            return;
        }
        const without = teams.filter(t => !(t.players || []).some(p => p.isGm));
        if (without.length === 0) { say('info', 'Every team already has a GM.'); return; }
        const available = gms.filter(gm => playerPool.some(p => p.email === gm.email));
        if (available.length < without.length) {
            say('error', `Only ${available.length} GMs left in the pool but ${without.length} teams still need one.`);
            return;
        }
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        dispatch({ type: ACTIONS.ASSIGN_GMS, gms: shuffled });
        say('info', `Assigned ${without.length} GMs. The columns moved on purpose — the board re-sorts by average skill.`);
    };

    const assignGMBuddies = () => {
        const queue = [];
        teams.forEach(team => {
            const gm = (team.players || []).find(p => p.isGm);
            if (!gm) return;
            const emails = transitiveBuddyEmails(buddyPickMap, gm.email);
            const buddies = emails.map(e => playerPool.find(p => p.email === e)).filter(Boolean);
            if (buddies.length > 0) queue.push({ anchor: gm, targetTeamId: team.id, buddies });
        });
        if (queue.length === 0) { say('info', 'No GM buddy requests left in the pool.'); return; }
        const [first, ...rest] = queue;
        setBuddyModal({ ...first, source: `team-${first.targetTeamId}`, selected: first.buddies.map(b => b.email), queue: rest });
    };

    const advanceBuddyQueue = (queue) => {
        if (!queue || queue.length === 0) { setBuddyModal(null); say('success', 'Buddy pass complete.'); return; }
        const [next, ...rest] = queue;
        setBuddyModal({ ...next, source: `team-${next.targetTeamId}`, selected: next.buddies.map(b => b.email), queue: rest });
    };

    const confirmBuddies = () => {
        const { anchor, targetTeamId, buddies, selected, queue } = buddyModal;
        const chosen = buddies.filter(b => selected.includes(b.email));
        const onTeam = (teams.find(t => t.id === targetTeamId)?.players || []).some(p => p.email === anchor.email);
        if (onTeam) {
            if (chosen.length > 0) dispatch({ type: ACTIONS.MOVE_PLAYERS, players: chosen, targetTeamId });
        } else {
            dispatch({ type: ACTIONS.MOVE_PLAYERS, players: [anchor, ...chosen], targetTeamId });
        }
        if (queue) advanceBuddyQueue(queue); else setBuddyModal(null);
        setSelectedEmail(null);
    };

    // ---- moving players ----
    const movePlayer = useCallback((player, source, targetTeamId) => {
        if (targetTeamId === 'pool') {
            if (source === 'pool') return;
            dispatch({ type: ACTIONS.RETURN_TO_POOL, player, sourceTeamId: parseInt(String(source).split('-')[1], 10) });
            setSelectedEmail(null);
            return;
        }

        // Direct and reverse buddy picks still in the pool or on the source team.
        const direct = buddyPickMap[player.email] || [];
        const reverse = Object.entries(buddyPickMap)
            .filter(([email, picks]) => picks.includes(player.email) && !direct.includes(email))
            .map(([email]) => email);
        const candidates = [...direct, ...reverse];

        if (candidates.length > 0) {
            const pool = playerPool.filter(p => candidates.includes(p.email));
            const fromSource = source !== 'pool'
                ? ((teams.find(t => `team-${t.id}` === source)?.players) || []).filter(p => candidates.includes(p.email))
                : [];
            const available = [...pool, ...fromSource].filter(b => b.email !== player.email);
            if (available.length > 0) {
                setBuddyModal({
                    anchor: player, targetTeamId, source, buddies: available,
                    selected: available.map(b => b.email), queue: null
                });
                return;
            }
        }

        dispatch({ type: ACTIONS.MOVE_PLAYERS, players: [player], targetTeamId });
        setSelectedEmail(null);
    }, [buddyPickMap, playerPool, teams]);

    const onDragStart = (e, player, source) => {
        e.dataTransfer.setData('player-email', player.email);
        e.dataTransfer.setData('source', source);
        setDraggingEmail(player.email);
    };

    const resolveDragged = (e) => {
        const email = e.dataTransfer.getData('player-email');
        const source = e.dataTransfer.getData('source');
        const live = source === 'pool'
            ? playerPool.find(p => p.email === email)
            : ((teams.find(t => `team-${t.id}` === source)?.players) || []).find(p => p.email === email);
        return { player: live, source };
    };

    const onDropTeam = (e, teamId) => {
        e.preventDefault();
        setDropTarget(null);
        setDraggingEmail(null);
        const { player, source } = resolveDragged(e);
        if (player) movePlayer(player, source, teamId);
    };

    const onDropPool = (e) => {
        e.preventDefault();
        setDropTarget(null);
        setDraggingEmail(null);
        const { player, source } = resolveDragged(e);
        if (player) movePlayer(player, source, 'pool');
    };

    const selectPlayer = (email) => setSelectedEmail(prev => (prev === email ? null : email));

    const assignSelected = (teamId) => {
        if (!selectedPlayer) return;
        const source = playerPool.some(p => p.email === selectedPlayer.email)
            ? 'pool'
            : `team-${teams.find(t => (t.players || []).some(p => p.email === selectedPlayer.email))?.id}`;
        movePlayer(selectedPlayer, source, teamId);
    };

    const updateField = (email, field, value) =>
        dispatch({ type: ACTIONS.UPDATE_PLAYER, email, field, value });

    // ---- export / template ----
    const exportCsv = () => {
        const header = ['Team Name', 'Team Abbr', 'Is GM', 'First Name', 'Last Name', 'Position', 'Skill Rating', 'Status', 'Email', 'Buddy'];
        const abbr = (n) => (n || '').slice(0, 3).toUpperCase();
        const rows = [header.join(',')];
        teams.forEach(team => {
            (team.players || []).forEach(p => {
                rows.push([
                    team.name, abbr(team.name), p.isGm ? 'Yes' : 'No',
                    p.firstName, p.lastName, p.position, p.skillRating,
                    p.status || (p.isVeteran ? 'Veteran' : 'Rookie'), p.email, p.buddyPick || ''
                ].map(csvCell).join(','));
            });
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OBHL_Draft_${seasonName || 'season'}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        say('success', 'Draft exported.');
    };

    const downloadTemplate = () => {
        const sample = [
            { 'First Name': 'John', 'Last Name': 'Smith', Email: 'john.smith@example.com', 'preferred position': 'Forward', 'Skill Rating': '7', 'Veteran Status': 'veteran', 'Buddy Pick': '', Ref: 'n', GM: 'n' },
            { 'First Name': 'Jane', 'Last Name': 'Doe', Email: 'jane.doe@example.com', 'preferred position': 'Defense', 'Skill Rating': '5', 'Veteran Status': 'rookie', 'Buddy Pick': 'John Smith', Ref: 'n', GM: 'y' }
        ];
        const ws = XLSX.utils.json_to_sheet(sample);
        ws['!cols'] = [15, 15, 25, 20, 12, 15, 18, 5, 5].map(wch => ({ wch }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Player Template');
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const url = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'OBHL_Registration_Template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        say('success', 'Template downloaded.');
        setMenuOpen(false);
    };

    // ---- finalize ----
    const startFinalize = () => {
        setMenuOpen(false);
        if (!draftId) { say('error', 'Save the draft before finalizing.'); return; }
        const missing = teams.filter(t => !(t.players || []).some(p => p.isGm));
        if (missing.length > 0) {
            say('error', `These teams have no GM: ${missing.map(t => t.name).join(', ')}.`);
            return;
        }
        const dupes = [...playerPool, ...teams.flatMap(t => t.players || [])]
            .filter(p => p.potentialMatchFound && !p.duplicateResolved);
        if (dupes.length > 0) {
            setDuplicateRows(dupes.map(d => ({ ...d, resolveAction: 'update' })));
            return;
        }
        askFinalize();
    };

    const askFinalize = () => {
        const left = playerPool.length;
        setConfirm({
            kind: 'finalize',
            title: 'Finalize this draft?',
            body: left > 0
                ? `This creates the season's teams and players. ${left} player${left === 1 ? '' : 's'} still in the pool will not be placed on a team.`
                : "This creates the season's teams and players. It cannot be undone.",
            confirmLabel: 'Finalize draft',
            destructive: true,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    const result = await leagueDraftApi.finalize(draftId);
                    dispatch({ type: ACTIONS.FINALIZED });
                    say('success', `Draft finalized. Season ID: ${result.seasonId}`);
                } catch (err) {
                    say('error', `Could not finalize: ${err.message}`);
                }
            }
        });
    };

    const applyDuplicates = () => {
        const apply = (list) => list.map(p => {
            const row = duplicateRows.find(d => d.email === p.email);
            if (!row) return p;
            return { ...p, duplicateResolved: true, dbId: row.resolveAction === 'update' ? row.potentialMatchId : null };
        });
        dispatch({
            type: ACTIONS.HYDRATE,
            doc: { ...doc, playerPool: apply(playerPool), teams: teams.map(t => ({ ...t, players: apply(t.players || []) })) }
        });
        setDuplicateRows([]);
        askFinalize();
    };

    // ---- season creation ----
    const createSeason = async () => {
        if (!seasonForm.name.trim()) { say('error', 'The season needs a name.'); return; }
        setSeasonSaving(true);
        try {
            const created = await api.createSeason(seasonForm);
            setSeasonModal(false);
            setSeasonForm({ name: '', startDate: '', endDate: '', status: 'upcoming', isActive: false });
            await loadSeasons(created.id);
            say('success', `Created ${created.name}.`);
        } catch (err) {
            say('error', `Could not create the season: ${err.message}`);
        } finally {
            setSeasonSaving(false);
        }
    };

    // ---- resume / reset / new ----
    const resumeDraft = () => {
        if (!savedDraft) return;
        try {
            const restored = fromDraftPayload(JSON.parse(savedDraft.draftData));
            dispatch({ type: ACTIONS.HYDRATE, doc: restored });
            setDraftId(savedDraft.id);
            autoSave.markClean(restored);
            setResumePrompt(false);
            say('success', 'Draft resumed.');
        } catch (err) {
            console.error(err);
            say('error', 'That saved draft could not be read.');
        }
    };

    const askReset = () => {
        setMenuOpen(false);
        setConfirm({
            kind: 'reset',
            title: 'Reset the board?',
            body: `Every player goes back to the pool and all ${teams.length} teams are emptied. The draft stays open.`,
            confirmLabel: 'Reset the board',
            destructive: true,
            onConfirm: () => {
                dispatch({ type: ACTIONS.RESET_BOARD });
                setConfirm(null);
                say('info', 'Board reset — everyone is back in the pool. Undo still works.');
            }
        });
    };

    const askNewDraft = () => {
        setMenuOpen(false);
        setConfirm({
            kind: 'new',
            title: 'Start a new draft?',
            body: 'This clears the season, the pool and every roster. The saved draft on the server is left alone.',
            confirmLabel: 'Start a new draft',
            destructive: true,
            onConfirm: () => {
                dispatch({ type: ACTIONS.NEW_DRAFT });
                autoSave.reset();
                setDraftId(null);
                setSavedDraft(null);
                setConfirm(null);
                say('info', 'New draft started.');
            }
        });
    };

    // ---- off-screen match tabs (Rows only; Grid uses the header chip) ----
    const offscreen = useMemo(() => {
        if (layout !== LAYOUT.ROWS || !search.hasQuery) return { left: 0, right: 0 };
        const board = search.boardRef.current;
        if (!board) return { left: 0, right: 0 };
        const step = colW + COLUMN_GAP;
        let left = 0; let right = 0;
        search.teamHits.forEach(hit => {
            const x = hit.teamIndex * step;
            if (x + step < board.scrollLeft) left += 1;
            else if (x > board.scrollLeft + board.clientWidth) right += 1;
        });
        return { left, right };
    }, [layout, search.hasQuery, search.teamHits, search.boardRef, colW]);

    const jumpToEdge = (direction) => {
        const board = search.boardRef.current;
        if (!board) return;
        const step = colW + COLUMN_GAP;
        const candidates = search.teamHits
            .map((hit, i) => ({ i, x: hit.teamIndex * step }))
            .filter(c => (direction === 'left' ? c.x + step < board.scrollLeft : c.x > board.scrollLeft + board.clientWidth));
        if (candidates.length === 0) return;
        const pick = direction === 'left' ? candidates[candidates.length - 1] : candidates[0];
        const globalIndex = search.matches.findIndex(m => m.player.email === search.teamHits[pick.i].player.email);
        if (globalIndex >= 0) search.jumpTo(globalIndex);
    };

    const showAssignGMs = isLive && teams.some(t => !(t.players || []).some(p => p.isGm));
    const showAssignBuddies = isLive && teams.some(team => {
        const gm = (team.players || []).find(p => p.isGm);
        return gm && transitiveBuddyEmails(buddyPickMap, gm.email).some(e => playerPool.some(p => p.email === e));
    });

    return (
        <div className="obi-draft-root">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                hidden
                onChange={onFile}
            />

            <DraftToolbar
                phase={isLive ? 'live' : 'setup'}
                seasons={seasons}
                seasonId={seasonId}
                seasonsLoading={seasonsLoading}
                onSeasonChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const s = seasons.find(x => x.id === id);
                    dispatch({ type: ACTIONS.SET_SEASON, seasonId: id, seasonName: s ? s.name : '' });
                }}
                onCreateSeason={() => setSeasonModal(true)}
                teamCount={Number(teamCount)}
                onTeamCount={(n) => dispatch({ type: ACTIONS.SET_TEAM_COUNT, teamCount: Math.min(14, Math.max(1, n)) })}
                onUpload={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
                onTemplate={downloadTemplate}
                onStart={startDraft}
                startDisabled={!readyToStart}
                startHint={startHint}
                ready={readyToStart}
                onAssignGMs={assignGMs}
                onAssignBuddies={assignGMBuddies}
                showAssignGMs={showAssignGMs}
                showAssignBuddies={showAssignBuddies}
                onUndo={() => { dispatch({ type: 'UNDO' }); say('info', 'Action undone.'); }}
                undoDepth={undoDepth}
                onExport={exportCsv}
                onFinalize={startFinalize}
                saveStatus={autoSave.status}
                lastSavedAt={autoSave.lastSavedAt}
                onSaveNow={() => autoSave.saveNow()}
                onRetry={() => autoSave.saveNow()}
                density={density} onDensity={setDensity}
                cardSize={cardSize} onCardSize={setCardSize}
                layout={layout} onLayout={setLayout}
                perRow={perRow} onPerRow={(n) => setPerRow(Math.min(7, Math.max(3, n)))}
                gridRosters={gridRosters} onGridRosters={setGridRosters}
                search={search}
                menuOpen={menuOpen}
                onToggleMenu={setMenuOpen}
                onNewDraft={askNewDraft}
                onReset={askReset}
            />

            {message && (
                <div
                    className={`obi-draft-msg is-${message.kind}`}
                    role={message.kind === 'error' ? 'alert' : 'status'}
                    aria-live={message.kind === 'error' ? 'assertive' : 'polite'}
                >
                    <span className="obi-draft-msg-kind">{message.kind}</span>
                    <span className="obi-draft-msg-text">{message.text}</span>
                    <button type="button" className="obi-draft-msg-x" onClick={() => setMessage(null)} aria-label="Dismiss">✕</button>
                </div>
            )}

            {isLive && (
                <div className="obi-draft-strip">
                    <span className="obi-draft-eyebrow">Board balance</span>
                    {balance.chips.map(chip => (
                        <button
                            key={chip.axis}
                            type="button"
                            className={`obi-draft-chip ${chip.band === 'ok' ? '' : `is-${chip.band}`}`}
                            title={chip.title}
                            disabled={!chip.teamId}
                            onClick={() => {
                                if (!chip.teamId) return;
                                const el = search.columnRefs.current[chip.teamId];
                                const board = search.boardRef.current;
                                if (!el || !board) return;
                                const cr = el.getBoundingClientRect();
                                const br = board.getBoundingClientRect();
                                if (layout === LAYOUT.GRID) board.scrollTop += (cr.top - br.top) - 24;
                                else board.scrollLeft += (cr.left - br.left) - 24;
                            }}
                        >
                            <span className="obi-draft-chip-axis">{chip.axis}</span>
                            <span className="obi-draft-chip-text">{chip.text}</span>
                        </button>
                    ))}
                </div>
            )}

            {selectedPlayer && (
                <div className="obi-draft-selbar" role="status" aria-live="polite">
                    <span className="obi-draft-selbar-tag">Assigning</span>
                    <span className="obi-draft-selbar-name">{selectedPlayer.firstName} {selectedPlayer.lastName}</span>
                    <span className="obi-draft-selbar-meta">
                        {selectedPlayer.position === 'Defense' ? 'D' : 'F'}:{selectedPlayer.skillRating}
                    </span>
                    <span className="obi-draft-selbar-keys">Pick a team column below · Enter assigns · Esc cancels</span>
                    <div style={{ flex: 1 }} />
                    <button type="button" className="obi-draft-btn is-accent" onClick={() => setSelectedEmail(null)}>Cancel</button>
                </div>
            )}

            <div className="obi-draft-body">
                {poolOpen ? (
                    <div
                        className={`obi-draft-pool ${dropTarget === 'pool' ? 'is-drop-target' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDropTarget('pool'); }}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={onDropPool}
                    >
                        <div className="obi-draft-pool-head">
                            <div className="obi-draft-pool-title">
                                <span className="obi-draft-pool-name">PLAYER POOL</span>
                                <span className="obi-draft-pool-count">{playerPool.length}</span>
                                <div style={{ flex: 1 }} />
                                <button type="button" className="obi-draft-pool-collapse" onClick={() => setPoolOpen(false)} title="Collapse pool">«</button>
                            </div>
                            <div className="obi-draft-pool-controls">
                                <select className="obi-draft-select" value={poolFilter} onChange={(e) => setPoolFilter(e.target.value)} aria-label="Filter the pool">
                                    {POOL_FILTERS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <select className="obi-draft-select" value={poolSort} onChange={(e) => setPoolSort(e.target.value)} aria-label="Sort the pool">
                                    {POOL_SORTS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <button type="button" className="obi-draft-pool-dir" onClick={() => setSortAsc(v => !v)} title="Sort direction">
                                    {sortAsc ? '↑' : '↓'}
                                </button>
                            </div>
                            {search.hasQuery && (
                                <div className="obi-draft-pool-filtered">
                                    <span className="obi-draft-pool-filtered-tag">Filtered by find</span>
                                    <span className="obi-draft-pool-filtered-q">“{search.query}”</span>
                                    <button type="button" className="obi-draft-find-clear" onClick={search.onClear}>✕</button>
                                </div>
                            )}
                        </div>
                        <div className="obi-draft-pool-list">
                            {filteredPool.length === 0 && (
                                <div className="obi-draft-empty">
                                    <div className="obi-draft-empty-title">
                                        {playerPool.length === 0 ? 'No players yet' : 'Nothing matches'}
                                    </div>
                                    <div className="obi-draft-empty-body">
                                        {playerPool.length === 0
                                            ? 'Upload the registration spreadsheet to fill the pool.'
                                            : 'Try a different filter, or clear the find box.'}
                                    </div>
                                </div>
                            )}
                            {filteredPool.map(player => (
                                <PlayerCard
                                    key={player.email}
                                    player={player}
                                    source="pool"
                                    density={density}
                                    colW={264}
                                    metrics={metrics}
                                    isLive={isLive}
                                    isSelected={selectedEmail === player.email}
                                    matchMark={search.matchMarks[player.email] || 0}
                                    isDragging={draggingEmail === player.email}
                                    onSelect={selectPlayer}
                                    onDragStart={onDragStart}
                                    onFieldChange={updateField}
                                    registerRef={search.registerCard}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <button type="button" className="obi-draft-pool-tab" onClick={() => setPoolOpen(true)}>
                        <span>»</span>
                        <span className="obi-draft-pool-tab-label">Pool {playerPool.length}</span>
                    </button>
                )}

                <div className="obi-draft-boardwrap">
                    <div
                        className="obi-draft-board"
                        aria-label={`Team board, ${teams.length} teams`}
                        style={{
                            overflowX: geometry.overflowX,
                            overflowY: geometry.overflowY,
                            flexWrap: geometry.flexWrap,
                            alignItems: geometry.alignItems
                        }}
                        ref={search.registerBoard}
                    >
                        {teams.map(team => (
                            <TeamColumn
                                key={team.id}
                                team={team}
                                balance={balanceById[team.id] || { size: 0, stats: [], flagged: false }}
                                colour={TEAM_COLORS[teamColors[team.id] || DEFAULT_TEAM_COLOR]}
                                colourName={teamColors[team.id] || DEFAULT_TEAM_COLOR}
                                colourOptions={TEAM_COLOR_NAMES}
                                sortOption={teamSortOptions[team.id] || DEFAULT_TEAM_SORT}
                                width={colWCss}
                                height={geometry.columnHeight}
                                maxHeight={geometry.columnMaxHeight}
                                rosterMinHeight={geometry.rosterMinHeight}
                                rosterMaxHeight={geometry.rosterMaxHeight}
                                density={density}
                                colW={colW}
                                metrics={metrics}
                                isLive={isLive}
                                isDropTarget={dropTarget === team.id}
                                matchCount={search.teamMatchCounts[team.id] || 0}
                                matchMarks={search.matchMarks}
                                selectedEmail={selectedEmail}
                                draggingEmail={draggingEmail}
                                hasSelection={!!selectedPlayer}
                                showMeta={density !== DENSITY.OVERVIEW}
                                onDragOver={(e) => { e.preventDefault(); setDropTarget(team.id); }}
                                onDragLeave={() => setDropTarget(prev => (prev === team.id ? null : prev))}
                                onDrop={(e) => onDropTeam(e, team.id)}
                                onAssign={assignSelected}
                                onRename={(id, name) => dispatch({ type: ACTIONS.SET_TEAM_NAME, teamId: id, name })}
                                onColour={(id, colour) => dispatch({ type: ACTIONS.SET_TEAM_COLOR, teamId: id, color: colour })}
                                onSort={(id, sortOption) => dispatch({ type: ACTIONS.SET_TEAM_SORT, teamId: id, sortOption })}
                                onSelect={selectPlayer}
                                onDragStart={onDragStart}
                                onFieldChange={updateField}
                                registerColumn={search.registerColumn}
                                registerRoster={search.registerRoster}
                                registerCard={search.registerCard}
                            />
                        ))}
                    </div>

                    {offscreen.left > 0 && (
                        <button type="button" className="obi-draft-edge is-left" onClick={() => jumpToEdge('left')}>
                            ◀ {offscreen.left} match{offscreen.left === 1 ? '' : 'es'}
                        </button>
                    )}
                    {offscreen.right > 0 && (
                        <button type="button" className="obi-draft-edge is-right" onClick={() => jumpToEdge('right')}>
                            {offscreen.right} match{offscreen.right === 1 ? '' : 'es'} ▶
                        </button>
                    )}
                </div>
            </div>

            {/* ------------------------------- modals ------------------------------- */}

            {blocker.state === 'blocked' && (
                <DraftModal
                    title="Leave with unsaved changes?"
                    destructive
                    onClose={() => blocker.reset()}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={() => blocker.reset()}>Stay</button>
                        <button type="button" className="obi-draft-btn is-accent" onClick={async () => { await autoSave.saveNow(); blocker.proceed(); }}>Save and leave</button>
                    </>}
                >
                    Autosave has not finished writing the latest change.
                </DraftModal>
            )}

            {resumePrompt && savedDraft && (
                <DraftModal
                    title="Resume the saved draft?"
                    onClose={() => setResumePrompt(false)}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={() => setResumePrompt(false)}>Start fresh</button>
                        <button type="button" className="obi-draft-btn is-primary" onClick={resumeDraft}>Resume draft</button>
                    </>}
                >
                    <div><strong>{savedDraft.seasonName}</strong></div>
                    <div style={{ marginTop: 6, color: 'var(--obi-text-muted)' }}>
                        Last saved {savedDraft.updatedAt ? new Date(savedDraft.updatedAt).toLocaleString() : 'recently'}.
                    </div>
                </DraftModal>
            )}

            {importStep === 1 && (
                <DraftModal
                    title="These names already exist"
                    step="Step 1 of 2"
                    wide
                    onClose={cancelImport}
                    note={`${matchRows.filter(m => m.adoptRating).length} of ${matchRows.length} will keep their rating`}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={cancelImport}>Cancel</button>
                        <button type="button" className="obi-draft-btn is-primary" onClick={applyStep1}>Continue</button>
                    </>}
                >
                    <p style={{ marginTop: 0 }}>
                        Each of these matches an existing player by name but registered with a different email.
                        Keeping the old rating links them to that history.
                    </p>
                    {matchRows.map(row => (
                        <div key={row.email} className="obi-draft-row">
                            <span className="obi-draft-row-name">{row.firstName} {row.lastName}</span>
                            <span className="obi-draft-row-meta">{row.potentialMatchEmail} · was {row.potentialMatchSkill}</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                                <input
                                    type="checkbox"
                                    checked={row.adoptRating}
                                    onChange={(e) => setMatchRows(rows => rows.map(r => r.email === row.email ? { ...r, adoptRating: e.target.checked } : r))}
                                />
                                <span style={{ fontSize: 12 }}>Keep rating {row.potentialMatchSkill}</span>
                            </label>
                        </div>
                    ))}
                </DraftModal>
            )}

            {importStep === 2 && (
                <DraftModal
                    title="Veterans with no rating"
                    step="Step 2 of 2"
                    wide
                    onClose={cancelImport}
                    note={`${veteranRows.length} to rate`}
                    footer={<>
                        {step1Summary && <button type="button" className="obi-draft-btn" onClick={() => setImportStep(1)}>Back</button>}
                        <button type="button" className="obi-draft-btn" onClick={cancelImport}>Cancel</button>
                        <button type="button" className="obi-draft-btn is-primary" onClick={applyStep2}>Finish import</button>
                    </>}
                >
                    {step1Summary && (
                        <div className="obi-draft-summary">
                            <span>✓ {step1Summary}</span>
                            <button type="button" className="obi-draft-linkbtn" onClick={() => setImportStep(1)}>Change</button>
                        </div>
                    )}
                    <p style={{ marginTop: 0 }}>
                        These players registered as veterans but we have no rating on file for them.
                        Anyone left unrated stays flagged on the board, and finalize will refuse until they are sorted.
                    </p>
                    {veteranRows.map(row => (
                        <div key={row.email} className="obi-draft-row">
                            <span className="obi-draft-row-name">{row.firstName} {row.lastName}</span>
                            <input
                                className="obi-draft-input"
                                style={{ width: 70, height: 28 }}
                                type="number"
                                min="1"
                                max="10"
                                value={row.skillRating}
                                onChange={(e) => setVeteranRows(rows => rows.map(r => r.email === row.email ? { ...r, skillRating: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)) } : r))}
                                aria-label={`Rating for ${row.firstName} ${row.lastName}`}
                            />
                        </div>
                    ))}
                </DraftModal>
            )}

            {duplicateRows.length > 0 && (
                <DraftModal
                    title="Resolve these before finalizing"
                    wide
                    onClose={() => setDuplicateRows([])}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={() => setDuplicateRows([])}>Cancel</button>
                        <button type="button" className="obi-draft-btn is-primary" onClick={applyDuplicates}>Continue to finalize</button>
                    </>}
                >
                    {duplicateRows.map(row => (
                        <div key={row.email} className="obi-draft-row">
                            <span className="obi-draft-row-name">{row.firstName} {row.lastName}</span>
                            <select
                                className="obi-draft-select"
                                style={{ width: 180, height: 28 }}
                                value={row.resolveAction}
                                onChange={(e) => setDuplicateRows(rows => rows.map(r => r.email === row.email ? { ...r, resolveAction: e.target.value } : r))}
                            >
                                <option value="update">Update existing profile</option>
                                <option value="create">Create a new player</option>
                            </select>
                        </div>
                    ))}
                </DraftModal>
            )}

            {buddyModal && (
                <DraftModal
                    title={buddyModal.queue ? `Buddies for ${buddyModal.anchor.firstName}` : 'Bring their buddies too?'}
                    step={buddyModal.queue ? `${buddyModal.queue.length} GM${buddyModal.queue.length === 1 ? '' : 's'} left` : undefined}
                    onClose={() => (buddyModal.queue ? advanceBuddyQueue(buddyModal.queue) : setBuddyModal(null))}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={() => {
                            if (buddyModal.queue) { advanceBuddyQueue(buddyModal.queue); return; }
                            dispatch({ type: ACTIONS.MOVE_PLAYERS, players: [buddyModal.anchor], targetTeamId: buddyModal.targetTeamId });
                            setBuddyModal(null);
                            setSelectedEmail(null);
                        }}>
                            {buddyModal.queue ? 'Skip' : 'Just this player'}
                        </button>
                        <button type="button" className="obi-draft-btn is-primary" onClick={confirmBuddies} disabled={buddyModal.selected.length === 0 && !buddyModal.queue}>
                            {buddyModal.queue ? `Add ${buddyModal.selected.length}` : `Add ${buddyModal.selected.length} and move`}
                        </button>
                    </>}
                >
                    <p style={{ marginTop: 0 }}>
                        {buddyModal.anchor.firstName} {buddyModal.anchor.lastName} has buddy requests still in the pool.
                    </p>
                    {buddyModal.buddies.map(b => (
                        <div key={b.email} className="obi-draft-row">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={buddyModal.selected.includes(b.email)}
                                    onChange={(e) => setBuddyModal(m => ({
                                        ...m,
                                        selected: e.target.checked
                                            ? [...m.selected, b.email]
                                            : m.selected.filter(x => x !== b.email)
                                    }))}
                                />
                                <span className="obi-draft-row-name">{b.firstName} {b.lastName}</span>
                            </label>
                            {isReciprocal(buddyPickMap, buddyModal.anchor.email, b.email) && (
                                <span className="obi-draft-badge is-buddy">↔ mutual</span>
                            )}
                            <span className="obi-draft-row-meta">{b.position === 'Defense' ? 'D' : 'F'}:{b.skillRating}</span>
                        </div>
                    ))}
                </DraftModal>
            )}

            {seasonModal && (
                <DraftModal
                    title="New season"
                    onClose={() => setSeasonModal(false)}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={() => setSeasonModal(false)}>Cancel</button>
                        <button type="button" className="obi-draft-btn is-primary" onClick={createSeason} disabled={seasonSaving}>
                            {seasonSaving ? 'Creating…' : 'Create season'}
                        </button>
                    </>}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input className="obi-draft-input" placeholder="Season name" value={seasonForm.name} onChange={(e) => setSeasonForm(f => ({ ...f, name: e.target.value }))} aria-label="Season name" />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input className="obi-draft-input" style={{ flex: 1 }} type="date" value={seasonForm.startDate} onChange={(e) => setSeasonForm(f => ({ ...f, startDate: e.target.value }))} aria-label="Start date" />
                            <input className="obi-draft-input" style={{ flex: 1 }} type="date" value={seasonForm.endDate} onChange={(e) => setSeasonForm(f => ({ ...f, endDate: e.target.value }))} aria-label="End date" />
                        </div>
                        <select className="obi-draft-select" value={seasonForm.status} onChange={(e) => setSeasonForm(f => ({ ...f, status: e.target.value }))} aria-label="Status">
                            <option value="upcoming">Upcoming</option>
                            <option value="active">Active</option>
                        </select>
                    </div>
                </DraftModal>
            )}

            {confirm && (
                <DraftModal
                    title={confirm.title}
                    destructive={confirm.destructive}
                    onClose={() => (confirm.onCancel ? confirm.onCancel() : setConfirm(null))}
                    footer={<>
                        <button type="button" className="obi-draft-btn" onClick={() => (confirm.onCancel ? confirm.onCancel() : setConfirm(null))}>
                            {confirm.cancelLabel || 'Cancel'}
                        </button>
                        <button type="button" className="obi-draft-btn is-accent" onClick={confirm.onConfirm}>{confirm.confirmLabel}</button>
                    </>}
                >
                    {confirm.body}
                    {confirm.kind === 'finalize' && unresolvedCount > 0 && (
                        <div style={{ marginTop: 12, color: 'var(--obi-error)' }}>
                            {unresolvedCount} player{unresolvedCount === 1 ? '' : 's'} still need attention from the import.
                        </div>
                    )}
                </DraftModal>
            )}
        </div>
    );
}
