import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Enhanced User interface with Role and ID
export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    provider: 'google' | 'github' | 'guest';
    role: 'admin' | 'editor' | 'viewer';
    lastLogin: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    loginWithGoogle: () => Promise<void>;
    loginWithGithub: () => Promise<void>;
    loginAsGuest: () => Promise<void>; // Added Guest Mode
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

const STORAGE_KEY = 'nova_sketch_session';

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Persist user to state
    const saveSession = (userData: User) => {
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    };

    // Simulated API Call Helper
    const mockAuthCall = async (provider: User['provider']): Promise<User> => {
        await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate network latency
        
        // Randomize ID for "realism" in demos
        const randomId = Math.random().toString(36).substring(2, 9);
        
        if (Math.random() > 0.95) {
             throw new Error(`${provider} authentication service unavailable.`);
        }

        return {
            id: `usr_${randomId}`,
            name: provider === 'guest' ? 'Guest User' : 'Karthik Kirla',
            email: provider === 'guest' ? 'guest@novasketch.app' : 'karthik@example.com',
            avatar: `https://ui-avatars.com/api/?name=${provider === 'guest' ? 'Guest' : 'Karthik+Kirla'}&background=${provider === 'guest' ? '607383' : '2dd4bf'}&color=fff`,
            provider,
            role: provider === 'guest' ? 'viewer' : 'editor',
            lastLogin: new Date().toISOString(),
        };
    };

    // Initialize Session
    useEffect(() => {
        const initAuth = async () => {
            try {
                const savedSession = localStorage.getItem(STORAGE_KEY);
                if (savedSession) {
                    setUser(JSON.parse(savedSession));
                }
            } catch (e) {
                console.error('Session restoration failed', e);
                localStorage.removeItem(STORAGE_KEY);
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
            const user = await mockAuthCall('google');
            saveSession(user);
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
            const user = await mockAuthCall('github');
            saveSession(user);
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
            const user = await mockAuthCall('guest');
            saveSession(user);
        } catch (err: any) {
            setError('Guest login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        // Optional: Redirect to landing here if not handled by ProtectedRoute
    }, []);

    const clearError = () => setError(null);

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