/**
 * ThemeContext - Manages light/dark mode toggle
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('nova_sketch_theme') as Theme;
        if (saved) return saved;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('nova_sketch_theme', theme);
        document.documentElement.classList.add('theme-transition');
        const timeout = setTimeout(() => document.documentElement.classList.remove('theme-transition'), 300);
        return () => clearTimeout(timeout);
    }, [theme]);

    const toggleTheme = () => setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    const setTheme = (newTheme: Theme) => setThemeState(newTheme);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
