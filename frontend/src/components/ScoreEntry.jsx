import { useState } from 'react';
import api from '../services/api';
import './ScoreEntry.css';

function ScoreEntry({ game, onBack, onScoreUpdated }) {
    const [homeScore, setHomeScore] = useState(game?.homeScore || 0);
    const [awayScore, setAwayScore] = useState(game?.awayScore || 0);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    if (!game) {
        return (
            <div className="score-entry">
                <div className="info-message">
                    Select a game from the schedule to enter scores
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            setMessage(null);

            await api.updateGameScore(game.id, homeScore, awayScore);

            setMessage({ type: 'success', text: 'Score updated successfully!' });

            if (onScoreUpdated) {
                onScoreUpdated();
            }

            setTimeout(() => {
                onBack();
            }, 1500);

        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update score. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="score-entry">
            <div className="score-entry-header">
                <h2>Score Entry</h2>
                <button className="btn-back" onClick={onBack}>
                    ← Back to Schedule
                </button>
            </div>

            <div className="game-info">
                <div className="game-info-header">
                    <span className="game-date">
                        {new Date(game.gameDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        })}
                    </span>
                    <span className={`game-status ${game.status}`}>
                        {game.status.replace('_', ' ')}
                    </span>
                </div>
                {game.venue && <div className="venue">📍 {game.venue}</div>}
            </div>

            {message && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="score-form">
                <div className="score-inputs">
                    <div className="team-score-input">
                        <label>{game.homeTeamName} (Home)</label>
                        <input
                            type="number"
                            min="0"
                            value={homeScore}
                            onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            required
                        />
                    </div>

                    <div className="vs-divider">VS</div>

                    <div className="team-score-input">
                        <label>{game.awayTeamName} (Away)</label>
                        <input
                            type="number"
                            min="0"
                            value={awayScore}
                            onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            required
                        />
                    </div>
                </div>

                <div className="score-display">
                    <div className="current-score">
                        <span className="score-label">Current Score:</span>
                        <span className="score-value">{homeScore} - {awayScore}</span>
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn-submit"
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Update Score'}
                </button>
            </form>

            <div className="info-box">
                <h3>ℹ️ Scorekeeper Notes</h3>
                <ul>
                    <li>Enter the final score for each team</li>
                    <li>Scores will automatically update team standings</li>
                    <li>Goal limit validation coming soon</li>
                </ul>
            </div>
        </div>
    );
}

export default ScoreEntry;
