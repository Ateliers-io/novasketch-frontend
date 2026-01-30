/**
 * AuthContext - Manages authentication state throughout the application
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// User interface matching OAuth provider response
export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    provider: 'google' | 'github';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    loginWithGoogle: () => Promise<void>;
    loginWithGithub: () => Promise<void>;
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

    // Check for existing session on mount (simulated)
    useEffect(() => {
        const checkSession = async () => {
            try {
                const savedUser = localStorage.getItem('nova_sketch_user');
                if (savedUser) {
                    setUser(JSON.parse(savedUser));
                }
            } catch (e) {
                console.error('Session check failed:', e);
            } finally {
                setIsLoading(false);
            }
        };
        setTimeout(checkSession, 500);
    }, []);

    // Simulated OAuth login - Google
    const loginWithGoogle = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const mockUser: User = {
                id: 'user_' + Math.random().toString(36).substr(2, 9),
                name: 'Karthik Kirla',
                email: 'karthik@example.com',
                avatar: 'https://ui-avatars.com/api/?name=Karthik+Kirla&background=4285f4&color=fff',
                provider: 'google',
            };
            localStorage.setItem('nova_sketch_user', JSON.stringify(mockUser));
            setUser(mockUser);
        } catch (e) {
            setError('Failed to authenticate with Google.');
        } finally {
            setIsLoading(false);
        }
    };

    // Simulated OAuth login - GitHub
    const loginWithGithub = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const mockUser: User = {
                id: 'user_' + Math.random().toString(36).substr(2, 9),
                name: 'Karthik Kirla',
                email: 'karthik@github.com',
                avatar: 'https://ui-avatars.com/api/?name=Karthik+Kirla&background=24292e&color=fff',
                provider: 'github',
            };
            localStorage.setItem('nova_sketch_user', JSON.stringify(mockUser));
            setUser(mockUser);
        } catch (e) {
            setError('Failed to authenticate with GitHub.');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('nova_sketch_user');
        setUser(null);
    };

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
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
