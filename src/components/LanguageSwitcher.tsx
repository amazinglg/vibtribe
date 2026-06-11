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
      className={`inline-flex items-center p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 ${className}`}
      role="group"
      aria-label="Change language"
    >
      <div className="flex items-center">
        {LANGS.map((l, idx) => {
          const active = lang === l.code;
          const label = l.code === 'en' ? 'EN' : 'हिं';
          return (
            <React.Fragment key={l.code}>
              {idx > 0 && <div className="w-px h-3 bg-white/10 mx-1" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => handleSet(l.code)}
                aria-pressed={active}
                className={`px-4 py-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#ec4899] text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] text-[13px] font-bold tracking-wide'
                    : 'text-white/50 hover:text-white hover:bg-white/5 text-[14px] font-medium'
                }`}
              >
                {label}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}