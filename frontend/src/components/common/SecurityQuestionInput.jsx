import { useState } from 'react';
import './SecurityQuestionInput.css';

const COMMON_QUESTIONS = [
    "What is your mother's maiden name?",
    "What was the name of your first pet?",
    "What is the name of the street you grew up on?",
    "What is your jersey number?",
    "What is your favorite sports team?",
    "What is the name of your elementary school?"
];

const SecurityQuestionInput = ({ value, onChange, disabled }) => {
    const [isCustom, setIsCustom] = useState(false);

    const handleSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'custom') {
            setIsCustom(true);
            onChange(''); // Clear value for custom input
        } else {
            setIsCustom(false);
            onChange(val);
        }
    };

    const handleCustomChange = (e) => {
        onChange(e.target.value);
    };

    return (
        <div className="security-question-input">
            <label>Security Question</label>
            {!isCustom ? (
                <select
                    value={COMMON_QUESTIONS.includes(value) ? value : 'custom'}
                    onChange={handleSelectChange}
                    disabled={disabled}
                    required
                >
                    <option value="">Select a question...</option>
                    {COMMON_QUESTIONS.map((q, i) => (
                        <option key={i} value={q}>{q}</option>
                    ))}
                    <option value="custom">Write my own...</option>
                </select>
            ) : (
                <div className="custom-question-input">
                    <input
                        type="text"
                        placeholder="Type your question..."
                        value={value}
                        onChange={handleCustomChange}
                        disabled={disabled}
                        required
                    />
                    <button
                        type="button"
                        className="btn-link"
                        onClick={() => setIsCustom(false)}
                    >
                        Back to list
                    </button>
                </div>
            )}
        </div>
    );
};

export default SecurityQuestionInput;
