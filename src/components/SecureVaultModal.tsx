// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Lock, X, AlertTriangle, Eye, EyeOff, ArrowRight, ShieldAlert, Edit3, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/store/chatStore';

interface SecureVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SecureChat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  code: string;
  otherUserId?: string;
}

type Mode = 'code' | 'pattern';

// Helper: get/set preferred nickname stored locally per user per contact
export function getPreferredNickname(myUserId: string, contactUserId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = localStorage.getItem(`vt_nickname_${myUserId}_${contactUserId}`);
    return stored || '';
  } catch {
    return '';
  }
}

export function setPreferredNickname(myUserId: string, contactUserId: string, nickname: string) {
  if (typeof window === 'undefined') return;
  try {
    if (nickname.trim()) {
      localStorage.setItem(`vt_nickname_${myUserId}_${contactUserId}`, nickname.trim());
    } else {
      localStorage.removeItem(`vt_nickname_${myUserId}_${contactUserId}`);
    }
  } catch {}
}

export default function SecureVaultModal({ isOpen, onClose }: SecureVaultModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const openSecureChat = useChatStore((s) => s.openSecureChat);
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [foundChat, setFoundChat] = useState<SecureChat | null>(null);
  const [patternSelected, setPatternSelected] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  // Nickname editing state
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [savedNickname, setSavedNickname] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && mode === 'code') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  // Load existing nickname when foundChat is set
  useEffect(() => {
    if (foundChat?.otherUserId && user) {
      const existing = getPreferredNickname(user.id, foundChat.otherUserId);
      setSavedNickname(existing);
      setNicknameInput(existing);
    }
  }, [foundChat, user]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleCodeSubmit = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);
    try {
      const { data: chats } = await supabase
        .from('chats')
        .select('id, participant_one, participant_two, secure_code')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .eq('chat_type', 'secure')
        .eq('secure_code', code.trim());

      if (chats && chats.length > 0) {
        const chat = chats[0];
        const otherUserId = chat.participant_one === user.id ? chat.participant_two : chat.participant_one;
        const { data: otherUser } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', otherUserId)
          .single();

        const realName = otherUser?.full_name || 'Secure Contact';
        const nickname = getPreferredNickname(user.id, otherUserId);
        const displayName = nickname || realName;
        setFoundChat({
          id: chat.id,
          name: displayName,
          avatar: displayName[0]?.toUpperCase() || 'S',
          lastMessage: 'Secure conversation',
          code: code.trim(),
          otherUserId,
        });
        setError('');
        toast.success(`Opening secure chat with ${displayName}`);
      } else {
        setAttempts(a => a + 1);
        setError('This code does not match any secured chat for your account.');
        triggerShake();
        setCode('');
      }
    } catch {
      setAttempts(a => a + 1);
      setError('Unable to verify code. Please try again.');
      triggerShake();
    }
    setLoading(false);
  };

  const handlePatternDot = async (dot: number) => {
    if (patternSelected.includes(dot)) return;
    const newPattern = [...patternSelected, dot];
    setPatternSelected(newPattern);

    if (newPattern.length >= 4) {
      const patternCode = newPattern.join('-');
      if (!user) return;
      try {
        const { data: chats } = await supabase
          .from('chats')
          .select('id, participant_one, participant_two, secure_code')
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
          .eq('chat_type', 'secure')
          .eq('secure_code', patternCode);

        if (chats && chats.length > 0) {
          const chat = chats[0];
          const otherUserId = chat.participant_one === user.id ? chat.participant_two : chat.participant_one;
          const { data: otherUser } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', otherUserId)
            .single();

          const realName = otherUser?.full_name || 'Secure Contact';
          const nickname = getPreferredNickname(user.id, otherUserId);
          const displayName = nickname || realName;
          setFoundChat({
            id: chat.id,
            name: displayName,
            avatar: displayName[0]?.toUpperCase() || 'S',
            lastMessage: 'Secure conversation',
            code: patternCode,
            otherUserId,
          });
          setError('');
          toast.success(`Opening secure chat with ${displayName}`);
        } else if (newPattern.length >= 9) {
          setAttempts(a => a + 1);
          setError('Pattern does not match any secured chat for your account.');
          triggerShake();
          setTimeout(() => setPatternSelected([]), 600);
        }
      } catch {
        // Continue drawing
      }
    }
  };

  const handleSaveNickname = () => {
    if (!foundChat?.otherUserId || !user) return;
    setPreferredNickname(user.id, foundChat.otherUserId, nicknameInput);
    const newNickname = nicknameInput.trim();
    setSavedNickname(newNickname);
    setEditingNickname(false);
    if (newNickname) {
      toast.success(`Preferred name "${newNickname}" saved — visible only to you`);
    } else {
      toast.success('Preferred name removed');
    }
    // Update displayed name in foundChat
    const displayName = newNickname || foundChat.name;
    setFoundChat(prev => prev ? { ...prev, name: displayName, avatar: displayName[0]?.toUpperCase() || 'S' } : prev);
  };

  const handleReset = () => {
    setCode('');
    setError('');
    setFoundChat(null);
    setPatternSelected([]);
    setAttempts(0);
    setEditingNickname(false);
    setNicknameInput('');
    setSavedNickname('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleOpenSecureChat = () => {
    if (foundChat) openSecureChat(foundChat.id);
    handleClose();
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
            <p className="text-xs text-muted-foreground">Enter your PIN or pattern</p>
          </div>
          <button onClick={handleClose} className="ml-auto p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Privacy Notice */}
          <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl mb-5">
            <ShieldAlert size={16} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary/80 leading-relaxed">
              Secured chats are not visible in your general chat list. Enter the exact PIN or pattern you set for that chat.
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
                {m === 'code' ? '🔑 PIN / Code' : '🔷 Pattern'}
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
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{foundChat.name}</p>
                  {savedNickname && (
                    <p className="text-xs text-primary/70 mt-0.5">Preferred name set</p>
                  )}
                  <p className="text-sm text-muted-foreground truncate">{foundChat.lastMessage}</p>
                </div>
                <div className="ml-auto">
                  <Lock size={16} className="text-vt-green" />
                </div>
              </div>

              {/* Preferred Nickname Section */}
              <div className="mb-4 p-4 glass rounded-2xl border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Preferred Name</p>
                    <p className="text-xs text-muted-foreground">Only visible to you — does not affect the other user</p>
                  </div>
                  {!editingNickname && (
                    <button
                      onClick={() => { setEditingNickname(true); setNicknameInput(savedNickname); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
                    >
                      <Edit3 size={11} />
                      {savedNickname ? 'Edit' : 'Set Name'}
                    </button>
                  )}
                </div>
                {editingNickname ? (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={e => setNicknameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                      placeholder="Enter a preferred name..."
                      maxLength={40}
                      className="flex-1 px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveNickname}
                      className="p-2 gradient-primary text-white rounded-xl hover:opacity-90 transition-all"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => { setEditingNickname(false); setNicknameInput(savedNickname); }}
                      className="p-2 glass border border-border text-muted-foreground rounded-xl hover:bg-muted transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-foreground mt-1">
                    {savedNickname ? (
                      <span className="font-medium text-primary">{savedNickname}</span>
                    ) : (
                      <span className="text-muted-foreground italic">No preferred name set</span>
                    )}
                  </p>
                )}
              </div>

              <button
                onClick={handleOpenSecureChat}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all glow-primary"
              >
                <span>Open Secure Chat</span>
                <ArrowRight size={18} />
              </button>
              <button onClick={handleReset} className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Try another code
              </button>
            </div>
          ) : mode === 'code' ? (
            /* PIN / Code Input */
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Enter PIN / Security Code</label>
              <p className="text-xs text-muted-foreground mb-3">Type the exact PIN or code you set when securing this chat.</p>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && code.trim() && handleCodeSubmit()}
                  placeholder="Enter your PIN or code..."
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
                    Multiple failed attempts. Secured chats cannot be recovered if you forget your code — this is by design.
                  </p>
                </div>
              )}

              <button
                onClick={handleCodeSubmit}
                disabled={!code.trim() || loading}
                className="w-full mt-4 gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <Lock size={16} />
                )}
                <span>Unlock Chat</span>
              </button>
            </div>
          ) : (
            /* Pattern Input */
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Draw Your Pattern</p>
              <p className="text-xs text-muted-foreground mb-4">Tap the dots in the same order you used when securing the chat.</p>
              <div className="grid grid-cols-3 gap-4 max-w-[200px] mx-auto mb-4">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((dot) => (
                  <button
                    key={`pattern-dot-${dot}`}
                    onClick={() => handlePatternDot(dot)}
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                      patternSelected.includes(dot)
                        ? 'border-primary bg-primary text-white scale-110' :'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {patternSelected.includes(dot) ? patternSelected.indexOf(dot) + 1 : ''}
                  </button>
                ))}
              </div>

              {patternSelected.length > 0 && (
                <p className="text-center text-xs text-muted-foreground mb-3">
                  {patternSelected.length} dots selected — {patternSelected.length < 4 ? 'keep going...' : 'pattern recorded'}
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