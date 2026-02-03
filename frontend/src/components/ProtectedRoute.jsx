import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole, requiredRoles = [] }) => {
    const { user, loading, hasAnyRole } = useAuth();

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
        return <Navigate to="/" replace />;
    }

    // Check single role (backward compatibility)
    if (requiredRole && !hasAnyRole(requiredRole)) {
        return <AccessDenied requiredRole={requiredRole} userRoles={user.roles || [user.role]} />;
    }

    // Check multiple roles
    if (requiredRoles.length > 0 && !hasAnyRole(...requiredRoles)) {
        return <AccessDenied requiredRole={requiredRoles.join(' or ')} userRoles={user.roles || [user.role]} />;
    }

    return children;
};

const AccessDenied = ({ requiredRole, userRoles }) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        textAlign: 'center',
        padding: '2rem'
    }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <p>Required role: {requiredRole}</p>
        <p>Your roles: {Array.isArray(userRoles) ? userRoles.join(', ') : userRoles}</p>
    </div>
);

export default ProtectedRoute;
