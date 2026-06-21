import React, { useEffect, useState } from 'react';

type Variant = 'default' | 'destructive';

type Resolver = (value: boolean) => void;
type DialogRequest = {
  id: number;
  kind: 'confirm' | 'alert';
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  resolve: Resolver;
};

type Listener = (req: DialogRequest | null) => void;
let currentReq: DialogRequest | null = null;
const queue: DialogRequest[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l(currentReq));
}

function flush() {
  if (currentReq) return;
  currentReq = queue.shift() || null;
  emit();
}

function enqueue(req: Omit<DialogRequest, 'id' | 'resolve'>): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ ...req, id: nextId++, resolve });
    flush();
  });
}

export function appConfirm(opts: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}): Promise<boolean> {
  return enqueue({ kind: 'confirm', ...opts });
}

export function appAlert(opts: { title?: string; message: string; confirmLabel?: string }): Promise<boolean> {
  return enqueue({ kind: 'alert', ...opts });
}

export function AppDialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(currentReq);

  useEffect(() => {
    const l: Listener = (r) => setReq(r);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const close = (result: boolean) => {
    if (!req) return;
    req.resolve(result);
    currentReq = null;
    setReq(null);
    setTimeout(flush, 0);
  };

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.id]);

  if (!req) return null;

  const isDestructive = req.variant === 'destructive';
  const confirmLabel = req.confirmLabel || (req.kind === 'alert' ? 'OK' : 'Confirm');
  const cancelLabel = req.cancelLabel || 'Cancel';

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-card overflow-hidden float-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          {req.title && (
            <h3 className="text-base font-semibold text-foreground mb-1.5">{req.title}</h3>
          )}
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {req.message}
          </p>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          {req.kind === 'confirm' && (
            <button
              type="button"
              onClick={() => close(false)}
              className="flex-1 py-2.5 rounded-xl glass text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600'
                : 'gradient-primary hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppDialogHost;