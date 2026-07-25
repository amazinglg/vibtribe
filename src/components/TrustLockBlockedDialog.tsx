import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function TrustLockBlockedDialog({
  open, onClose,
  title = 'Protected by Trust Lock',
  message = 'This media is protected by Trust Lock and cannot be shared or downloaded.',
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1800] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="tl-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative w-full max-w-sm rounded-3xl p-6 text-center border border-primary/30 shadow-2xl"
            style={{
              background: 'linear-gradient(160deg, hsl(var(--card)) 0%, color-mix(in oklab, hsl(var(--primary)) 12%, hsl(var(--card))) 100%)',
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-white/5"
            >
              <X size={16} />
            </button>
            <motion.div
              initial={{ scale: 0.6, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-primary/15 ring-2 ring-primary/40 shadow-[0_0_30px_-6px_hsl(var(--primary)/0.6)]"
            >
              <ShieldCheck className="text-primary" size={30} />
            </motion.div>
            <h3 id="tl-title" className="text-base font-semibold mb-2 text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-95 active:scale-[0.98] transition"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
