import React, { useState, useRef, useEffect } from 'react';
import { Lock, X, AlertTriangle, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface SecureVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock secure chats data — backend should validate code against user's secure chats
const SECURE_CHATS: Record<string, { id: string; name: string; code: string; lastMessage: string; avatar: string }> = {
  'VIBE2024': { id: 'sc-001', name: 'Priya Sharma', code: 'VIBE2024', lastMessage: 'See you tonight 💜', avatar: 'P' },
  '1234': { id: 'sc-002', name: 'Arjun Mehta', code: '1234', lastMessage: 'The files are ready', avatar: 'A' },
  'SECURE99': { id: 'sc-003', name: 'Zara Khan', code: 'SECURE99', lastMessage: 'Don\'t share this with anyone', avatar: 'Z' },
};

type Mode = 'code' | 'pattern';

const PATTERN_SIZE = 3;

export default function SecureVaultModal({ isOpen, onClose }: SecureVaultModalProps) {
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [foundChat, setFoundChat] = useState<null | typeof SECURE_CHATS[string]>(null);
  const [patternSelected, setPatternSelected] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pattern codes mapped to dot sequences
  const PATTERN_CODES: Record<string, { dots: number[]; chatId: string; name: string; avatar: string; lastMessage: string }> = {
    '1-2-3-4-5': { dots: [1, 2, 3, 4, 5], chatId: 'sc-004', name: 'Dev Kapoor', avatar: 'D', lastMessage: 'Pattern protected 🔐' },
    '1-5-9': { dots: [1, 5, 9], chatId: 'sc-005', name: 'Nisha Patel', avatar: 'N', lastMessage: 'Only we know this' },
  };

  useEffect(() => {
    if (isOpen && mode === 'code') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleCodeSubmit = () => {
    const trimmed = code.trim().toUpperCase();
    const chat = SECURE_CHATS[trimmed] || SECURE_CHATS[code.trim()];
    if (chat) {
      setFoundChat(chat);
      setError('');
      toast.success(`Opening secure chat with ${chat.name}`);
    } else {
      setAttempts(a => a + 1);
      setError('This code does not match any secured chat for your account.');
      triggerShake();
      setCode('');
    }
  };

  const handlePatternDot = (dot: number) => {
    if (patternSelected.includes(dot)) return;
    const newPattern = [...patternSelected, dot];
    setPatternSelected(newPattern);

    if (newPattern.length >= 3) {
      const key = newPattern.join('-');
      const match = PATTERN_CODES[key];
      if (match) {
        setFoundChat({ id: match.chatId, name: match.name, code: key, lastMessage: match.lastMessage, avatar: match.avatar });
        setError('');
        toast.success(`Opening secure chat with ${match.name}`);
      } else if (newPattern.length >= 5) {
        setAttempts(a => a + 1);
        setError('Pattern does not match any secured chat for your account.');
        triggerShake();
        setTimeout(() => setPatternSelected([]), 600);
      }
    }
  };

  const handleReset = () => {
    setCode('');
    setError('');
    setFoundChat(null);
    setPatternSelected([]);
    setAttempts(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={handleClose} />
      <div
        className={`relative w-full max-w-md glass-strong rounded-3xl border border-border shadow-card overflow-hidden float-up ${shaking ? 'secure-shake' : ''}`}
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center glow-primary">
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">Secure Vault</h2>
            <p className="text-xs text-muted-foreground">Enter your code or pattern</p>
          </div>
          <button
            onClick={handleClose}
            className="ml-auto p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Privacy Notice */}
          <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl mb-5">
            <ShieldAlert size={16} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary/80 leading-relaxed">
              Secured chats are not visible anywhere else. Enter the exact code or pattern set for that chat — no recovery option exists by design.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl mb-5">
            {(['code', 'pattern'] as Mode[]).map((m) => (
              <button
                key={`vault-mode-${m}`}
                onClick={() => { setMode(m); handleReset(); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m ? 'gradient-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'code' ? '🔑 Code' : '🔷 Pattern'}
              </button>
            ))}
          </div>

          {/* Found Chat — Success State */}
          {foundChat ? (
            <div className="float-up">
              <div className="flex items-center gap-4 p-4 bg-vt-green/10 border border-vt-green/30 rounded-2xl mb-4">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {foundChat.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{foundChat.name}</p>
                  <p className="text-sm text-muted-foreground truncate max-w-[200px]">{foundChat.lastMessage}</p>
                </div>
                <div className="ml-auto">
                  <Lock size={16} className="text-vt-green" />
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all glow-primary"
              >
                <span>Open Secure Chat</span>
                <ArrowRight size={18} />
              </button>
              <button
                onClick={handleReset}
                className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Try another code
              </button>
            </div>
          ) : mode === 'code' ? (
            /* Code Input */
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Enter Security Code
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Type the exact code you set when securing this chat.
              </p>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && code.trim() && handleCodeSubmit()}
                  placeholder="Enter your secure code..."
                  className="w-full px-4 py-3 pr-12 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 mt-3 p-3 bg-vt-red/10 border border-vt-red/30 rounded-xl">
                  <AlertTriangle size={14} className="text-vt-red flex-shrink-0" />
                  <p className="text-xs text-vt-red">{error}</p>
                </div>
              )}

              {attempts >= 3 && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-vt-amber/10 border border-vt-amber/30 rounded-xl">
                  <AlertTriangle size={14} className="text-vt-amber flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-vt-amber/90">
                    Multiple failed attempts. If you forgot your code, secured chats cannot be recovered — this is by design to protect your privacy.
                  </p>
                </div>
              )}

              <button
                onClick={handleCodeSubmit}
                disabled={!code.trim()}
                className="w-full mt-4 gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
              >
                <Lock size={16} />
                <span>Unlock Chat</span>
              </button>
            </div>
          ) : (
            /* Pattern Input */
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Draw Your Pattern</p>
              <p className="text-xs text-muted-foreground mb-4">
                Tap the dots in the same order you used when securing the chat.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-[200px] mx-auto mb-4">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((dot) => (
                  <button
                    key={`pattern-dot-${dot}`}
                    onClick={() => handlePatternDot(dot)}
                    className={`pattern-dot ${patternSelected.includes(dot) ? 'active' : ''}`}
                  >
                    {patternSelected.includes(dot) ? patternSelected.indexOf(dot) + 1 : ''}
                  </button>
                ))}
              </div>

              {patternSelected.length > 0 && (
                <p className="text-center text-xs text-muted-foreground mb-3">
                  {patternSelected.length} dots selected — {patternSelected.length < 3 ? 'keep going...' : 'pattern recorded'}
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-vt-red/10 border border-vt-red/30 rounded-xl mb-3">
                  <AlertTriangle size={14} className="text-vt-red flex-shrink-0" />
                  <p className="text-xs text-vt-red">{error}</p>
                </div>
              )}

              <button
                onClick={() => setPatternSelected([])}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear Pattern
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}