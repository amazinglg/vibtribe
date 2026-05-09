import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId =
  | 'theme-1'
  | 'theme-2'
  | 'theme-3'
  | 'theme-4'
  | 'theme-5'
  | 'theme-6'
  | 'theme-7'
  | 'theme-8';

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
      '--glass-bg': 'rgba(18,18,31,0.7)',
      '--glass-strong-bg': 'rgba(18,18,31,0.92)',
      '--glass-border': 'rgba(255,255,255,0.06)',
      '--glass-border-strong': 'rgba(255,255,255,0.08)',
    },
  },
  {
    id: 'theme-2',
    name: 'Clean Light',
    description: 'Bright, crisp light theme for daytime use',
    preview: ['#ffffff', '#6366f1', '#0ea5e9', '#f43f5e'],
    vars: {
      '--background': '#f6f7fb',
      '--foreground': '#0f172a',
      '--primary': '#6366f1',
      '--primary-foreground': '#ffffff',
      '--secondary': '#eef2f7',
      '--secondary-foreground': '#334155',
      '--accent': '#0ea5e9',
      '--accent-foreground': '#ffffff',
      '--muted': '#eef2f7',
      '--muted-foreground': '#475569',
      '--card': '#ffffff',
      '--card-foreground': '#0f172a',
      '--border': '#d6dde8',
      '--input': '#ffffff',
      '--ring': '#6366f1',
      '--pink': '#f43f5e',
      '--cyan': '#0ea5e9',
      '--violet': '#6366f1',
      '--green': '#16a34a',
      '--amber': '#d97706',
      '--red': '#dc2626',
      '--glass-bg': 'rgba(255,255,255,0.75)',
      '--glass-strong-bg': 'rgba(255,255,255,0.95)',
      '--glass-border': 'rgba(15,23,42,0.08)',
      '--glass-border-strong': 'rgba(15,23,42,0.12)',
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
      '--glass-bg': 'rgba(10,10,30,0.7)',
      '--glass-strong-bg': 'rgba(10,10,30,0.92)',
      '--glass-border': 'rgba(255,0,128,0.12)',
      '--glass-border-strong': 'rgba(255,0,128,0.18)',
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
      '--glass-bg': 'rgba(17,31,20,0.7)',
      '--glass-strong-bg': 'rgba(17,31,20,0.92)',
      '--glass-border': 'rgba(255,255,255,0.06)',
      '--glass-border-strong': 'rgba(255,255,255,0.08)',
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
      '--glass-bg': 'rgba(7,21,37,0.7)',
      '--glass-strong-bg': 'rgba(7,21,37,0.92)',
      '--glass-border': 'rgba(255,255,255,0.06)',
      '--glass-border-strong': 'rgba(255,255,255,0.08)',
    },
  },
  {
    id: 'theme-6',
    name: 'Pearl Light',
    description: 'Soft pearl light theme with rose accents',
    preview: ['#fdfcff', '#ec4899', '#8b5cf6', '#06b6d4'],
    vars: {
      '--background': '#fdfcff',
      '--foreground': '#1e1b2e',
      '--primary': '#ec4899',
      '--primary-foreground': '#ffffff',
      '--secondary': '#f3eef7',
      '--secondary-foreground': '#4c1d95',
      '--accent': '#8b5cf6',
      '--accent-foreground': '#ffffff',
      '--muted': '#f3eef7',
      '--muted-foreground': '#6b5b8a',
      '--card': '#ffffff',
      '--card-foreground': '#1e1b2e',
      '--border': '#e4dcef',
      '--input': '#ffffff',
      '--ring': '#ec4899',
      '--pink': '#ec4899',
      '--cyan': '#06b6d4',
      '--violet': '#8b5cf6',
      '--green': '#16a34a',
      '--amber': '#d97706',
      '--red': '#dc2626',
      '--glass-bg': 'rgba(255,255,255,0.78)',
      '--glass-strong-bg': 'rgba(255,255,255,0.96)',
      '--glass-border': 'rgba(76,29,149,0.08)',
      '--glass-border-strong': 'rgba(76,29,149,0.14)',
    },
  },
  {
    id: 'theme-7',
    name: 'Warm Sand',
    description: 'Warm light theme with amber and terracotta tones',
    preview: ['#fdfaf3', '#ea580c', '#f59e0b', '#0d9488'],
    vars: {
      '--background': '#fdfaf3',
      '--foreground': '#1c1917',
      '--primary': '#ea580c',
      '--primary-foreground': '#ffffff',
      '--secondary': '#f5efe2',
      '--secondary-foreground': '#78350f',
      '--accent': '#0d9488',
      '--accent-foreground': '#ffffff',
      '--muted': '#f5efe2',
      '--muted-foreground': '#78716c',
      '--card': '#ffffff',
      '--card-foreground': '#1c1917',
      '--border': '#e7decb',
      '--input': '#ffffff',
      '--ring': '#ea580c',
      '--pink': '#e11d48',
      '--cyan': '#0d9488',
      '--violet': '#7c3aed',
      '--green': '#16a34a',
      '--amber': '#f59e0b',
      '--red': '#dc2626',
      '--glass-bg': 'rgba(255,253,247,0.78)',
      '--glass-strong-bg': 'rgba(255,253,247,0.96)',
      '--glass-border': 'rgba(120,53,15,0.08)',
      '--glass-border-strong': 'rgba(120,53,15,0.14)',
    },
  },
  {
    id: 'theme-8',
    name: 'Slate Grey',
    description: 'Modern grey theme with cool slate tones',
    preview: ['#1f2937', '#94a3b8', '#64748b', '#cbd5e1'],
    vars: {
      '--background': '#1f2937',
      '--foreground': '#f1f5f9',
      '--primary': '#94a3b8',
      '--primary-foreground': '#0f172a',
      '--secondary': '#374151',
      '--secondary-foreground': '#cbd5e1',
      '--accent': '#64748b',
      '--accent-foreground': '#ffffff',
      '--muted': '#2d3848',
      '--muted-foreground': '#94a3b8',
      '--card': '#283142',
      '--card-foreground': '#f1f5f9',
      '--border': '#3a4658',
      '--input': '#2d3848',
      '--ring': '#94a3b8',
      '--pink': '#fb7185',
      '--cyan': '#67e8f9',
      '--violet': '#a78bfa',
      '--green': '#86efac',
      '--amber': '#fcd34d',
      '--red': '#fca5a5',
      '--glass-bg': 'rgba(40,49,66,0.75)',
      '--glass-strong-bg': 'rgba(40,49,66,0.95)',
      '--glass-border': 'rgba(255,255,255,0.06)',
      '--glass-border-strong': 'rgba(255,255,255,0.10)',
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
