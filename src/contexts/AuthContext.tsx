import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../services/api';

export interface User {
    id: string;
    email: string;
    displayName: string;
    avatar: string;
    authProvider?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    loginWithGoogle: (code: string) => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
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

// TODO: move these to env or constants file to avoid magic strings scattered everywhere
const TOKEN_KEY = 'nova_sketch_token';
const SESSION_KEY = 'nova_sketch_session';

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // attempt to hydrate session from local storage.
    // insecure storage mechanism (vulnerable to XSS), but sufficient for MVP.
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
                // session corrupted or invalid, nuking it to be safe
                console.error('Session restoration failed:', e);
                localStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(TOKEN_KEY);
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();
    }, []);

    // Shared handler for saving auth response
    const handleAuthSuccess = (token: string, userData: User) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        setUser(userData);
    };

    const loginWithGoogle = async (code: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // exchanging auth code for JWT.
            // backend validates code with Google, we just forward it.
            const response = await api.post('/auth/google', { code });
            const { token, user: userData } = response.data;
            handleAuthSuccess(token, userData);
        } catch (err: any) {
            // generic error handler, backend messages might not always be user-friendly
            const message = err.response?.data?.error || err.message || 'Google login failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithEmail = async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user: userData } = response.data;
            handleAuthSuccess(token, userData);
        } catch (err: any) {
            const message = err.response?.data?.error || err.message || 'Login failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post('/auth/register', { name, email, password });
            const { token, user: userData } = response.data;
            handleAuthSuccess(token, userData);
        } catch (err: any) {
            const message = err.response?.data?.error || err.message || 'Registration failed';
            setError(message);
            throw err;
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
                loginWithEmail,
                register,
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
