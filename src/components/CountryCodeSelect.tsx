import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, flagFromIso2, type Country } from '@/lib/countryCodes';

type Props = {
  value: Country;
  onChange: (c: Country) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Reusable country dial-code selector. Renders an inline button with the
 * flag + dial code, opens a searchable dropdown of every country.
 */
export default function CountryCodeSelect({ value, onChange, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.dial.includes(q) ||
      c.iso2.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        aria-label={`Country code, currently ${value.name} ${value.dial}`}
        className="flex items-center gap-1.5 px-3 py-3 bg-input border border-border rounded-xl text-sm text-foreground hover:border-primary transition-all whitespace-nowrap h-full disabled:opacity-50"
      >
        <span aria-hidden>{flagFromIso2(value.iso2)}</span>
        <span className="font-medium">{value.dial}</span>
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country or code"
                className="w-full pl-8 pr-2 py-2 bg-input border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</p>
            ) : filtered.map(c => (
              <button
                key={`${c.iso2}-${c.dial}`}
                type="button"
                onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left ${value.iso2 === c.iso2 ? 'text-primary font-medium bg-muted/50' : 'text-foreground'}`}
              >
                <span aria-hidden>{flagFromIso2(c.iso2)}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}