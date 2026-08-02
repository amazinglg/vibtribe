import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Trash2, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  cacheStats,
  formatBytes,
  loadCachePrefs,
  saveCachePrefs,
  wipeCacheFor,
  type CacheStats,
  type CachePrefs,
} from '@/lib/offline';

/**
 * Settings → Offline Storage. Pure UX surface over the existing encrypted
 * cache: it reads usage metadata, toggles the already-implemented Maximum
 * Privacy Mode, and calls the existing secure wipe.
 */
export default function OfflineStorageSettings() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [prefs, setPrefs] = useState<CachePrefs>({ maxPrivacyMode: false, mediaCacheLimitMb: 250 });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [s, p] = await Promise.all([cacheStats(user.id), loadCachePrefs(user.id)]);
    setStats(s);
    setPrefs(p);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const togglePrivacy = async () => {
    if (!user?.id) return;
    const next = !prefs.maxPrivacyMode;
    setPrefs((p) => ({ ...p, maxPrivacyMode: next }));
    try {
      await saveCachePrefs(user.id, { maxPrivacyMode: next });
      toast.success(next ? 'Maximum Privacy Mode enabled' : 'Maximum Privacy Mode disabled');
    } catch {
      setPrefs((p) => ({ ...p, maxPrivacyMode: !next }));
      toast.error('Could not update Maximum Privacy Mode');
    }
  };

  const clearCache = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await wipeCacheFor(user.id, 'manual', prefs);
      await refresh();
      toast.success('Offline cache cleared — it will rebuild on your next sync');
    } catch {
      toast.error('Could not clear the offline cache');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const total = stats?.totalBytes ?? 0;
  const media = stats?.mediaBytes ?? 0;

  return (
    <div className="glass rounded-2xl border border-border p-5">
      <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
        <HardDrive size={16} className="text-primary" />
        Offline Storage
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Your chats are stored on this device fully encrypted so they open instantly, even without internet.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Offline storage used</p>
          <p className="text-lg font-semibold text-foreground transition-all">{formatBytes(total)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats ? `${stats.messageCount} messages · ${stats.chatCount} chats` : 'Reading…'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Media cache size</p>
          <p className="text-lg font-semibold text-foreground transition-all">{formatBytes(media)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats ? `${stats.mediaCount} items cached` : 'Reading…'}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between p-3 rounded-xl bg-muted/30 mb-3">
        <div className="flex-1 pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-primary" />
            Maximum Privacy Mode
          </p>
          <p className="text-xs text-muted-foreground">
            Erases the entire encrypted offline cache the moment you sign out, and clears decrypted
            data from memory whenever VibTribe goes to the background.
          </p>
          {prefs.maxPrivacyMode && (
            <p className="text-[11px] text-amber-400 mt-2 animate-fade-in">
              Your chats won't stay available offline after you log out — they'll be downloaded again on your next sign-in.
            </p>
          )}
        </div>
        <button
          onClick={togglePrivacy}
          aria-label="Toggle Maximum Privacy Mode"
          className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${prefs.maxPrivacyMode ? 'gradient-primary' : 'bg-muted'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${prefs.maxPrivacyMode ? 'right-1' : 'left-1'}`} />
        </button>
      </div>

      {!confirming ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-semibold transition-colors hover:bg-red-500/15"
          >
            <Trash2 size={15} /> Clear Offline Cache
          </button>
          <button
            onClick={() => void refresh()}
            aria-label="Refresh storage usage"
            className="p-2.5 rounded-xl bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 animate-fade-in">
          <p className="text-sm font-medium text-foreground mb-1">Clear offline cache?</p>
          <p className="text-xs text-muted-foreground mb-3">
            This securely wipes the encrypted cache on this device. Your account, settings and login stay
            exactly as they are, and your chats rebuild automatically on the next sync.
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={busy}
              onClick={clearCache}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {busy ? 'Clearing…' : 'Yes, clear it'}
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="px-4 py-2.5 rounded-xl bg-muted/40 text-foreground text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}