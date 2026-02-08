import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../services/api';

// Google OAuth implementation with backend integration

export interface User {
    id: string;
    email: string;
    displayName: string;
    avatar: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    loginWithGoogle: (idToken: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

const TOKEN_KEY = 'nova_sketch_token';
const SESSION_KEY = 'nova_sketch_session';

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize session on mount
    useEffect(() => {
        const initAuth = async () => {
            try {
                const savedSession = localStorage.getItem(SESSION_KEY);
                const token = localStorage.getItem(TOKEN_KEY);

                if (savedSession && token) {
                    const parsed = JSON.parse(savedSession);
                    setUser(parsed);
                }
            } catch (e) {
                console.error('Session restoration failed:', e);
                localStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(TOKEN_KEY);
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();
    }, []);

    // TODO: Implement in next subtask
    const loginWithGoogle = async (idToken: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // Will be implemented in next commit
            console.log('loginWithGoogle called with token:', idToken);
        } catch (err: any) {
            setError(err.message || 'Google login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                error,
                loginWithGoogle,
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
