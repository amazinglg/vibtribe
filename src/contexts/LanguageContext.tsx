import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { translations, type Lang, type TranslationKey } from '@/lib/i18n';

const STORAGE_KEY = 'vt_lang';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'hi') return v;
  } catch {}
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // Read persisted language on mount (avoid SSR mismatch by reading after mount).
  useEffect(() => {
    const stored = readStoredLang();
    if (stored !== lang) setLangState(stored);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', l);
    }
  }, []);

  const t = useCallback<Ctx['t']>((key, vars) => {
    const dict = translations[lang] || translations.en;
    let val = (dict as any)[key] ?? (translations.en as any)[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return val;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback if used outside provider (returns English passthrough)
    return {
      lang: 'en' as Lang,
      setLang: () => {},
      t: ((k: string) => (translations.en as any)[k] ?? k) as Ctx['t'],
    };
  }
  return ctx;
}

export function useLanguage() { return useT(); }