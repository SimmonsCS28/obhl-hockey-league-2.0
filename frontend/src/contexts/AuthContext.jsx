import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

// Decode a JWT and report whether it's missing, malformed, or past its `exp`.
// The backend collapses expired/invalid tokens into 403s on every protected call, so
// we check expiry client-side to avoid ever presenting a stale session as "logged in".
const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        const payload = JSON.parse(
            atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        if (!payload.exp) return false; // no expiry claim — treat as non-expiring
        return payload.exp * 1000 <= Date.now();
    } catch {
        return true; // malformed token — treat as unusable
    }
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in on mount. A token whose `exp` has passed (or that is
        // malformed) would only surface as a burst of 403s on the first protected call, so
        // clear it up front instead of presenting a false "logged in" state that then boots
        // the user mid-navigation.
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');

        if (storedUser && storedToken && !isTokenExpired(storedToken)) {
            setUser(JSON.parse(storedUser));
        } else if (storedUser || storedToken) {
            // Stale/expired session — clean up silently (no alert; the user wasn't mid-action).
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        setLoading(false);

        // A single expired token makes every parallel dashboard request 403 at once, each
        // firing its own auth-error. Guard so the burst produces exactly one logout + one
        // message rather than a stack of "session expired" dialogs.
        let handlingAuthError = false;
        const handleAuthError = () => {
            if (handlingAuthError) return;
            handlingAuthError = true;

            console.warn('Authentication error detected, logging out');
            // Full cleanup
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);

            // Redirect to home/login if we're on a protected route
            // The router will handle this if we reset the user state,
            // but a hard redirect ensures a clean state.
            if (!window.location.pathname.startsWith('/login') && window.location.pathname !== '/') {
                alert('Your session has expired. Please log in again.');
                window.location.href = '/';
            } else {
                // Not redirecting (already on a public route) — release the guard so a later,
                // genuinely-new expiry can still trigger a logout.
                handlingAuthError = false;
            }
        };

        window.addEventListener('auth-error', handleAuthError);
        return () => window.removeEventListener('auth-error', handleAuthError);
    }, []);

    const login = async (usernameOrEmail, password) => {
        try {
            const response = await api.login(usernameOrEmail, password);
            const { token, user: userData, mustChangePassword, hasSecurityQuestion } = response;

            if (mustChangePassword) {
                // DON'T persist session yet. Just return the data for the Login component to handle.
                return { success: true, user: userData, token, mustChangePassword: true, hasSecurityQuestion: !!hasSecurityQuestion };
            }

            // Normal login: persist token and user info
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            return { success: true, user: userData, mustChangePassword: false };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message || 'Invalid credentials'
            };
        }
    };

    const completeLogin = (token, userData) => {
        // Finalize login after password reset
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        api.logout();
    };

    const value = {
        user,
        login,
        completeLogin,
        logout,
        loading,
        isAuthenticated: !!user,
        // Helper functions for role checking
        hasRole: (roleName) => user?.roles?.includes(roleName) || user?.role === roleName || false,
        hasAnyRole: (...roleNames) => roleNames.some(role => user?.roles?.includes(role) || user?.role === role) || false,
        hasAllRoles: (...roleNames) => roleNames.every(role => user?.roles?.includes(role) || user?.role === role) || false,

        // Backward compatibility role checks
        isAdmin: (user?.roles?.includes('ADMIN') || user?.role === 'ADMIN') || false,
        isGM: (user?.roles?.includes('GM') || user?.role === 'GM') || false,
        isReferee: (user?.roles?.includes('REFEREE') || user?.role === 'REFEREE') || false,
        isScorekeeper: (user?.roles?.includes('SCOREKEEPER') || user?.role === 'SCOREKEEPER') || false,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
