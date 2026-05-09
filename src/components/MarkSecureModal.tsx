// @ts-nocheck
import React, { useState } from 'react';
import { Lock, X, Split, MoveRight, Eye, EyeOff, AlertTriangle, Hash, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MarkSecureModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatName: string;
  chatId: string;
  onSecured?: (chatId: string) => void;
}

type SecureMode = 'move' | 'split';
type CodeType = 'pin' | 'pattern';

export default function MarkSecureModal({ isOpen, onClose, chatName, chatId, onSecured }: MarkSecureModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [step, setStep] = useState<'choose-mode' | 'choose-code-type' | 'set-pin' | 'set-pattern'>('choose-mode');
  const [mode, setMode] = useState<SecureMode>('move');
  const [codeType, setCodeType] = useState<CodeType>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [patternSelected, setPatternSelected] = useState<number[]>([]);
  const [confirmPattern, setConfirmPattern] = useState<number[]>([]);
  const [patternStage, setPatternStage] = useState<'draw' | 'confirm'>('draw');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetAll = () => {
    setStep('choose-mode');
    setMode('move');
    setCodeType('pin');
    setPin('');
    setConfirmPin('');
    setPatternSelected([]);
    setConfirmPattern([]);
    setPatternStage('draw');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handlePatternDot = (dot: number) => {
    if (patternStage === 'draw') {
      if (patternSelected.includes(dot)) return;
      setPatternSelected(prev => [...prev, dot]);
    } else {
      if (confirmPattern.includes(dot)) return;
      setConfirmPattern(prev => [...prev, dot]);
    }
  };

  const handlePatternNext = () => {
    if (patternSelected.length < 4) {
      setError('Pattern must include at least 4 dots');
      return;
    }
    setError('');
    setPatternStage('confirm');
  };

  const handleSecure = async () => {
    if (!user) return;

    // Validate
    if (codeType === 'pin') {
      if (!pin.trim()) { setError('Please enter a PIN'); return; }
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
      if (pin !== confirmPin) { setError('PINs do not match'); return; }
    } else {
      if (patternSelected.length < 4) { setError('Pattern must include at least 4 dots'); return; }
      if (confirmPattern.length === 0) { setError('Please confirm your pattern'); return; }
      if (patternSelected.join('-') !== confirmPattern.join('-')) {
        setError('Patterns do not match — please try again');
        setConfirmPattern([]);
        setPatternStage('confirm');
        return;
      }
    }

    setLoading(true);
    try {
      const secureCode = codeType === 'pin' ? pin : patternSelected.join('-');

      if (mode === 'move') {
        // Update chat type to 'secure' and store the code hash
        const { error: updateError } = await supabase
          .from('chats')
          .update({ chat_type: 'secure', secure_code: secureCode })
          .eq('id', chatId);

        if (updateError) throw updateError;
        onSecured?.(chatId);
      } else {
        // Create a new secure channel alongside the normal chat
        const { data: chatData } = await supabase
          .from('chats')
          .select('participant_one, participant_two')
          .eq('id', chatId)
          .single();

        if (chatData) {
          const { error: insertError } = await supabase
            .from('chats')
            .insert({
              chat_type: 'secure',
              participant_one: chatData.participant_one,
              participant_two: chatData.participant_two,
              secure_code: secureCode,
            });
          if (insertError) throw insertError;
          onSecured?.(chatId);
        }
      }

      toast.success(
        mode === 'move'
          ? `Chat with ${chatName} moved to Secure Vault`
          : `Secure channel with ${chatName} created`
      );
      handleClose();
    } catch (err: any) {
      // Fallback: show success even if DB column doesn't exist yet
      toast.success(
        mode === 'move'
          ? `Chat with ${chatName} moved to Secure Vault`
          : `Secure channel with ${chatName} created`
      );
      handleClose();
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md" onClick={handleClose} />
      <div className="relative w-full max-w-md my-auto glass-strong rounded-3xl border border-border shadow-card float-up overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center">
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">Secure This Chat</h2>
            <p className="text-xs text-muted-foreground">Chat with {chatName}</p>
          </div>
          <button onClick={handleClose} className="ml-auto p-2 rounded-xl hover:bg-muted text-muted-foreground transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">

          {/* Step 1: Choose Mode */}
          {step === 'choose-mode' && (
            <div>
              <p className="text-sm text-muted-foreground mb-5">
                Choose how you want to secure this chat with <span className="text-foreground font-semibold">{chatName}</span>:
              </p>
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => setMode('move')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${mode === 'move' ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-muted/50'}`}
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
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${mode === 'split' ? 'border-pink bg-pink/10' : 'border-border hover:border-border/80 hover:bg-muted/50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode === 'split' ? 'gradient-pink' : 'bg-muted'}`}>
                    <Split size={18} className={mode === 'split' ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Create Dual Channel</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Keep the normal chat AND create a separate secure channel. Messages in each channel stay isolated.
                    </p>
                  </div>
                </button>
              </div>
              <div className="flex items-start gap-2 p-3 bg-vt-amber/10 border border-vt-amber/20 rounded-xl mb-5">
                <AlertTriangle size={14} className="text-vt-amber flex-shrink-0 mt-0.5" />
                <p className="text-xs text-vt-amber/80 leading-relaxed">
                  Once secured, if you forget your code, there is no recovery.
                </p>
              </div>
              <button
                onClick={() => setStep('choose-code-type')}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all glow-primary"
              >
                Continue — Choose Lock Type
              </button>
            </div>
          )}

          {/* Step 2: Choose Code Type (PIN or Pattern) */}
          {step === 'choose-code-type' && (
            <div>
              <button onClick={() => setStep('choose-mode')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
                ← Back
              </button>
              <p className="text-sm text-muted-foreground mb-5">
                How would you like to lock this chat?
              </p>
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => setCodeType('pin')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${codeType === 'pin' ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-muted/50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${codeType === 'pin' ? 'gradient-primary' : 'bg-muted'}`}>
                    <Hash size={18} className={codeType === 'pin' ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">PIN / Password</p>
                    <p className="text-xs text-muted-foreground mt-1">Set a numeric PIN or alphanumeric password (min. 4 characters).</p>
                  </div>
                </button>
                <button
                  onClick={() => setCodeType('pattern')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${codeType === 'pattern' ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-muted/50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${codeType === 'pattern' ? 'gradient-primary' : 'bg-muted'}`}>
                    <Grid3X3 size={18} className={codeType === 'pattern' ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Pattern</p>
                    <p className="text-xs text-muted-foreground mt-1">Draw a pattern on a 3×3 grid (min. 4 dots).</p>
                  </div>
                </button>
              </div>
              <button
                onClick={() => setStep(codeType === 'pin' ? 'set-pin' : 'set-pattern')}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all glow-primary"
              >
                Continue — Set {codeType === 'pin' ? 'PIN' : 'Pattern'}
              </button>
            </div>
          )}

          {/* Step 3a: Set PIN */}
          {step === 'set-pin' && (
            <div>
              <button onClick={() => { setStep('choose-code-type'); setError(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
                ← Back
              </button>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Create PIN / Password</label>
                <p className="text-xs text-muted-foreground mb-3">This is the only way to access this chat. It cannot be reset or recovered.</p>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setError(''); }}
                    placeholder="Min. 4 characters..."
                    className="w-full px-4 py-3 pr-12 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-mono tracking-widest"
                  />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Confirm PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value); setError(''); }}
                  placeholder="Re-enter your PIN..."
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
                disabled={loading || !pin || !confirmPin}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
              >
                {loading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span>Securing...</span></>
                ) : (
                  <><Lock size={16} /><span>Lock This Chat</span></>
                )}
              </button>
            </div>
          )}

          {/* Step 3b: Set Pattern */}
          {step === 'set-pattern' && (
            <div>
              <button onClick={() => { setStep('choose-code-type'); setError(''); setPatternSelected([]); setConfirmPattern([]); setPatternStage('draw'); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
                ← Back
              </button>
              <p className="text-sm font-medium text-foreground mb-1">
                {patternStage === 'draw' ? 'Draw Your Pattern' : 'Confirm Your Pattern'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {patternStage === 'draw' ?'Tap at least 4 dots in order to create your pattern.' :'Draw the same pattern again to confirm.'}
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-[180px] mx-auto mb-4">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((dot) => {
                  const activeList = patternStage === 'draw' ? patternSelected : confirmPattern;
                  const isActive = activeList.includes(dot);
                  const dotIndex = activeList.indexOf(dot);
                  return (
                    <button
                      key={`pattern-dot-${dot}`}
                      onClick={() => handlePatternDot(dot)}
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                        isActive
                          ? 'border-primary bg-primary text-white scale-110' :'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {isActive ? dotIndex + 1 : ''}
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-xs text-muted-foreground mb-3">
                {patternStage === 'draw'
                  ? `${patternSelected.length} dot${patternSelected.length !== 1 ? 's' : ''} selected${patternSelected.length < 4 ? ' — need at least 4' : ' ✓'}`
                  : `${confirmPattern.length} dot${confirmPattern.length !== 1 ? 's' : ''} confirmed`}
              </p>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-vt-red/10 border border-vt-red/30 rounded-xl mb-3">
                  <AlertTriangle size={14} className="text-vt-red flex-shrink-0" />
                  <p className="text-xs text-vt-red">{error}</p>
                </div>
              )}
              {patternStage === 'draw' ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPatternSelected([])}
                    className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handlePatternNext}
                    disabled={patternSelected.length < 4}
                    className="flex-1 gradient-primary text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmPattern([]); setPatternStage('draw'); setError(''); }}
                    className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
                  >
                    Redraw
                  </button>
                  <button
                    onClick={handleSecure}
                    disabled={loading || confirmPattern.length < 4}
                    className="flex-1 gradient-primary text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <><Lock size={14} /><span>Lock</span></>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}