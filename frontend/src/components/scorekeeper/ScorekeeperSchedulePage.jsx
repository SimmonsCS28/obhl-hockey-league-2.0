import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ScorekeeperSchedulePage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Redirect to the modern Shift Signup page
        navigate('/user/scorekeeper');
    }, [navigate]);

    return (
        <div style={{ padding: '2rem', color: 'white', textAlign: 'center' }}>
            <p>Redirecting to Scorekeeper Dashboard...</p>
        </div>
    );
};

export default ScorekeeperSchedulePage;
