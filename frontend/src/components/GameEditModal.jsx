import { useState } from 'react';
import { toCentralInputParts, fromCentralInputParts } from '../utils/gameTime';
import './GameEditModal.css';

const GameEditModal = ({ game, teams, onClose, onSave, onDelete, onRevertToScheduled }) => {
    // The datetime-local input is edited in Central, whatever zone the admin's laptop is in.
    const toCentralDateTimeString = (utcDateString) => {
        if (!utcDateString) return '';
        const { date, time } = toCentralInputParts(utcDateString);
        return `${date}T${time}`;
    };

    const [formData, setFormData] = useState({
        homeTeamId: game?.homeTeamId || '',
        awayTeamId: game?.awayTeamId || '',
        gameDate: toCentralDateTimeString(game?.gameDate),
        rink: game?.rink || 'Tubbs',
        week: game?.week || 1
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Central wall clock -> UTC ISO without 'Z', which is what the game-service stores.
        const [datePart, timePart] = formData.gameDate.split('T');
        const gameDateTime = fromCentralInputParts(datePart, timePart);

        const gameData = {
            ...formData,
            gameDate: gameDateTime,
            homeTeamId: parseInt(formData.homeTeamId),
            awayTeamId: parseInt(formData.awayTeamId),
            week: parseInt(formData.week)
        };

        onSave(gameData);
    };

    const handleDelete = () => {
        const confirmed = window.confirm(
            '⚠️ Are you sure you want to delete this game?\n\nThis action cannot be undone.'
        );

        if (confirmed && onDelete) {
            onDelete(game.id);
        }
    };

    const handleRevertToScheduled = () => {
        const confirmed = window.confirm(
            'Revert this game\'s status from In Progress to Scheduled?\n\nScores and logged events will be left as-is.'
        );

        if (confirmed && onRevertToScheduled) {
            onRevertToScheduled(game.id);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{game?.id ? 'Edit Game' : 'Create Game'}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="game-form">
                    <div className="form-group">
                        <label htmlFor="week">Week</label>
                        <input
                            id="week"
                            name="week"
                            type="number"
                            value={formData.week}
                            onChange={(e) => setFormData({ ...formData, week: e.target.value })}
                            min="1"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="gameDate">Date & Time</label>
                        <input
                            id="gameDate"
                            name="gameDate"
                            type="datetime-local"
                            value={formData.gameDate}
                            onChange={(e) => setFormData({ ...formData, gameDate: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="homeTeamId">Home Team</label>
                        <select
                            id="homeTeamId"
                            name="homeTeamId"
                            value={formData.homeTeamId}
                            onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                            required
                        >
                            <option value="">Select team...</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="awayTeamId">Away Team</label>
                        <select
                            id="awayTeamId"
                            name="awayTeamId"
                            value={formData.awayTeamId}
                            onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                            required
                        >
                            <option value="">Select team...</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="rink">Rink</label>
                        <select
                            id="rink"
                            name="rink"
                            value={formData.rink}
                            onChange={(e) => setFormData({ ...formData, rink: e.target.value })}
                            required
                        >
                            <option value="Tubbs">Tubbs</option>
                            <option value="Cardinal">Cardinal</option>
                        </select>
                    </div>

                    <div className="modal-actions">
                        {game?.id && onDelete && (
                            <button type="button" onClick={handleDelete} className="btn-danger" style={{ marginRight: 'auto' }}>
                                🗑️ Delete Game
                            </button>
                        )}
                        {game?.id && game?.status === 'in_progress' && onRevertToScheduled && (
                            <button type="button" onClick={handleRevertToScheduled} className="btn-secondary">
                                ↩ Revert to Scheduled
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary">
                            {game?.id ? 'Save Changes' : 'Create Game'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GameEditModal;
