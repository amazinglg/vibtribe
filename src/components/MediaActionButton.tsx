import React, { useState } from 'react';
import { Download, Check, Loader2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { isNativeWrapper } from '@/lib/native-bridge';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface Props {
  action: 'download' | 'share';
  onRun: () => Promise<void | { location?: string }>;
  label: string;
  className?: string;
  size?: number;
  successMessage?: string;
  errorMessage?: string;
  variant?: 'floating' | 'inline';
}

export default function MediaActionButton({
  action, onRun, label, className = '', size = 16,
  successMessage, errorMessage, variant = 'floating',
}: Props) {
  const [status, setStatus] = useState<Status>('idle');

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'loading') return;
    setStatus('loading');
    try {
      // Haptic feedback on native
      if (isNativeWrapper()) {
        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Light });
        } catch { /* noop */ }
      }
      const result: any = await onRun();
      setStatus('success');
      const loc = result?.location;
      const msg = successMessage || (action === 'download'
        ? (loc === 'gallery' ? 'Saved to your gallery' : loc === 'downloads' ? 'Saved to Downloads' : 'Saved to your device')
        : 'Shared');
      toast.success(msg);
      setTimeout(() => setStatus('idle'), 1800);
    } catch (e: any) {
      if (e?.name === 'AbortError') { setStatus('idle'); return; }
      setStatus('error');
      toast.error(errorMessage || e?.message || (action === 'download' ? 'Unable to save media' : 'Unable to share'));
      setTimeout(() => setStatus('idle'), 2200);
    }
  };

  const base = variant === 'floating'
    ? 'p-2 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-lg'
    : 'p-1.5 rounded-full bg-muted text-foreground';

  const Icon = action === 'download' ? Download : Share2;

  return (
    <motion.button
      type="button"
      onClick={run}
      aria-label={label}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={`relative inline-flex items-center justify-center overflow-hidden transition-shadow ${base} ${status === 'success' ? 'ring-2 ring-primary/60 shadow-[0_0_18px_-2px_hsl(var(--primary)/0.7)]' : ''} ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === 'idle' && (
          <motion.span key="idle" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
            <Icon size={size} />
          </motion.span>
        )}
        {status === 'loading' && (
          <motion.span key="loading" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
            <Loader2 size={size} className="animate-spin" />
          </motion.span>
        )}
        {status === 'success' && (
          <motion.span key="ok" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
            <Check size={size} />
          </motion.span>
        )}
        {status === 'error' && (
          <motion.span key="err" initial={{ x: -4 }} animate={{ x: [0, -4, 4, -4, 4, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <Icon size={size} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
