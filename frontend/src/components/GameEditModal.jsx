import { useState } from 'react';
import './GameEditModal.css';

const GameEditModal = ({ game, teams, onClose, onSave, onDelete }) => {
    const [formData, setFormData] = useState({
        homeTeamId: game?.homeTeamId || '',
        awayTeamId: game?.awayTeamId || '',
        gameDate: game?.gameDate ? new Date(game.gameDate).toISOString().slice(0, 16) : '',
        rink: game?.rink || 'Tubbs',
        week: game?.week || 1
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Convert datetime-local to ISO format
        const gameDateTime = new Date(formData.gameDate).toISOString();

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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{game?.id ? 'Edit Game' : 'Create Game'}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="game-form">
                    <div className="form-group">
                        <label>Week</label>
                        <input
                            type="number"
                            value={formData.week}
                            onChange={(e) => setFormData({ ...formData, week: e.target.value })}
                            min="1"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Date & Time</label>
                        <input
                            type="datetime-local"
                            value={formData.gameDate}
                            onChange={(e) => setFormData({ ...formData, gameDate: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Home Team</label>
                        <select
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
                        <label>Away Team</label>
                        <select
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
                        <label>Rink</label>
                        <select
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
