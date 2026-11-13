import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { request } from '../../../services/api';
import './MemberPolls.css';

const when = (value) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function MemberPolls() {
    const { isAdmin } = useAuth();
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const load = useCallback(async (signal) => {
        try {
            const data = await request('/polls', { signal });
            if (!signal?.aborted) { setPolls(data); setError(''); }
        } catch (e) {
            if (!signal?.aborted) setError(e.message || 'Polls could not be loaded.');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        const timer = setInterval(() => load(controller.signal), 30000);
        return () => { controller.abort(); clearInterval(timer); };
    }, [load]);
    const replace = (updated) => setPolls(current => current.map(p => p.id === updated.id ? updated : p));
    const open = polls.filter(p => !p.closed);
    const closed = polls.filter(p => p.closed);
    return <section id="polls" className="huddle" aria-labelledby="huddle-title">
        <div className="obi-container">
            <div className="huddle-head">
                <div><div className="huddle-eyebrow">The Huddle · League polls</div>
                    <h2 id="huddle-title">Have your say.</h2>
                    <p>Big plans. Quick votes. Help shape what happens off the ice.</p></div>
                {isAdmin && <button className="huddle-button" onClick={() => setCreating(v => !v)} aria-expanded={creating}>
                    {creating ? 'Cancel new poll' : '+ Create a poll'}</button>}
            </div>
            {creating && <CreatePoll onCreated={poll => { setPolls(current => [poll, ...current]); setCreating(false); }} />}
            <p className="huddle-note">Members only · One vote per account · Change your vote until voting closes</p>
            {error && <div className="huddle-error" role="alert">{error} <button onClick={() => load()}>Try again</button></div>}
            {loading ? <p role="status">Getting the latest polls…</p> : <>
                {!open.length && !error && <div className="huddle-empty"><strong>You’re all caught up.</strong>
                    <p>{isAdmin ? 'Create a poll to get the league talking.' : 'New league polls will appear here. Check back before your next game.'}</p></div>}
                <div className="huddle-grid">{open.map(p => <PollCard key={p.id} poll={p} isAdmin={isAdmin} onUpdate={replace} onRefresh={load} />)}</div>
                {!!closed.length && <details className="huddle-archive"><summary>Final results <span>{closed.length}</span></summary>
                    <div className="huddle-grid">{closed.map(p => <PollCard key={p.id} poll={p} isAdmin={isAdmin} onUpdate={replace} onRefresh={load} />)}</div>
                </details>}
            </>}
        </div>
    </section>;
}

function PollCard({ poll, isAdmin, onUpdate, onRefresh }) {
    const [selection, setSelection] = useState(null);
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [confirmClose, setConfirmClose] = useState(false);
    const chosen = selection ?? poll.myOptionId;
    const results = poll.closed || (poll.myOptionId != null && !editing);
    const act = async (action) => {
        setBusy(true); setError(''); setNotice('');
        try {
            const updated = await request(`/polls/${poll.id}/${action}`, action === 'vote'
                ? { method: 'PUT', body: JSON.stringify({ optionId: chosen }) } : { method: 'POST' });
            onUpdate(updated); setSelection(null); setEditing(false); setConfirmClose(false);
            setNotice(action === 'vote' ? 'Your vote is saved.' : 'Voting is closed.');
        } catch (e) {
            setError(e.message || 'That did not save. Please try again.');
            onRefresh();
        } finally { setBusy(false); }
    };
    return <article className="huddle-card" aria-labelledby={`poll-${poll.id}`}>
        <div className="huddle-card-meta"><span className={`huddle-badge ${poll.closed ? 'is-closed' : ''}`}>
            {poll.closed ? 'Final results' : poll.myOptionId != null ? 'You voted' : 'Open for votes'}</span>
            {poll.closesAt && <span>{poll.closed ? 'Scheduled close' : 'Closes'} {when(poll.closesAt)}</span>}</div>
        <h3 id={`poll-${poll.id}`}>{poll.question}</h3>
        {poll.description && <p className="huddle-description">{poll.description}</p>}
        {results ? <div className="huddle-results" aria-label="Poll results">{poll.options.map(option => {
            const percent = poll.totalVotes ? Math.round(option.votes / poll.totalVotes * 100) : 0;
            return <div key={option.id} className={`huddle-result ${poll.myOptionId === option.id ? 'is-mine' : ''}`}>
                <div className="huddle-result-label"><span>{option.label} {poll.myOptionId === option.id && <small>Your vote</small>}</span>
                    <b>{percent}% <small>({option.votes})</small></b></div>
                <div className="huddle-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
            </div>;
        })}</div> : <fieldset className="huddle-choices" disabled={busy}>
            <legend>Choose one option</legend>
            {poll.options.map(option => <label key={option.id} className={chosen === option.id ? 'is-selected' : ''}>
                <input type="radio" name={`poll-${poll.id}`} value={option.id} checked={chosen === option.id}
                    onChange={() => { setSelection(option.id); setNotice(''); }} /><span>{option.label}</span>
            </label>)}
        </fieldset>}
        <div className="huddle-card-foot"><span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'} cast</span>
            {!poll.closed && (results ? <button className="huddle-link" onClick={() => setEditing(true)}>Change my vote</button>
                : <button className="huddle-button" disabled={busy || chosen == null || (editing && chosen === poll.myOptionId)}
                    onClick={() => act('vote')}>{busy ? 'Saving…' : editing ? 'Save my change' : 'Cast my vote'}</button>)}
        </div>
        {editing && !poll.closed && <button className="huddle-link" disabled={busy} onClick={() => { setEditing(false); setSelection(null); }}>Keep my current vote</button>}
        {notice && <p className="huddle-success" role="status">{notice}</p>}
        {error && <p className="huddle-error" role="alert">{error}</p>}
        {isAdmin && !poll.closed && <div className="huddle-admin">
            {confirmClose ? <><p>Close voting now? Members will still see the final results.</p><div className="huddle-actions">
                <button className="huddle-button" disabled={busy} onClick={() => act('close')}>Close voting</button>
                <button className="huddle-link" disabled={busy} onClick={() => setConfirmClose(false)}>Keep open</button></div></>
                : <button className="huddle-link" onClick={() => setConfirmClose(true)}>Close this poll</button>}
        </div>}
    </article>;
}

function CreatePoll({ onCreated }) {
    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [choices, setChoices] = useState(['', '']);
    const [closesAt, setClosesAt] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            const poll = await request('/polls', { method: 'POST', body: JSON.stringify({ question, description,
                options: choices, closesAt: closesAt ? new Date(closesAt).toISOString() : null }) });
            onCreated(poll);
        } catch (e) { setError(e.message || 'Could not create this poll.'); }
        finally { setBusy(false); }
    };
    return <form className="huddle-create" onSubmit={submit}>
        <h3>Put it to the league.</h3>
        <p>Publish a single-choice poll for every signed-in member. Choices stay fixed after publishing.</p>
        <fieldset disabled={busy}>
            <label>Question<input required maxLength={180} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Where should we celebrate the season?" /></label>
            <label>A little context <span>(optional)</span><textarea maxLength={1000} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
            <div className="huddle-create-choices">{choices.map((choice, i) => <div key={i}>
                <label>Choice {i + 1}<input required maxLength={120} value={choice} onChange={e => setChoices(current => current.map((c, n) => n === i ? e.target.value : c))} /></label>
                {choices.length > 2 && <button type="button" className="huddle-link" aria-label={`Remove choice ${i + 1}`} onClick={() => setChoices(current => current.filter((_, n) => n !== i))}>Remove</button>}
            </div>)}</div>
            {choices.length < 8 && <button type="button" className="huddle-link" onClick={() => setChoices(current => [...current, ''])}>+ Add a choice</button>}
            <label>Voting closes <span>(optional, your local time)</span><input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} /></label>
            <p className="huddle-note">Leave blank to close it yourself when everyone has had a say.</p>
            <button className="huddle-button" type="submit">{busy ? 'Publishing…' : 'Publish poll'}</button>
        </fieldset>
        {error && <p className="huddle-error" role="alert">{error}</p>}
    </form>;
}
