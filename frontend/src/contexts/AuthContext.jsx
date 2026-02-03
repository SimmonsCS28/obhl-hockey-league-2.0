import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

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
        // Check if user is logged in on mount
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');

        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (usernameOrEmail, password) => {
        try {
            const response = await api.login(usernameOrEmail, password);
            const { token, user: userData, mustChangePassword } = response;

            // Store token and user info
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            return { success: true, user: userData, mustChangePassword };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Invalid credentials'
            };
        }
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
