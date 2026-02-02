import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Added 'system' to allow OS-level syncing
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark'; // The actual theme being applied
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

const STORAGE_KEY = 'nova_sketch_theme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    // 1. Initialize State
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark'; // Default to Graphite (Dark)
        }
        return 'dark';
    });

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

    // 2. Handle Theme Application
    useEffect(() => {
        const root = window.document.documentElement;
        
        // Remove old classes
        root.classList.remove('light', 'dark');
        
        // Determine actual theme
        let targetTheme: 'light' | 'dark';

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            targetTheme = systemTheme;
        } else {
            targetTheme = theme;
        }

        // Update state and DOM
        setResolvedTheme(targetTheme);
        root.classList.add(targetTheme);
        root.setAttribute('data-theme', targetTheme);
        
        // Persist
        localStorage.setItem(STORAGE_KEY, theme);

    }, [theme]);

    // 3. Listen for System Changes (Only active if theme === 'system')
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const root = window.document.documentElement;
            const newSystemTheme = mediaQuery.matches ? 'dark' : 'light';
            
            root.classList.remove('light', 'dark');
            root.classList.add(newSystemTheme);
            root.setAttribute('data-theme', newSystemTheme);
            setResolvedTheme(newSystemTheme);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const setTheme = (newTheme: Theme) => setThemeState(newTheme);

    const toggleTheme = () => {
        setThemeState(prev => {
            // If system, we cycle to explicit choices. 
            // Cycle: Dark -> Light -> System -> Dark
            if (prev === 'system') return 'dark';
            if (prev === 'dark') return 'light';
            return 'system';
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;