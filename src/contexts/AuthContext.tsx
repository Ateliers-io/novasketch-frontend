import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../db/schema';
import * as sessionService from '../services/session.service';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION CONTEXT - NovaSketch
// Integrated with IndexedDB for session persistence
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    loginWithGoogle: () => Promise<void>;
    loginWithGithub: () => Promise<void>;
    loginAsGuest: () => Promise<void>;
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

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Persist user session to IndexedDB
    const saveSession = useCallback(async (userData: User) => {
        setUser(userData);
        await sessionService.saveSession({
            id: 'current',
            user: userData,
            updatedAt: new Date().toISOString()
        });
    }, []);

    // Simulated OAuth API Call
    const mockAuthCall = async (provider: User['provider']): Promise<User> => {
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (Math.random() > 0.99) { // Reduced failure rate for better DX
            throw new Error(`Connection to ${provider} service timed out.`);
        }

        const randomId = Math.random().toString(36).substring(2, 9);

        const profiles: Record<User['provider'], Partial<User>> = {
            google: {
                name: 'Karthik Kirla',
                email: 'karthik@example.com',
                avatar: 'https://ui-avatars.com/api/?name=Karthik+Kirla&background=DB4437&color=fff&bold=true',
                role: 'editor'
            },
            github: {
                name: 'Dev Engineer',
                email: 'dev@github.com',
                avatar: 'https://ui-avatars.com/api/?name=Dev+Engineer&background=24292e&color=fff&bold=true',
                role: 'editor'
            },
            guest: {
                name: 'Guest User',
                email: 'guest@novasketch.app',
                avatar: 'https://ui-avatars.com/api/?name=Guest&background=45A29E&color=fff',
                role: 'viewer'
            }
        };

        return {
            id: `${provider}_${randomId}`,
            provider,
            lastLogin: new Date().toISOString(),
            ...profiles[provider]
        } as User;
    };

    // Initialize session on mount using IndexedDB
    useEffect(() => {
        const initAuth = async () => {
            try {
                const session = await sessionService.getSession();
                if (session && session.user) {
                    setUser(session.user);
                }
            } catch (e) {
                console.error('Session restoration failed:', e);
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();
    }, []);

    const loginWithGoogle = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const userData = await mockAuthCall('google');
            await saveSession(userData);
        } catch (err: any) {
            setError(err.message || 'Google login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithGithub = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const userData = await mockAuthCall('github');
            await saveSession(userData);
        } catch (err: any) {
            setError(err.message || 'GitHub login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const loginAsGuest = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const userData = await mockAuthCall('guest');
            await saveSession(userData);
        } catch (err: any) {
            setError(err.message || 'Guest login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = useCallback(async () => {
        await sessionService.clearSession();
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
                loginWithGithub,
                loginAsGuest,
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;