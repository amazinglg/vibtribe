import React from 'react';
import { Globe } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { Lang } from '@/lib/i18n';

type Variant = 'pill' | 'inline' | 'card';

interface Props {
  variant?: Variant;
  className?: string;
  onChange?: (l: Lang) => void;
}

const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

export default function LanguageSwitcher({ variant = 'pill', className = '', onChange }: Props) {
  const { lang, setLang } = useT();

  const handleSet = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    onChange?.(l);
  };

  if (variant === 'card') {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        {LANGS.map(l => {
          const active = lang === l.code;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => handleSet(l.code)}
              className={`flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                active
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-muted/50'
              }`}
              aria-pressed={active}
            >
              <div className="flex items-center gap-2">
                <Globe size={16} className={active ? 'text-primary' : 'text-muted-foreground'} />
                <span className={`text-sm font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                  {l.native}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // pill / inline (same compact toggle look)
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full glass border border-border ${className}`}
      role="group"
      aria-label="Change language"
    >
      <Globe size={13} className="ml-2 text-muted-foreground" />
      {LANGS.map(l => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => handleSet(l.code)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              active ? 'gradient-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={active}
          >
            {l.code === 'en' ? 'EN' : 'हिं'}
          </button>
        );
      })}
    </div>
  );
}