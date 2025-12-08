import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <div>Loading...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignments: 'center',
                height: '100vh',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <h1>Access Denied</h1>
                <p>You do not have permission to access this page.</p>
                <p>Required role: {requiredRole}</p>
                <p>Your role: {user.role}</p>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
