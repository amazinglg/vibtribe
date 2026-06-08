import { useEffect, useState } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY, findCountryByIso2, type Country } from '@/lib/countryCodes';

// Best-effort country detection from the visitor's IP. We use ipapi.co's
// free JSON endpoint (no key required). If it fails for any reason we
// silently fall back to India so existing users see no behaviour change.
let cached: Country | null = null;
let inflight: Promise<Country> | null = null;

async function detectOnce(): Promise<Country> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('detect failed');
      const j: any = await res.json();
      const iso = (j?.country_code || j?.country || '').toString();
      const found = findCountryByIso2(iso) || COUNTRIES.find(c => c.dial === `+${(j?.country_calling_code || '').replace(/^\+/, '')}`);
      cached = found ?? DEFAULT_COUNTRY;
      return cached;
    } catch {
      cached = DEFAULT_COUNTRY;
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useDetectCountry(initial?: Country): { country: Country; detected: boolean; setCountry: (c: Country) => void } {
  const [country, setCountry] = useState<Country>(initial ?? DEFAULT_COUNTRY);
  const [detected, setDetected] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    detectOnce().then(c => {
      if (!mounted) return;
      setCountry(prev => (prev && prev.iso2 !== DEFAULT_COUNTRY.iso2 ? prev : c));
      setDetected(true);
    });
    return () => { mounted = false; };
  }, []);
  return { country, detected, setCountry };
}