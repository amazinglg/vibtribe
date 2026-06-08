import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'vt_last_release_id';

/**
 * Listens for new rows in `app_releases` and forces every connected client
 * (web, Android, iOS) to hard-reload — clearing caches and unregistering
 * the service worker — without signing the user out (auth tokens live in
 * localStorage, which we preserve).
 */
export default function ForceReleaseListener() {
  const reloadingRef = useRef(false);

  useEffect(() => {
    const handleNewRelease = async (releaseId: string) => {
      if (reloadingRef.current) return;
      try {
        const last = localStorage.getItem(STORAGE_KEY);
        if (last === releaseId) return;
        localStorage.setItem(STORAGE_KEY, releaseId);
      } catch {}
      reloadingRef.current = true;

      try {
        // Clear Cache Storage (web + Capacitor WebView)
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}

      try {
        // Unregister service workers so the next load fetches fresh assets
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {}

      // Hard reload — bust HTTP cache with a version query param
      const url = new URL(window.location.href);
      url.searchParams.set('_r', releaseId.slice(0, 8));
      window.location.replace(url.toString());
    };

    // Initial check: if a release was published while the tab was closed
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('app_releases')
          .select('id')
          .order('released_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) {
          const last = localStorage.getItem(STORAGE_KEY);
          if (!last) {
            // First-ever sighting — remember without reloading
            localStorage.setItem(STORAGE_KEY, data.id);
          } else if (last !== data.id) {
            handleNewRelease(data.id);
          }
        }
      } catch {}
    })();

    const channel = supabase
      .channel('app_releases_force_reload')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'app_releases' },
        (payload: any) => {
          const id = payload?.new?.id;
          if (id) handleNewRelease(id);
        },
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  return null;
}