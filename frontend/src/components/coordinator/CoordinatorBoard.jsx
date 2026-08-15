import { useState, useEffect, useCallback, Fragment } from 'react';
import api from '../../services/api';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import GoalieProposerBar from './GoalieProposerBar';
import { GOALIE_STATUS_STYLE, goalieCounts, isGoalieWeekPublished } from './goalieProposerStatus';
import { rankTeams, goaliePickTeamId } from '../../utils/goaliePick';
import './Coordinator.css';

const SLOTS_PER_ROLE = { GOALIE: 2, REF: 2, SCOREKEEPER: 1 };

// Status → visual config
const STATUS_STYLE = {
    OPEN:      { label: 'Open',          color: 'var(--obi-icy)',     bg: 'rgba(157,185,205,0.1)',  border: 'rgba(157,185,205,0.28)' },
    SIGNED_UP: { label: 'Signed Up',     color: '#0b0c0f',            bg: 'var(--obi-accent)',       border: 'var(--obi-accent)' },
    // Auto-proposer filled, email not yet sent (amber).
    AUTO_PROPOSED: GOALIE_STATUS_STYLE.AUTO_PROPOSED,
    PROPOSED:  { label: 'Awaiting',      color: 'var(--obi-icy)',     bg: 'rgba(157,185,205,0.12)', border: 'rgba(157,185,205,0.32)' },
    CONFIRMED: { label: 'Set · Confirmed',color:'var(--obi-success)', bg: 'rgba(127,181,154,0.14)', border: 'rgba(127,181,154,0.32)' },
    DECLINED:  GOALIE_STATUS_STYLE.DECLINED,
};

// A week is past (feature hidden) once all its games are Final.
function weekIsPast(games) {
    if (!games.length) return false;
    return games.every(g => String(g.status || '').toUpperCase() === 'FINAL');
}

// The auto-proposer is regular-season only — playoff matchups are TBD until the bracket is set.
function weekIsPlayoff(games) {
    if (!games.length) return false;
    return games.every(g => String(g.gameType || 'REGULAR_SEASON').toUpperCase() === 'PLAYOFF');
}

function getName(u) {
    return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username || `User ${u.id}`;
}

const MS_PER_DAY = 86400000;

// Timestamps come back as naive UTC (no zone suffix), same as gameDate.
function parseUtc(s) {
    if (!s) return null;
    const d = new Date(String(s).endsWith('Z') ? s : s + 'Z');
    return isNaN(d.getTime()) ? null : d;
}

function daysSince(s) {
    const d = parseUtc(s);
    return d == null ? null : Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
}

function agoLabel(days) {
    if (days == null) return '';
    if (days <= 0) return 'just now';
    return days === 1 ? '1 day ago' : `${days} days ago`;
}

