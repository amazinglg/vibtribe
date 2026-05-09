import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5';

export interface AppTheme {
  id: ThemeId;
  name: string;
  description: string;
  preview: string[];
  vars: Record<string, string>;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'theme-1',
    name: 'Dark Violet',
    description: 'Default dark theme with vibrant violet accents',
    preview: ['#0a0a0f', '#7c3aed', '#06b6d4', '#ec4899'],
    vars: {
      '--background': '#0a0a0f',
      '--foreground': '#f0f0ff',
      '--primary': '#7c3aed',
      '--primary-foreground': '#ffffff',
      '--secondary': '#1a1a2e',
      '--secondary-foreground': '#a0a0c0',
      '--accent': '#06b6d4',
      '--accent-foreground': '#ffffff',
      '--muted': '#16162a',
      '--muted-foreground': '#6b6b9a',
      '--card': '#12121f',
      '--card-foreground': '#f0f0ff',
      '--border': '#2a2a45',
      '--input': '#1e1e35',
      '--ring': '#7c3aed',
      '--pink': '#ec4899',
      '--cyan': '#06b6d4',
      '--violet': '#7c3aed',
      '--green': '#22c55e',
      '--amber': '#f59e0b',
      '--red': '#ef4444',
    },
  },
  {
    id: 'theme-2',
    name: 'Clean Light',
    description: 'Bright and clean light theme for daytime use',
    preview: ['#f8f9fc', '#6366f1', '#0ea5e9', '#f43f5e'],
    vars: {
      '--background': '#f8f9fc',
      '--foreground': '#0f172a',
      '--primary': '#6366f1',
      '--primary-foreground': '#ffffff',
      '--secondary': '#e2e8f0',
      '--secondary-foreground': '#475569',
      '--accent': '#0ea5e9',
      '--accent-foreground': '#ffffff',
      '--muted': '#e8edf5',
      '--muted-foreground': '#64748b',
      '--card': '#ffffff',
      '--card-foreground': '#0f172a',
      '--border': '#cbd5e1',
      '--input': '#f1f5f9',
      '--ring': '#6366f1',
      '--pink': '#f43f5e',
      '--cyan': '#0ea5e9',
      '--violet': '#6366f1',
      '--green': '#16a34a',
      '--amber': '#d97706',
      '--red': '#dc2626',
    },
  },
  {
    id: 'theme-3',
    name: 'Neon Vibrant',
    description: 'Bold neon colors for maximum energy',
    preview: ['#050510', '#ff0080', '#00ffcc', '#ffcc00'],
    vars: {
      '--background': '#050510',
      '--foreground': '#ffffff',
      '--primary': '#ff0080',
      '--primary-foreground': '#ffffff',
      '--secondary': '#0d0d25',
      '--secondary-foreground': '#c0c0e0',
      '--accent': '#00ffcc',
      '--accent-foreground': '#000000',
      '--muted': '#0a0a20',
      '--muted-foreground': '#7070a0',
      '--card': '#0a0a1e',
      '--card-foreground': '#ffffff',
      '--border': '#1a1a40',
      '--input': '#10102a',
      '--ring': '#ff0080',
      '--pink': '#ff0080',
      '--cyan': '#00ffcc',
      '--violet': '#9900ff',
      '--green': '#00ff88',
      '--amber': '#ffcc00',
      '--red': '#ff3333',
    },
  },
  {
    id: 'theme-4',
    name: 'Forest Green',
    description: 'Calm earthy tones with deep forest greens',
    preview: ['#0d1a0f', '#22c55e', '#84cc16', '#f59e0b'],
    vars: {
      '--background': '#0d1a0f',
      '--foreground': '#ecfdf5',
      '--primary': '#22c55e',
      '--primary-foreground': '#ffffff',
      '--secondary': '#14291a',
      '--secondary-foreground': '#86efac',
      '--accent': '#84cc16',
      '--accent-foreground': '#ffffff',
      '--muted': '#162b1a',
      '--muted-foreground': '#4ade80',
      '--card': '#111f14',
      '--card-foreground': '#ecfdf5',
      '--border': '#1e3a22',
      '--input': '#182c1c',
      '--ring': '#22c55e',
      '--pink': '#f472b6',
      '--cyan': '#34d399',
      '--violet': '#a78bfa',
      '--green': '#22c55e',
      '--amber': '#f59e0b',
      '--red': '#ef4444',
    },
  },
  {
    id: 'theme-5',
    name: 'Ocean Midnight',
    description: 'Deep ocean blues with teal accents',
    preview: ['#020c1b', '#0ea5e9', '#38bdf8', '#818cf8'],
    vars: {
      '--background': '#020c1b',
      '--foreground': '#e0f2fe',
      '--primary': '#0ea5e9',
      '--primary-foreground': '#ffffff',
      '--secondary': '#0c1f35',
      '--secondary-foreground': '#7dd3fc',
      '--accent': '#38bdf8',
      '--accent-foreground': '#ffffff',
      '--muted': '#0a1929',
      '--muted-foreground': '#4b8db8',
      '--card': '#071525',
      '--card-foreground': '#e0f2fe',
      '--border': '#0f2d4a',
      '--input': '#0d2038',
      '--ring': '#0ea5e9',
      '--pink': '#f472b6',
      '--cyan': '#38bdf8',
      '--violet': '#818cf8',
      '--green': '#34d399',
      '--amber': '#fbbf24',
      '--red': '#f87171',
    },
  },
];

const THEME_STORAGE_KEY = 'vibetribe-theme';

interface ThemeContextValue {
  currentTheme: AppTheme;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: APP_THEMES[0],
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(APP_THEMES[0]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (saved) {
      const found = APP_THEMES.find(t => t.id === saved);
      if (found) {
        setCurrentTheme(found);
        applyTheme(found);
      }
    }
  }, []);

  const applyTheme = (theme: AppTheme) => {
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const setTheme = (id: ThemeId) => {
    const found = APP_THEMES.find(t => t.id === id);
    if (!found) return;
    setCurrentTheme(found);
    applyTheme(found);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
