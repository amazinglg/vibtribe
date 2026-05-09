import React, { useState } from 'react';
import { Lock, X, Split, MoveRight, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface MarkSecureModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  chatId: string;
}

type SecureMode = 'move' | 'split';

export default function MarkSecureModal({ isOpen, onClose, contactName, chatId }: MarkSecureModalProps) {
  const [step, setStep] = useState<'choose' | 'set-code'>('choose');
  const [mode, setMode] = useState<SecureMode>('move');
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    setStep('set-code');
  };

  const handleSecure = async () => {
    if (!code.trim()) { setError('Please enter a security code'); return; }
    if (code !== confirmCode) { setError('Codes do not match'); return; }
    if (code.length < 4) { setError('Code must be at least 4 characters'); return; }

    setLoading(true);
    // Backend: POST /api/chats/:chatId/secure — { code, mode: 'move' | 'split' }
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);

    toast.success(
      mode === 'move'
        ? `Chat with ${contactName} moved to Secure Vault`
        : `Secure channel with ${contactName} created alongside normal chat`
    );
    onClose();
    setStep('choose');
    setCode('');
    setConfirmCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong rounded-3xl border border-border shadow-card float-up overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center">
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">Secure This Chat</h2>
            <p className="text-xs text-muted-foreground">Chat with {contactName}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-muted text-muted-foreground transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {step === 'choose' ? (
            <div>
              <p className="text-sm text-muted-foreground mb-5">
                Choose how you want to secure this chat with <span className="text-foreground font-semibold">{contactName}</span>:
              </p>

              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => setMode('move')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    mode === 'move' ?'border-primary bg-primary/10' :'border-border hover:border-border/80 hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode === 'move' ? 'gradient-primary' : 'bg-muted'}`}>
                    <MoveRight size={18} className={mode === 'move' ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Move Entire Chat</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      The entire chat history and all future messages move to your Secure Vault. This chat disappears from your normal chat list.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setMode('split')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    mode === 'split' ?'border-pink bg-pink/10' :'border-border hover:border-border/80 hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode === 'split' ? 'gradient-pink' : 'bg-muted'}`}>
                    <Split size={18} className={mode === 'split' ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Create Dual Channel</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Keep the normal chat AND create a separate secure channel. Messages sent in each channel stay isolated — the other person also gets the secure channel.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-start gap-2 p-3 bg-vt-amber/10 border border-vt-amber/20 rounded-xl mb-5">
                <AlertTriangle size={14} className="text-vt-amber flex-shrink-0 mt-0.5" />
                <p className="text-xs text-vt-amber/80 leading-relaxed">
                  Once secured, if you forget your code, there is no recovery. Both sender and receiver can use the secure channel independently.
                </p>
              </div>

              <button
                onClick={handleNext}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all glow-primary"
              >
                Continue — Set Security Code
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setStep('choose')}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                ← Back to options
              </button>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Create Security Code
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  This code is the only way to access this chat. It cannot be reset or recovered.
                </p>
                <div className="relative">
                  <input
                    type={showCode ? 'text' : 'password'}
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(''); }}
                    placeholder="Min. 4 characters..."
                    className="w-full px-4 py-3 pr-12 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Confirm Code
                </label>
                <input
                  type={showCode ? 'text' : 'password'}
                  value={confirmCode}
                  onChange={(e) => { setConfirmCode(e.target.value); setError(''); }}
                  placeholder="Re-enter your code..."
                  className="w-full px-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-mono tracking-widest"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-vt-red/10 border border-vt-red/30 rounded-xl mb-4">
                  <AlertTriangle size={14} className="text-vt-red flex-shrink-0" />
                  <p className="text-xs text-vt-red">{error}</p>
                </div>
              )}

              <button
                onClick={handleSecure}
                disabled={loading || !code || !confirmCode}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Securing...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Lock This Chat</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}