import React, { useState } from 'react';
import { Globe, X } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface Props {
  className?: string;
  label?: string;
}

export default function LanguageDialogButton({ className = '', label = 'Change Language' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ${className}`}
      >
        <Globe size={13} />
        <span>{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-strong rounded-3xl border border-border w-full max-w-xs p-5 float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Choose Language</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <LanguageSwitcher variant="card" onChange={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}