import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../services/api';

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
    loginWithGoogle: (code: string) => Promise<void>;
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

    const loginWithGoogle = async (code: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // exchanging auth code for JWT.
            // backend validates code with Google, we just forward it.
            const response = await api.post('/auth/google', { code });
            const { token, user: userData } = response.data;

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(SESSION_KEY, JSON.stringify(userData));

            setUser(userData);
        } catch (err: any) {
            // generic error handler, backend messages might not always be user-friendly
            const message = err.response?.data?.error || err.message || 'Google login failed';
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
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