function firstNameOf(name) {
    return name ? name.split(/\s+/)[0] : '';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const RINK_TBD = 'Rink TBD';

// League-local calendar day, for telling "later tonight" from "a different night".
function chicagoDayKey(dateStr) {
    return toChicago(dateStr).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function formatGap(ms) {
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

/**
 * What separates two consecutive games on the same sheet. Within a night that's the interval between
 * puck drops — deliberately "later", not "turnaround", because game length isn't in the data, so we
 * can't claim to know when the first game ends. Across nights an interval would be meaningless
 * ("72h later"), so the divider names the new night instead.
 */
function sheetGap(prev, next) {
    if (chicagoDayKey(prev.gameDate) !== chicagoDayKey(next.gameDate)) {
        const d = toChicago(next.gameDate);
        return { night: true, label: `${formatDay(d)} ${formatDateShort(d)} — next night on this sheet` };
    }
    const ms = toChicago(next.gameDate) - toChicago(prev.gameDate);
    return { night: false, label: `${formatGap(ms)} later on the same sheet` };
}

/** A week's games split per sheet of ice, each sheet in start-time order. */
function groupByRink(games) {
    const map = new Map();
    for (const g of games) {
        const key = (g.rink && g.rink.trim()) ? g.rink.trim() : RINK_TBD;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(g);
    }
    const groups = [...map.entries()].map(([rink, gs]) => ({
        rink,
        games: [...gs].sort((a, b) => toChicago(a.gameDate) - toChicago(b.gameDate)),
    }));
    // Earliest puck drop leads. Anything with no rink trails, so a data gap is visible rather than
    // silently mixed into a real sheet — and a misspelling makes its own group, which is fixable.
    groups.sort((a, b) => {
        if (a.rink === RINK_TBD) return 1;
        if (b.rink === RINK_TBD) return -1;
        return toChicago(a.games[0].gameDate) - toChicago(b.games[0].gameDate);
    });
    return groups;
}

/** How many slots a card would email, how many are already live, and how many are still waiting. */
function publishCounts(assignments, slotTotal) {
    const confirmed = assignments.filter(a => a.status === 'CONFIRMED');
    const liveCount = confirmed.filter(a => a.published === true).length;
    return {
        toNotify: confirmed.length - liveCount,
        liveCount,
        waitingCount: assignments.filter(a =>
            a.status === 'PROPOSED' || a.status === 'AUTO_PROPOSED' || a.status === 'SIGNED_UP').length,
        openSlots: Math.max(0, slotTotal - assignments.length),
        slotTotal,
    };
}

/**
 * Plain-English state of a card's publish button. The two disabled cases have to stay
 * distinguishable — "already live" and "nobody has confirmed yet" are different kinds of nothing,
 * and collapsing them into one greyed-out button is what made the old week button feel opaque.
 */
function publishNote({ toNotify, liveCount, waitingCount, openSlots, slotTotal }) {
    if (toNotify > 0) {
        if (liveCount > 0) {
            return `${plural(liveCount, 'slot')} already live · ${toNotify} newly confirmed to send`;
        }
        if (waitingCount > 0) {
            return `${toNotify} confirmed · ${waitingCount} still awaiting a reply`;
        }
        return 'Ready to publish';
    }
    if (liveCount > 0 && liveCount === slotTotal) {
        if (slotTotal === 1) return 'Already live — nothing new to send';
        if (slotTotal === 2) return 'Both slots are already live — nothing new to send';
        return 'Every slot is already live — nothing new to send';
    }
    if (liveCount > 0) {
        const rest = waitingCount > 0
            ? `${waitingCount} still awaiting a reply`
            : `${openSlots} still open`;
        return `${plural(liveCount, 'slot')} already live · ${rest}`;
    }
    if (waitingCount > 0) {
        return `Nobody has confirmed yet — ${waitingCount} awaiting a reply`;
    }
    return 'Nothing assigned yet';
}

/**
 * Secondary detail line for a slot row: why someone declined, and how long a proposal has gone
 * unanswered. Returns null for healthy rows — most rows are fine and the coordinator is scanning
 * for the two that aren't, so a confirmed row stays exactly one line.
 *
 * Expiry is read from the row's own tokenExpiresAt rather than assuming the 7-day TTL, so the
 * warning stays truthful if that lifetime is ever changed server-side.
 */
function slotMeta(assignment) {
    if (!assignment) return null;
    const { status, declineReason, userName } = assignment;

    if (status === 'DECLINED') {
        const who = firstNameOf(userName);
        const when = agoLabel(daysSince(assignment.respondedAt || assignment.updatedAt));
        return {
            tone: 'bad',
            line: `Declined ${when}${who ? ` by ${who}` : ''}`,
            reason: declineReason || null,
        };
    }

    // Filled but never emailed — the goalie auto-proposer's staging state.
    if (status === 'AUTO_PROPOSED') {
        return { tone: 'draft', line: 'Draft — nobody has been emailed', reason: null };
    }

    if (status === 'PROPOSED') {
        const days = daysSince(assignment.updatedAt);
        const expiry = parseUtc(assignment.tokenExpiresAt);
        const msLeft = expiry ? expiry.getTime() - Date.now() : null;

        if (msLeft != null && msLeft <= 0) {
            return {
                tone: 'bad',
                expired: true,
                line: `Emailed ${agoLabel(days)} · confirm link expired — re-send or reassign`,
                reason: null,
            };
        }
        const daysLeft = msLeft == null ? null : Math.ceil(msLeft / MS_PER_DAY);
        if (daysLeft != null && daysLeft <= 2) {
            return {
                tone: 'warn',
                line: `Emailed ${agoLabel(days)} · no reply yet · confirm link expires in `
                    + `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
                reason: null,
            };
        }
        return { tone: 'muted', line: `Emailed ${agoLabel(days)} · no reply yet`, reason: null };
    }

    return null;
}

function initials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function toChicago(dateStr) {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return d;
}

function formatDay(d) {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).toUpperCase();
}

function formatDateShort(d) {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
}

function formatTime(d) {
    return d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
}

function formatMonthName(d) {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long' });
}

function formatWeekRange(dates) {
    if (!dates.length) return '';
    const sorted = [...dates].sort();
    const first = toChicago(sorted[0]);
    const last = toChicago(sorted[sorted.length - 1]);
    const firstStr = formatDateShort(first);
    const lastStr = formatDateShort(last);
    return firstStr === lastStr ? firstStr : `${firstStr} – ${lastStr}`;
}

function CoordinatorBoard({ role }) {
    const { selectedSeasonId } = useSeason();
    const seasonId = selectedSeasonId ?? 13;

    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [rankByTeam, setRankByTeam] = useState(new Map()); // teamId -> standings rank, for goalie-pick label
    const [staff, setStaff] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [goaliePool, setGoaliePool] = useState([]);
    const [seasonRoster, setSeasonRoster] = useState([]); // full-time vs substitute split
    const [weekFilter, setWeekFilter] = useState('all');
    const [openPicker, setOpenPicker] = useState(null); // "gameId:slot"
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [publishing, setPublishing] = useState(false);
    // Ordering preference, not week data: kept across week switches and simply ignored in All Weeks,
    // so returning to a single week restores the view she left rather than silently resetting.
    const [rinkView, setRinkView] = useState(false);
    const [staffTeams, setStaffTeams] = useState(null); // null = still loading; [] = resolved, none
    const [staffUnavailable, setStaffUnavailable] = useState(new Set()); // "userId|YYYY-MM-DD"
    const [publishScope, setPublishScope] = useState(null); // null = panel closed
    const [publishPlan, setPublishPlan] = useState(null);   // dry-run result backing the panel
    const [publishError, setPublishError] = useState('');
    const [proposerBusy, setProposerBusy] = useState(null); // 'generate' | 'send' | 'publish' | null
    const [banner, setBanner] = useState(null);
    const [proposerRun, setProposerRun] = useState(null);   // last auto-propose result ("why" data)

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        setBanner(null);
        try {
            const [gamesData, teamsData, staffData, assignData, standingsData] = await Promise.all([
                api.getGames(seasonId),
                api.getTeams(),
                api.getUsers({ role }),
                api.getCoordinatorAssignments(seasonId, role),
                api.getStandings(seasonId).catch(() => null),
            ]);
            setGames(gamesData || []);
            setTeams(teamsData || []);
            setStaff([...(staffData || [])].sort((a, b) => getName(a).localeCompare(getName(b))));
            setAssignments(assignData || []);
            setRankByTeam(rankTeams(standingsData || teamsData || []));
        } catch {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [seasonId, role]);

    useEffect(() => { load(); }, [load]);

    // Team-per-staff-member is a separate fetch from the board's own data. Until it lands the
    // picker shows a skeleton chip rather than "not on a roster" — claiming we know before the
    // answer arrives is the same false confidence, just slower.
    useEffect(() => {
        setStaffTeams(null);
        api.getStaffTeams(seasonId, role)
            .then(data => setStaffTeams(data || []))
            .catch(() => setStaffTeams([]));
    }, [seasonId, role]);

    // Refs and scorekeepers mark individual dates they can't work (goalies mark whole weeks, handled
    // by the goalie pool above). This data was being collected and shown to nobody.
    useEffect(() => {
        if (role === 'GOALIE') { setStaffUnavailable(new Set()); return; }
        api.getCoordinatorAvailability(role)
            .then(rows => setStaffUnavailable(new Set((rows || []).map(r => `${r.userId}|${r.date}`))))
            .catch(() => setStaffUnavailable(new Set()));
    }, [role]);

    useEffect(() => {
        if (role !== 'GOALIE') { setSeasonRoster([]); return; }
        api.getSeasonGoalieRoster(seasonId)
            .then(data => setSeasonRoster(data || []))
            .catch(() => setSeasonRoster([]));
    }, [role, seasonId]);

    useEffect(() => {
        if (role !== 'GOALIE' || weekFilter === 'all') { setGoaliePool([]); return; }
        api.getCoordinatorGoalieAvailability(seasonId, parseInt(weekFilter))
            .then(data => setGoaliePool(data || []))
            .catch(() => setGoaliePool([]));
    }, [role, seasonId, weekFilter]);

    const reloadAssignments = async () => {
        const data = await api.getCoordinatorAssignments(seasonId, role);
        setAssignments(data || []);
    };

    const teamById = (id) => teams.find(t => t.id === id);

    const assignmentFor = (gameId, slot) =>
        assignments.find(a => a.gameId === gameId && a.slot === slot);

    const handleAssign = async (gameId, slot, userId) => {
        setError('');
        setOpenPicker(null);
        try {
            await api.proposeShift({ gameId, seasonId, role, slot, userId });
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to assign');
        }
    };

    const handleConfirm = async (assignmentId) => {
        setError('');
        try {
            await api.confirmSignup(assignmentId, role);
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to confirm');
        }
    };

    // Returns the removal outcome so the row's confirm can tell apart "nothing happened" from
    // "they're off the game but were never told" — only the second needs the coordinator to chase it.
    const handleClear = async (assignmentId) => {
        setError('');
        try {
            const result = await api.withdrawShift(assignmentId, role);
            await reloadAssignments();
            // A 2xx means the removal happened; the flags only refine what to say about the email.
            // Defaults first so an empty/legacy body still reads as the success it is.
            return { removed: true, notifyAttempted: false, notifySent: false, ...(result || {}) };
        } catch (e) {
            setError(e.message || 'Failed to clear');
            return { removed: false, notifyAttempted: false, notifySent: false };
        }
    };

    /**
     * Publishing always goes through the preview: the dry run and the real send walk the same rows
     * server-side, so what the panel promises is what actually goes out. Nothing is sent until the
     * coordinator confirms the named list.
     */
    const openPublishPreview = async (scope) => {
        setPublishScope(scope);
        setPublishPlan(null);
        setPublishError('');
        setPublishing(true);
        try {
            const plan = await api.publishShiftWeek(seasonId, role, scope.week, scope.gameId, true);
            setPublishPlan(plan);
        } catch (e) {
            setPublishError(e.message || 'Could not work out what would be sent.');
        } finally {
            setPublishing(false);
        }
    };

    const openMatchupPublish = (game) => {
        const d = toChicago(game.gameDate);
        openPublishPreview({
            kind: 'matchup',
            gameId: game.id,
            week: game.week,
            title: `${teamById(game.homeTeamId)?.name || 'Home'} vs ${teamById(game.awayTeamId)?.name || 'Away'}`,
            sub: `${formatDay(d)} ${formatDateShort(d)} · ${formatTime(d)} · ${game.rink || 'TBD'}`,
        });
    };

    const openWeekPublish = (week, gameCount) => openPublishPreview({
        kind: 'week',
        week,
        title: `Week ${week}`,
        sub: `${roleLabel} assignments · ${plural(gameCount, 'game')}`,
    });

    const confirmPublish = async () => {
        setPublishing(true);
        setPublishError('');
        try {
            const result = await api.publishShiftWeek(seasonId, role, publishScope.week, publishScope.gameId, false);
            await reloadAssignments();
            setPublishScope(null);
            setPublishPlan(null);
            setBanner(`Published ${result.publishedCount} assignment(s) for ${publishScope.title}.`
                + (result.publishedCount ? ' Assignment emails sent.' : ''));
        } catch (e) {
            // The panel stays open — closing it would leave her guessing who got mail.
            setPublishError(e.message || 'Publish failed. Nothing was sent.');
        } finally {
            setPublishing(false);
        }
    };

    const closePublish = () => { setPublishScope(null); setPublishPlan(null); setPublishError(''); };

    // ---- Goalie auto-proposer (single non-past week) ----

    const handleGenerate = async (week) => {
        setProposerBusy('generate');
        setError('');
        try {
            const result = await api.autoProposeGoalies(seasonId, week);
            await reloadAssignments();
            setProposerRun({ week, ...result });
            const sat = (result.sitting || []).map(s => s.name).join(', ');
            setBanner(
                `Proposed ${result.filledCount} goalie slot(s) for Week ${week}` +
                (result.openCount ? ` · ${result.openCount} still open` : '') +
                (sat ? ` · sitting out: ${sat}` : ''));
        } catch (e) {
            setError(e.message || 'Failed to generate proposals');
        } finally {
            setProposerBusy(null);
        }
    };

    const handleSendConfirmations = async (week) => {
        setProposerBusy('send');
        setError('');
        try {
            const result = await api.sendGoalieConfirmations(seasonId, week);
            await reloadAssignments();
            setBanner(`Sent ${result.sentCount} confirmation email(s) for Week ${week}.`);
        } catch (e) {
            setError(e.message || 'Failed to send confirmation emails');
        } finally {
            setProposerBusy(null);
        }
    };

    // Per-row: email one auto-proposed goalie their confirmation request (AUTO_PROPOSED -> PROPOSED).
    const handleSendOne = async (gameId, slot, userId) => {
        setError('');
        try {
            await api.proposeShift({ gameId, seasonId, role, slot, userId });
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to send confirmation');
        }
    };

    // Dev-only: simulate the goalie's email confirm/decline so the flow is testable locally.
    const handleSimulate = async (assignmentId, action) => {
        setError('');
        try {
            await api.simulateShiftResponse(assignmentId, action, role);
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to simulate response');
        }
    };

    // Move both goalies to the other team's slot — keeps their confirmation, sends no email.
    const handleSwap = async (gameId) => {
        setError('');
        try {
            await api.swapGoalieSlots(gameId);
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to swap goalies');
        }
    };

    // ---- Derived data ----

    const weeks = [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);

    const weekDates = weeks.reduce((acc, w) => {
        acc[w] = games.filter(g => g.week === w).map(g => g.gameDate);
        return acc;
    }, {});

    const weekChips = [
        { key: 'all', label: 'All Weeks', range: 'Full Season' },
        ...weeks.map(w => ({ key: w, label: `Week ${w}`, range: formatWeekRange(weekDates[w] || []) })),
    ];

    const filteredGames = games.filter(g => weekFilter === 'all' || g.week === parseInt(weekFilter));

    const filteredAssignments = assignments.filter(a => {
        if (weekFilter === 'all') return true;
        const g = games.find(g => g.id === a.gameId);
        return g && g.week === parseInt(weekFilter);
    });

    const slotsPerGame = SLOTS_PER_ROLE[role] ?? 1;
    const totalSlots = filteredGames.length * slotsPerGame;
    const openCount = totalSlots - filteredAssignments.length;
    const signedUpCount = filteredAssignments.filter(a => a.status === 'SIGNED_UP').length;
    const proposedCount = filteredAssignments.filter(a => a.status === 'PROPOSED').length;
    const confirmedCount = filteredAssignments.filter(a => a.status === 'CONFIRMED').length;

    const summary = [
        { label: 'Open', value: Math.max(0, openCount), color: 'var(--obi-icy)', border: 'rgba(157,185,205,0.2)' },
        { label: 'Signups to Confirm', value: signedUpCount, color: 'var(--obi-accent)', border: 'rgba(246,169,28,0.35)' },
        { label: 'Awaiting Player', value: proposedCount, color: 'var(--obi-icy)', border: 'rgba(157,185,205,0.2)' },
        { label: 'Set', value: confirmedCount, color: 'var(--obi-success)', border: 'rgba(127,181,154,0.3)' },
    ];

    // Group games by month → week
    const monthGroups = (() => {
        const byWeek = {};
        const byMonth = {};
        const monthOrder = [];

        filteredGames.forEach(g => {
            const d = toChicago(g.gameDate);
            const month = formatMonthName(d);
            if (!byWeek[g.week]) byWeek[g.week] = { month, games: [] };
            byWeek[g.week].games.push(g);
        });

        Object.entries(byWeek).forEach(([week, { month, games: wGames }]) => {
            const wNum = parseInt(week);
            const wAssign = assignments.filter(a => wGames.some(g => g.id === a.gameId));
            const wSlots = wGames.length * slotsPerGame;
            const wOpen = Math.max(0, wSlots - wAssign.length);
            const wConfirmed = wAssign.filter(a => a.status === 'CONFIRMED');
            const entry = {
                week: wNum,
                label: `Week ${wNum}`,
                range: formatWeekRange(weekDates[wNum] || []),
                games: wGames,
                openCount: wOpen,
                toNotify: wConfirmed.filter(a => a.published !== true).length,
            };
            if (!byMonth[month]) { byMonth[month] = []; monthOrder.push(month); }
            byMonth[month].push(entry);
        });

        return monthOrder.map(name => ({ name, weeks: byMonth[name] }));
    })();

    const singleWeek = weekFilter !== 'all';

    // Both orderings render the same card, so the prop list lives in one place.
    const renderCard = (g) => (
        <GameCard
            key={g.id}
            game={g}
            role={role}
            teamById={teamById}
            rankByTeam={rankByTeam}
            assignmentFor={assignmentFor}
            staff={staff}
            goaliePool={goaliePool}
            seasonRoster={seasonRoster}
            staffTeams={staffTeams}
            staffUnavailable={staffUnavailable}
            weekFilter={weekFilter}
            openPicker={openPicker}
            setOpenPicker={setOpenPicker}
            onAssign={handleAssign}
            onConfirm={handleConfirm}
            onClear={handleClear}
            onSendOne={handleSendOne}
            onSimulate={handleSimulate}
            onSwap={handleSwap}
            onPublishMatchup={openMatchupPublish}
            slotsPerGame={slotsPerGame}
        />
    );

    const roleLabel = role === 'GOALIE' ? 'Goalie' : role === 'REF' ? 'Referee' : 'Scorekeeper';
    const scopeLabel = weekFilter === 'all' ? 'Full Season' : `Week ${weekFilter}`;

    // Goalie auto-proposer: only for a single, non-past week.
    // Playoff weeks are supported too — the backend switches to best-available-goalie mode.
    const isPlayoffWeek = weekIsPlayoff(filteredGames);
    const showProposer = role === 'GOALIE' && weekFilter !== 'all' && !weekIsPast(filteredGames);
    const proposerCounts = goalieCounts(filteredAssignments, totalSlots);
    const proposerPublished = isGoalieWeekPublished(filteredAssignments);
    const anyFilled = filteredAssignments.some(a => a.status !== 'DECLINED');

    if (loading) return <div className="cc-loading">Loading…</div>;

    return (
        <>
            {/* Week chips */}
            <div className="cc-week-bar">
                <span className="cc-week-bar-label">Schedule</span>
                <div className="cc-week-chips">
                    {weekChips.map(c => (
                        <div
                            key={c.key}
                            role="button"
                            tabIndex={0}
                            className={`cc-week-chip${weekFilter === c.key ? ' is-active' : ''}`}
                            onClick={() => { setWeekFilter(c.key); setOpenPicker(null); setBanner(null); }}
                            onKeyDown={e => e.key === 'Enter' && (() => { setWeekFilter(c.key); setOpenPicker(null); setBanner(null); })()}
                        >
                            {c.label}
                            <span className="cc-week-chip-range">{c.range}</span>
                        </div>
                    ))}
                </div>
            </div>

            {role === 'GOALIE' && (
                <div className="cc-pick-legend">
                    <span className="cc-pick-legend-swatch" />
                    Outlined team has goalie pick this week
                </div>
            )}

            {/* Summary */}
            <div className="cc-summary-grid">
                {summary.map(m => (
                    <div key={m.label} className="cc-summary-card" style={{ border: `1px solid ${m.border}` }}>
                        <div className="cc-summary-value" style={{ color: m.color }}>{m.value}</div>
                        <div className="cc-summary-label">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* Result banner. The goalie proposer bar renders its own, so this covers the other roles
                (and goalie weeks where the bar is hidden) rather than letting the message vanish. */}
            {banner && !showProposer && (
                <div className="cc-publish-result is-ok">
                    <strong>{banner}</strong>
                    <button type="button" className="cc-banner-dismiss" onClick={() => setBanner(null)}>
                        Dismiss
                    </button>
                </div>
            )}

            {/* Goalie pool */}
            {role === 'GOALIE' && weekFilter !== 'all' && goaliePool.length > 0 && (
                <div className="cc-goalie-pool">
                    <div className="cc-goalie-pool-hd">
                        <span className="cc-goalie-pool-title">Available Goalie Pool</span>
                        <span className="cc-goalie-pool-sub">Goalies mark availability — they don&apos;t sign up. Assign one to each team&apos;s slot to keep matchups balanced.</span>
                    </div>
                    <div className="cc-goalie-pool-list">
                        {goaliePool.map(g => {
                            const avail = g.status === 'AVAILABLE';
                            return (
                                <div
                                    key={g.userId}
                                    className="cc-goalie-chip"
                                    style={{ border: `1px solid ${avail ? 'rgba(127,181,154,0.32)' : 'rgba(157,185,205,0.16)'}` }}
                                >
                                    <div
                                        className="cc-goalie-chip-dot"
                                        style={{ background: avail ? 'var(--obi-success)' : 'rgba(157,185,205,0.18)', color: avail ? '#0b0c0f' : '#fff' }}
                                    >
                                        {initials(g.userName)}
                                    </div>
                                    <div>
                                        <div className="cc-goalie-chip-name">{g.userName}</div>
                                        <div className="cc-goalie-chip-status" style={{ color: avail ? 'var(--obi-success)' : 'var(--obi-text-muted)' }}>
                                            {avail ? 'Available this week' : 'Not available'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Goalie auto-proposer bar (single non-past week) */}
            {showProposer && (
                <GoalieProposerBar
                    week={parseInt(weekFilter)}
                    variant="console"
                    playoff={isPlayoffWeek}
                    counts={proposerCounts}
                    published={proposerPublished}
                    publishedSummary={`Final game & team assignment emails sent to ${proposerCounts.confirmed} goalie(s) for Week ${weekFilter}.`}
                    busy={proposerBusy}
                    anyFilled={anyFilled}
                    banner={banner}
                    onDismissBanner={() => setBanner(null)}
                    onGenerate={() => handleGenerate(parseInt(weekFilter))}
                    onSend={() => handleSendConfirmations(parseInt(weekFilter))}
                    onPublish={() => openWeekPublish(parseInt(weekFilter), filteredGames.length)}
                    reasoning={proposerRun?.week === parseInt(weekFilter) ? proposerRun.reasoning : null}
                    sitting={proposerRun?.week === parseInt(weekFilter) ? proposerRun.sitting : null}
                />
            )}

            {/* Error */}
            {error && <div className="cc-error">{error}</div>}

            {/* Section heading */}
            <div className="cc-section-hd">{roleLabel} Assignments · {scopeLabel}</div>

            {/* Game groups */}
            {filteredGames.length === 0 ? (
                <div className="cc-empty">No games found for this filter.</div>
            ) : (
                <div className="cc-months">
                    {monthGroups.map(mo => (
                        <div key={mo.name}>
                            <div className="cc-month-hd">
                                {mo.name}
                                <span className="cc-month-rule" />
                            </div>
                            <div className="cc-weeks">
                                {mo.weeks.map(wg => (
                                    <div key={wg.week}>
                                        <div className="cc-week-hd">
                                            <span className="cc-week-hd-label">{wg.label}</span>
                                            <span className="cc-week-hd-range">{wg.range}</span>
                                            <div className="cc-week-hd-actions">
                                                <span className="cc-week-scope-note">
                                                    {wg.openCount > 0 ? `${wg.openCount} open` : 'All assigned'}
                                                </span>
                                                {/* Ordering only means something within one week, so in
                                                    All Weeks the control is absent rather than disabled. */}
                                                {singleWeek && (
                                                    <div className="cc-view-toggle" role="group" aria-label="Game order">
                                                        <button
                                                            type="button"
                                                            className={rinkView ? '' : 'is-active'}
                                                            onClick={() => setRinkView(false)}
                                                        >
                                                            By Time
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={rinkView ? 'is-active' : ''}
                                                            onClick={() => setRinkView(true)}
                                                        >
                                                            By Rink
                                                        </button>
                                                    </div>
                                                )}
                                                <button
                                                    className="cc-publish-btn"
                                                    onClick={() => openWeekPublish(wg.week, wg.games.length)}
                                                    disabled={publishing || wg.toNotify === 0}
                                                    title={wg.toNotify === 0
                                                        ? 'Nothing new to publish — every confirmed slot in this week is already live.'
                                                        : undefined}
                                                >
                                                    {wg.toNotify > 0
                                                        ? `Publish Week ${wg.week} · ${wg.toNotify} to notify`
                                                        : `Publish Week ${wg.week}`}
                                                </button>
                                            </div>
                                        </div>
                                        {singleWeek && rinkView ? (
                                            <div className="cc-rink-groups">
                                                {groupByRink(wg.games).map(grp => {
                                                    // One game on a sheet has nothing to be adjacent
                                                    // to, so the timeline would be pure ornament —
                                                    // but the header still renders, so the week's
                                                    // uneven shape stays honest.
                                                    const hasRail = grp.games.length > 1;
                                                    const grpOpen = grp.games.reduce((n, g) => {
                                                        const filled = assignments.filter(a => a.gameId === g.id).length;
                                                        return n + Math.max(0, slotsPerGame - filled);
                                                    }, 0);
                                                    return (
                                                        <div key={grp.rink} className="cc-rink-group">
                                                            <div className="cc-rink-hd">
                                                                <span className="cc-rink-dot" />
                                                                <span className="cc-rink-name">{grp.rink}</span>
                                                                <span className="cc-rink-meta">
                                                                    {plural(grp.games.length, 'game')} · {grpOpen} open
                                                                </span>
                                                            </div>
                                                            <div className={`cc-rink-body${hasRail ? ' has-rail' : ''}`}>
                                                                {grp.games.map((g, i) => {
                                                                    const gap = i > 0 ? sheetGap(grp.games[i - 1], g) : null;
                                                                    return (
                                                                        <Fragment key={g.id}>
                                                                            {gap && (
                                                                                <div className={`cc-rink-gap${gap.night ? ' is-night' : ''}`}>
                                                                                    {gap.label}
                                                                                </div>
                                                                            )}
                                                                            <div className="cc-rink-item">
                                                                                {hasRail && <span className="cc-rink-node" />}
                                                                                {renderCard(g)}
                                                                            </div>
                                                                        </Fragment>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="cc-games">
                                                {wg.games.map(g => renderCard(g))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {publishScope && (
                <PublishPreview
                    scope={publishScope}
                    plan={publishPlan}
                    busy={publishing}
                    error={publishError}
                    onConfirm={confirmPublish}
                    onCancel={closePublish}
                />
            )}

            <p className="cc-footer-note">
                Confirmed assignments appear on the public schedule, live score entry, and game management pages.
            </p>
        </>
    );
}

/**
 * Shown before every publish, week or matchup. Answers the one question that made the week-wide
 * button feel unsafe — "who exactly gets an email" — by naming them, and says plainly who will NOT
 * be re-emailed. The plan comes from a server dry run, so it can't drift from what actually sends.
 */
function PublishPreview({ scope, plan, busy, error, onConfirm, onCancel }) {
    const willEmail = plan?.willEmail || [];
    const alreadyLive = plan?.alreadyLive || [];
    const blocked = plan?.blocked || [];
    const n = willEmail.length;

    const headline = n === 0 ? 'Nobody gets an email'
        : n === 1 ? '1 person will be emailed'
            : `${n} people will be emailed`;

    return (
        <div className="cc-publish-preview" role="dialog" aria-modal="true" onClick={onCancel}>
            <div className={`cc-pp-panel${error ? ' has-error' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="cc-pp-hd">
                    <div className="cc-pp-kicker">
                        {scope.kind === 'matchup' ? 'Publish one matchup' : 'Publish week'}
                    </div>
                    <div className="cc-pp-title">{scope.title}</div>
                    <div className="cc-pp-sub">{scope.sub}</div>
                </div>

                {error && <div className="cc-pp-alert">{error}</div>}

                {!plan && !error ? (
                    <div className="cc-pp-body"><div className="cc-pp-loading">Working out what would be sent…</div></div>
                ) : (
                    <div className="cc-pp-body">
                        <div className="cc-pp-headline">{headline}</div>
                        {n > 0 && (
                            <div className="cc-pp-headline-sub">
                                Final assignment email — their shift is locked in, no action needed.
                            </div>
                        )}

                        {n === 0 ? (
                            <div className="cc-pp-empty">
                                {alreadyLive.length > 0
                                    ? 'Every confirmed assignment in this scope is already published. '
                                      + 'Publishing again would send nothing — you can safely close this.'
                                    : 'Nothing is confirmed here yet. Confirmed slots are the only ones that publish.'}
                            </div>
                        ) : (
                            <div className="cc-pp-people">
                                {willEmail.map(p => (
                                    <div key={p.assignmentId} className="cc-pp-person">
                                        <span className="cc-pp-avatar">{initials(p.userName)}</span>
                                        <span>
                                            <span className="cc-pp-name">{p.userName}</span>
                                            <span className="cc-pp-detail">
                                                {[p.slotLabel, p.matchup, p.dayDate, p.time].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {alreadyLive.length > 0 && (
                            <div className="cc-pp-note is-ok">
                                <span className="cc-pp-note-mark">&#10003;</span>
                                <span>
                                    <span className="cc-pp-note-line">
                                        {plural(alreadyLive.length, 'assignment')}
                                        {alreadyLive.length === 1 ? ' is' : ' are'} already published and will not be re-sent.
                                    </span>
                                    <span className="cc-pp-note-names">
                                        {alreadyLive.map(p => `${p.userName} (${p.slotLabel})`).join(', ')}
                                    </span>
                                </span>
                            </div>
                        )}

                        {blocked.length > 0 && (
                            <div className="cc-pp-note">
                                <span className="cc-pp-note-mark">&#8213;</span>
                                <span>
                                    <span className="cc-pp-note-line">
                                        {plural(blocked.length, 'slot')} won&apos;t publish yet:
                                    </span>
                                    {blocked.map(p => (
                                        <span key={p.assignmentId} className="cc-pp-note-names">
                                            {p.userName} · {p.slotLabel}, {p.matchup} · {p.reason}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="cc-pp-ft">
                    <button type="button" className="cc-pp-cancel" disabled={busy} onClick={onCancel}>
                        {n === 0 && plan ? 'Close' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        className="cc-pp-go"
                        disabled={busy || !plan || n === 0}
                        onClick={onConfirm}
                    >
                        {busy ? 'Sending…' : n === 0 ? 'Nothing to send' : `Send ${plural(n, 'Email')}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Pill outline in a team's own color, marking the team that has goalie pick this matchup. The
// non-pick side gets a transparent border of the same box size so the row doesn't shift.
function pickPillStyle(isPick, teamColor) {
    if (!isPick) return { border: '1px solid transparent', background: 'transparent' };
    const c = resolveTeamColor(teamColor);
    return { border: `1px solid ${c}`, background: `color-mix(in srgb, ${c} 14%, transparent)` };
}

function GameCard({ game, role, teamById, rankByTeam, assignmentFor, staff, goaliePool, seasonRoster, staffTeams, staffUnavailable, weekFilter, openPicker, setOpenPicker, onAssign, onConfirm, onClear, onSendOne, onSimulate, onSwap, onPublishMatchup, slotsPerGame }) {
    const homeTeam = teamById(game.homeTeamId);
    const awayTeam = teamById(game.awayTeamId);
    const d = toChicago(game.gameDate);

    // Which team picks their goalie this matchup (regular season: lower in standings; playoffs: higher).
    const pickTeamId = role === 'GOALIE' ? goaliePickTeamId(game, rankByTeam) : null;
    const pickTitle = String(game.gameType || 'REGULAR_SEASON').toUpperCase() === 'PLAYOFF'
        ? 'Playoffs: higher seed in the standings has goalie pick'
        : 'Lower in the standings has goalie pick this week';

    const slots = buildSlots(game, role, homeTeam, awayTeam);
    const totalSlots = slotsPerGame;
    const gameAssignments = slots.map(s => assignmentFor(game.id, s.slot)).filter(Boolean);
    // One swap button per matchup (header), enabled once either goalie slot has someone in it.
    const canSwapGoalies = role === 'GOALIE' && gameAssignments.some(a => a?.userId);
    const confirmedCount = gameAssignments.filter(a => a.status === 'CONFIRMED').length;
    const openCount = totalSlots - gameAssignments.length;
    const allSet = confirmedCount === totalSlots && openCount === 0;

    const counts = publishCounts(gameAssignments, totalSlots);
    const note = publishNote(counts);

    const fillLabel = allSet ? 'All Set' : openCount > 0 ? `${openCount} Open` : `${confirmedCount} / ${totalSlots} Set`;
    const fillColor = allSet ? 'var(--obi-success)' : openCount > 0 ? 'var(--obi-icy)' : 'var(--obi-accent)';
    const fillBg = allSet ? 'rgba(127,181,154,0.14)' : openCount > 0 ? 'rgba(157,185,205,0.1)' : 'rgba(246,169,28,0.12)';
    const fillBorder = allSet ? 'rgba(127,181,154,0.32)' : openCount > 0 ? 'rgba(157,185,205,0.25)' : 'rgba(246,169,28,0.32)';

    return (
        <div className="cc-game-card">
            <div className="cc-game-hd">
                <div className="cc-game-date-block">
                    <div className="cc-game-day">{formatDay(d)}</div>
                    <div className="cc-game-date">{formatDateShort(d)}</div>
                </div>
                <div className="cc-game-matchup">
                    <div className="cc-game-teams">
                        <span className="cc-team-pill" style={pickPillStyle(pickTeamId === game.homeTeamId, homeTeam?.teamColor)}
                            title={pickTeamId === game.homeTeamId ? pickTitle : undefined}>
                            <span className="cc-team-dot" style={{ background: resolveTeamColor(homeTeam?.teamColor) }} />
                            <span className="cc-team-name">{homeTeam?.name || `Team ${game.homeTeamId}`}</span>
                        </span>
                        <span className="cc-vs">vs</span>
                        <span className="cc-team-pill" style={pickPillStyle(pickTeamId === game.awayTeamId, awayTeam?.teamColor)}
                            title={pickTeamId === game.awayTeamId ? pickTitle : undefined}>
                            <span className="cc-team-name">{awayTeam?.name || `Team ${game.awayTeamId}`}</span>
                            <span className="cc-team-dot" style={{ background: resolveTeamColor(awayTeam?.teamColor) }} />
                        </span>
                    </div>
                    <div className="cc-game-meta">{formatTime(d)} · {game.rink || 'TBD'}</div>
                </div>
                <span className="cc-fill-badge" style={{ color: fillColor, background: fillBg, border: `1px solid ${fillBorder}` }}>
                    {fillLabel}
                </span>
            </div>

            {slots.map(s => {
                const assignment = assignmentFor(game.id, s.slot);
                const pickerKey = `${game.id}:${s.slot}`;
                return (
                    <SlotRow
                        key={s.slot}
                        slotDef={s}
                        assignment={assignment}
                        pickerOpen={openPicker === pickerKey}
                        onOpenPicker={() => setOpenPicker(pickerKey)}
                        onClosePicker={() => setOpenPicker(null)}
                        onAssign={(userId) => onAssign(game.id, s.slot, userId)}
                        onConfirm={() => onConfirm(assignment?.id)}
                        onClear={() => onClear(assignment?.id)}
                        onSendOne={() => onSendOne(game.id, s.slot, assignment?.userId)}
                        onSimulate={(action) => onSimulate(assignment?.id, action)}
                        isPickTeam={pickTeamId != null && pickTeamId === (s.slot === 1 ? game.homeTeamId : game.awayTeamId)}
                        pickTitle={pickTitle}
                        staff={staff}
                        staffTeams={staffTeams}
                        staffUnavailable={staffUnavailable}
                        gameDayKey={chicagoDayKey(game.gameDate)}
                        gameTeamIds={[game.homeTeamId, game.awayTeamId]}
                        role={role}
                        goaliePool={goaliePool}
                        seasonRoster={seasonRoster}
                        weekFilter={weekFilter}
                    />
                );
            })}

            {/* Card-level actions live below the slots, not in the header: the header answers "which
                game is this", and an action belongs after you've read the slots it acts on. */}
            <div className="cc-card-actions">
                {canSwapGoalies && (
                    <button
                        type="button"
                        className="cc-swap-btn"
                        title="Swap the two teams' goalies — keeps each goalie's confirmation, no new email sent"
                        onClick={() => onSwap(game.id)}
                    >
                        &#8646; Swap Goalies
                    </button>
                )}
                <span className={`cc-card-note${counts.toNotify > 0 ? '' : ' is-dim'}`}>{note}</span>
                <button
                    type="button"
                    className="cc-card-publish"
                    disabled={counts.toNotify === 0}
                    title={counts.toNotify === 0 ? note : undefined}
                    onClick={() => onPublishMatchup(game)}
                >
                    {counts.toNotify > 0 ? `Publish Matchup · ${counts.toNotify} to notify` : 'Publish Matchup'}
                </button>
            </div>
        </div>
    );
}

function SlotRow({ slotDef, assignment, pickerOpen, onOpenPicker, onClosePicker, onAssign, onConfirm, onClear, onSendOne, onSimulate, isPickTeam, pickTitle, staff, staffTeams, staffUnavailable, gameDayKey, gameTeamIds, role, goaliePool, seasonRoster, weekFilter }) {
    const status = assignment?.status ?? 'OPEN';
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.OPEN;
    const playerName = assignment?.userName ?? null;

    const statusLabel = (() => {
        if (status === 'PROPOSED' && playerName) return `Awaiting ${playerName.split(' ')[0]}`;
        return style.label;
    })();

    const reassignAction = { label: 'Reassign', color: '#C8D0D8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(157,185,205,0.25)', onClick: onOpenPicker };

    // Taking someone off a slot they committed to is destructive and emails them, so it expands an
    // inline confirm rather than firing — unlike "Clear" on an unanswered proposal, which is harmless.
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState('');
    // True once the row is gone but the email failed: the removal must not be retried (there is no
    // row left to remove), so the panel drops to an acknowledgement rather than offering a dead action.
    const [unnotified, setUnnotified] = useState(false);
    // Held separately because a successful removal empties the row: by the time the half-state
    // message renders, the slot's own name is already gone.
    const [removeName, setRemoveName] = useState('');
    const removeAction = {
        label: 'Remove',
        color: 'var(--obi-error)',
        bg: 'rgba(224,138,138,0.08)',
        border: 'rgba(224,138,138,0.32)',
        onClick: () => { setRemoveError(''); setRemoveName(playerName || ''); setConfirmingRemove(true); },
    };

    const actions = [];
    if (status === 'OPEN') {
        actions.push({ label: 'Assign', color: '#0b0c0f', bg: 'var(--obi-accent)', border: 'var(--obi-accent)', onClick: onOpenPicker });
    } else if (status === 'SIGNED_UP') {
        actions.push({ label: 'Confirm', color: '#0b0c0f', bg: 'var(--obi-accent)', border: 'var(--obi-accent)', onClick: onConfirm });
        actions.push(reassignAction);
        actions.push(removeAction);
    } else if (status === 'AUTO_PROPOSED') {
        // Auto-proposed, email not yet sent: email this one now, or swap the pick first.
        actions.push({ label: 'Send Confirmation', color: '#fff', bg: '#2C8C94', border: '#2C8C94', onClick: onSendOne });
        actions.push({ label: 'Swap', color: '#C8D0D8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(157,185,205,0.25)', onClick: onOpenPicker });
    } else if (status === 'PROPOSED') {
        actions.push(reassignAction);
        actions.push({ label: 'Clear', color: 'var(--obi-error)', bg: 'rgba(224,138,138,0.1)', border: 'rgba(224,138,138,0.3)', onClick: onClear });
    } else if (status === 'DECLINED') {
        actions.push(reassignAction);
    } else if (status === 'CONFIRMED') {
        actions.push(reassignAction);
        actions.push(removeAction);
    }

    const meta = slotMeta(assignment);
    const isPublished = assignment?.published === true;

    // Only ever set when the person actually resolved to a roster — an unknown never produces a
    // warning, which is what keeps "we don't know" from masquerading as "we checked".
    const assignedConflict = (() => {
        if (!assignment?.userId) return null;
        const t = (staffTeams || []).find(x => x.userId === assignment.userId);
        if (!t?.resolved) return null;
        return gameTeamIds.some(id => id != null && id === t.teamId) ? t : null;
    })();

    const removeBody = (() => {
        const who = removeName || playerName || 'This person';
        if (isPublished) {
            return `${who} is published, so they come off the public schedule, game preview and score `
                + 'entry immediately. They get a cancellation email, and the slot goes back to Open.';
        }
        if (status === 'SIGNED_UP') {
            return `${who} signed up but hasn't been confirmed or published, so nothing public changes. `
                + 'They get a cancellation email, and the slot goes back to Open.';
        }
        return `${who} has confirmed but was never published, so nothing public changes. `
            + 'They get a cancellation email, and the slot goes back to Open.';
    })();

    const handleRemove = async () => {
        setRemoving(true);
        setRemoveError('');
        const result = await onClear();
        setRemoving(false);
        if (!result?.removed) {
            setRemoveError('Nothing changed — the removal itself failed. Try again.');
            return;
        }
        if (result.notifyAttempted && !result.notifySent) {
            // The dangerous half-state: off the game, but they don't know it yet.
            setUnnotified(true);
            setRemoveError(`${removeName || 'They'} was removed from the game, but the cancellation `
                + 'email didn\'t send. They do not know yet — contact them directly.');
            return;
        }
        setConfirmingRemove(false);
    };

    const closeRemove = () => { setConfirmingRemove(false); setRemoveError(''); setUnnotified(false); };

    // Dev-only: stand in for the goalie's real email confirm/decline while testing the flow.
    const showSimulate = import.meta.env.DEV && status === 'PROPOSED' && role === 'GOALIE';

    // "Add a Substitute" expands the sub roster inside the picker.
    const [showSubs, setShowSubs] = useState(false);

    const pickerTitle = (() => {
        const verb = status === 'OPEN' ? 'Assign' : 'Reassign';
        const who = role === 'GOALIE' ? `${slotDef.label} goalie` : role === 'REF' ? `Ref ${slotDef.slot}` : 'scorekeeper';
        return `${verb} ${who} — they'll get an email to confirm`;
    })();

    // Candidates: only goalies who explicitly marked themselves UNAVAILABLE are disabled. A goalie
    // with unknown / not-set availability stays selectable — they can still be assigned and will get
    // an email to confirm the time (people routinely just forget to mark the week).
    const unavailableGoalieIds = new Set(
        role === 'GOALIE' && weekFilter !== 'all'
            ? goaliePool.filter(g => g.status === 'UNAVAILABLE').map(g => g.userId)
            : []
    );

    // Roster state per candidate. Three outcomes, and the difference that matters is between
    // "clear" and "unknown": a chip means we actually resolved them. Blank would read as clear and
    // hand out false confidence exactly where the coordinator is relying on memory today.
    const teamsLoading = staffTeams === null;
    const teamByUser = new Map((staffTeams || []).map(t => [t.userId, t]));

    const candidates = staff.map(u => {
        const name = getName(u);
        // Goalies mark whole weeks; refs and scorekeepers mark individual dates, so theirs is
        // checked against this game's own night rather than the week it sits in.
        const unavailable = role === 'GOALIE'
            ? (weekFilter !== 'all' && unavailableGoalieIds.has(u.id))
            : staffUnavailable.has(`${u.id}|${gameDayKey}`);
        const poolEntry = role === 'GOALIE' && weekFilter !== 'all' ? goaliePool.find(g => g.userId === u.id) : null;
        const sub = role === 'GOALIE'
            ? (poolEntry ? (poolEntry.status === 'AVAILABLE' ? 'Available this week' : 'Not available') : 'Availability unknown')
            : 'Not available this date';
        const subColor = role === 'GOALIE'
            ? (poolEntry?.status === 'AVAILABLE' ? 'var(--obi-success)' : 'var(--obi-text-muted)')
            : 'var(--obi-text-muted)';

        const t = teamByUser.get(u.id);
        const resolved = !!t?.resolved;
        const conflict = resolved && gameTeamIds.some(id => id != null && id === t.teamId);
        return {
            id: u.id, name, unavailable, sub, subColor,
            resolved, conflict,
            teamName: t?.teamName || null,
            teamColor: t?.teamColor || null,
        };
    });

    /** The roster line under a candidate. Suppressed when they can't be picked anyway. */
    const rosterLine = (c) => {
        if (c.unavailable) return null;              // availability already decided it; don't stack
        if (teamsLoading) return { skeleton: true };
        if (c.conflict) return { text: 'Playing in this game', tone: 'conflict' };
        if (c.resolved) return { text: 'Not playing in this game', tone: 'clear' };
        return { text: 'Not on a roster this season', tone: 'unknown' };
    };

    // Goalie picker splits the roster: full-timers listed directly, substitutes revealed by
    // "Add a Substitute" (ad hoc fill-ins, not part of the weekly auto-assignment).
    const substituteIds = new Set(
        role === 'GOALIE' ? seasonRoster.filter(r => !r.fulltime).map(r => r.userId) : []);
    const primaryCandidates = role === 'GOALIE' && seasonRoster.length
        ? candidates.filter(c => !substituteIds.has(c.id))
        : candidates;
    const substituteCandidates = role === 'GOALIE' && seasonRoster.length
        ? candidates.filter(c => substituteIds.has(c.id))
        : [];

    return (
        <div className="cc-slot-row">
            <div className="cc-slot-inner">
                <div className="cc-slot-label-col">
                    <span className="cc-slot-team-pill" style={pickPillStyle(isPickTeam, slotDef.teamColor)}
                        title={isPickTeam ? pickTitle : undefined}>
                        {slotDef.showDot && (
                            <span className="cc-slot-dot" style={{ background: slotDef.teamColor }} />
                        )}
                        <span className="cc-slot-label">{slotDef.label}</span>
                    </span>
                </div>

                <div className="cc-slot-player-col">
                    {playerName ? (
                        <div className="cc-slot-player">
                            <span className="cc-player-avatar">{initials(playerName)}</span>
                            <span className="cc-player-name">{playerName}</span>
                        </div>
                    ) : (
                        <span className="cc-slot-empty">Unassigned</span>
                    )}
                </div>

                {/* An expired confirm link needs an action, not a warning, so the chip itself changes. */}
                <span
                    className="cc-status-chip"
                    style={meta?.expired
                        ? { color: 'var(--obi-error)', background: 'rgba(224,138,138,0.12)', border: '1px solid rgba(224,138,138,0.4)' }
                        : { color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
                >
                    {meta?.expired ? 'Link Expired' : statusLabel}
                </span>

                <div className="cc-slot-actions">
                    {actions.map(a => (
                        <button
                            key={a.label}
                            className="cc-action-btn"
                            style={{ color: a.color, background: a.bg, border: `1px solid ${a.border}` }}
                            onClick={a.onClick}
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* The picker closes, so a conflict on someone already assigned has to be visible on the
                row itself. The dot carries the team's own colour rather than red — it names which
                team at a glance, and the red is spent on the sentence. */}
            {assignedConflict && (
                <div className="cc-slot-conflict">
                    <span
                        className="cc-slot-conflict-dot"
                        style={{ background: resolveTeamColor(assignedConflict.teamColor) }}
                    />
                    Playing in this game for {assignedConflict.teamName}
                </div>
            )}

            {meta && (
                <div className="cc-slot-meta">
                    <span className={`cc-slot-meta-line is-${meta.tone}`}>{meta.line}</span>
                    {meta.reason !== null && (
                        <span className="cc-slot-meta-reason">&ldquo;{meta.reason}&rdquo;</span>
                    )}
                    {meta.tone === 'bad' && !meta.expired && meta.reason === null && (
                        <span className="cc-slot-meta-reason is-empty">No reason given.</span>
                    )}
                </div>
            )}

            {confirmingRemove && (
                <div className="cc-remove-confirm">
                    <div className="cc-remove-title">
                        {unnotified
                            ? `${removeName || 'They'} could not be notified`
                            : `Remove ${removeName} from ${slotDef.label}${role === 'GOALIE' ? ' net' : ''}?`}
                    </div>
                    {removeError
                        ? <div className="cc-remove-error">{removeError}</div>
                        : <div className="cc-remove-body">{removing
                            ? 'Pulling them off the game and sending the cancellation…'
                            : removeBody}</div>}
                    <div className="cc-remove-actions">
                        {unnotified ? (
                            <>
                                <button type="button" className="cc-remove-go" onClick={closeRemove}>
                                    Got It
                                </button>
                                <button
                                    type="button"
                                    className="cc-remove-alt"
                                    onClick={() => { closeRemove(); onOpenPicker(); }}
                                >
                                    Fill This Slot
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="cc-remove-go"
                                    disabled={removing}
                                    onClick={handleRemove}
                                >
                                    {removing ? 'Removing…' : removeError ? 'Try Again' : 'Remove & Send Cancellation'}
                                </button>
                                <button
                                    type="button"
                                    className="cc-remove-alt"
                                    disabled={removing}
                                    onClick={() => { closeRemove(); onOpenPicker(); }}
                                >
                                    Reassign Instead
                                </button>
                                <button
                                    type="button"
                                    className="cc-remove-keep"
                                    disabled={removing}
                                    onClick={closeRemove}
                                >
                                    Keep Them
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showSimulate && (
                <div className="cc-slot-sim">
                    <button type="button" className="cc-sim-link cc-sim-confirm" onClick={() => onSimulate('confirm')}>
                        Simulate: goalie confirms
                    </button>
                    <button type="button" className="cc-sim-link cc-sim-decline" onClick={() => onSimulate('decline')}>
                        Simulate: goalie declines
                    </button>
                </div>
            )}


            {pickerOpen && (
                <div className="cc-picker">
                    <div className="cc-picker-title">{pickerTitle}</div>
                    <div className="cc-picker-candidates">
                        {primaryCandidates.map(c => (
                            <CandidateButton key={c.id} c={c} line={rosterLine(c)} onAssign={onAssign} />
                        ))}

                        {/* Substitutes are ad hoc fill-ins — hidden until asked for. */}
                        {showSubs && substituteCandidates.map(c => (
                            <CandidateButton key={c.id} c={c} line={rosterLine(c)} onAssign={onAssign} />
                        ))}

                        {substituteCandidates.length > 0 && !showSubs && (
                            <button
                                type="button"
                                className="cc-candidate-btn cc-candidate-sub-add"
                                onClick={() => setShowSubs(true)}
                            >
                                <span className="cc-candidate-avatar cc-candidate-avatar-dashed">+</span>
                                <span>
                                    <span className="cc-candidate-name">Add a Substitute</span>
                                    <span className="cc-candidate-sub">Ad hoc fill-in for this game only</span>
                                </span>
                            </button>
                        )}
                    </div>
                    <button className="cc-picker-cancel" onClick={() => { setShowSubs(false); onClosePicker(); }}>Cancel</button>
                </div>
            )}
        </div>
    );
}

/**
 * One person in the assign picker. Only a conflict is allowed colour — unknown gets no chip, no
 * border and no icon, because it lands on most goalie rows and anything louder turns the list into
 * a wall of alarms. Conflicts stay clickable: the roster join is wrong often enough that the
 * coordinator, not the data, is the authority on her own league.
 */
function CandidateButton({ c, line, onAssign }) {
    return (
        <button
            className={`cc-candidate-btn${c.conflict && !c.unavailable ? ' is-conflict' : ''}`}
            disabled={c.unavailable}
            onClick={() => !c.unavailable && onAssign(c.id)}
        >
            <span className="cc-candidate-avatar">{initials(c.name)}</span>
            <span>
                <span className="cc-candidate-name">
                    {c.name}
                    {c.teamName && !c.unavailable && (
                        <span className={`cc-candidate-team${c.conflict ? ' is-conflict' : ''}`}>
                            <span
                                className="cc-candidate-team-dot"
                                style={{ background: resolveTeamColor(c.teamColor) }}
                            />
                            {c.teamName}
                        </span>
                    )}
                </span>
                {c.unavailable
                    ? <span className="cc-candidate-sub" style={{ color: c.subColor }}>{c.sub}</span>
                    : line?.skeleton
                        ? <span className="cc-candidate-skeleton" aria-label="Checking rosters" />
                        : <span className={`cc-candidate-sub is-${line?.tone}`}>{line?.text}</span>}
            </span>
        </button>
    );
}

function buildSlots(game, role, homeTeam, awayTeam) {
    if (role === 'GOALIE') {
        return [
            { slot: 1, label: homeTeam?.name || 'Home', teamColor: resolveTeamColor(homeTeam?.teamColor), showDot: true },
            { slot: 2, label: awayTeam?.name || 'Away', teamColor: resolveTeamColor(awayTeam?.teamColor), showDot: true },
        ];
    }
    if (role === 'REF') {
        return [
            { slot: 1, label: 'Ref 1', showDot: false },
            { slot: 2, label: 'Ref 2', showDot: false },
        ];
    }
    return [{ slot: 1, label: 'Scorekeeper', showDot: false }];
}

export default CoordinatorBoard;
