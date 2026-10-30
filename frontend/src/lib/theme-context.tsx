'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = 'hireassess-theme';
const THEME_PREFERENCE_SET_KEY = 'hireassess-theme-preference-set';

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>('light');
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  // Use light mode by default; only retain dark mode when the user explicitly selected it.
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    const preferenceWasSet = localStorage.getItem(THEME_PREFERENCE_SET_KEY) === 'true';
    if (preferenceWasSet && (stored === 'light' || stored === 'dark')) {
      // Apply an explicit browser preference after hydration to keep server output light by default.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored);
    }
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark'
    );

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [preferenceLoaded, theme]);

  const toggleTheme = () => {
    if (!preferenceLoaded) return;
    localStorage.setItem(THEME_PREFERENCE_SET_KEY, 'true');
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}