// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Lock, X, AlertTriangle, Eye, EyeOff, ArrowRight, ShieldAlert, Edit3, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PatternLock from '@/components/PatternLock';
import { useChatStore } from '@/store/chatStore';
import { unlockEncryptionWithPIN } from '@/lib/encryption';
import { useServerFn } from '@tanstack/react-start';
import { deleteAllSecuredChats } from '@/lib/secure-chats.functions';

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
  const setSelectedChatId = useChatStore((s) => s.setSelectedChatId);
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [foundChat, setFoundChat] = useState<SecureChat | null>(null);
  const [patternSelected, setPatternSelected] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  // Delete-all flow: 'confirm' | 'pin' | null
  const [deleteStep, setDeleteStep] = useState<null | 'confirm' | 'pin'>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteAllFn = useServerFn(deleteAllSecuredChats);

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
      const { data: marks } = await supabase
        .from('user_secure_chats')
        .select('chat_id')
        .eq('user_id', user.id)
        .eq('code', code.trim());

      if (marks && marks.length > 0) {
        const chatId = marks[0].chat_id as string;
        const { data: chat } = await supabase
          .from('chats')
          .select('id, participant_one, participant_two')
          .eq('id', chatId)
          .single();
        if (!chat) throw new Error('Chat not found');
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
        const { data: marks } = await supabase
          .from('user_secure_chats')
          .select('chat_id')
          .eq('user_id', user.id)
          .eq('code', patternCode);

        if (marks && marks.length > 0) {
          const chatId = marks[0].chat_id as string;
          const { data: chat } = await supabase
            .from('chats')
            .select('id, participant_one, participant_two')
            .eq('id', chatId)
            .single();
          if (!chat) throw new Error('Chat not found');
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
    if (foundChat) setSelectedChatId(foundChat.id);
    handleClose();
  };

  const handleConfirmDelete = async () => {
    if (!user) return;
    if (!/^\d{6}$/.test(deletePin)) {
      toast.error('Enter your 6-digit encryption PIN');
      return;
    }
    setDeleteBusy(true);
    try {
      // Verify the user's actual E2E encryption PIN
      await unlockEncryptionWithPIN(user.id, deletePin);
      const res: any = await deleteAllSecuredChats();
      toast.success(`Deleted ${res?.deleted ?? 0} secured chat${res?.deleted === 1 ? '' : 's'}`);
      setDeleteStep(null);
      setDeletePin('');
      handleClose();
    } catch (e: any) {
      toast.error(e?.message || 'Incorrect encryption PIN');
      setDeletePin('');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pb-24 sm:pb-4 overflow-y-auto">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={handleClose} />
      <div
        className={`relative w-full max-w-md my-auto glass-strong rounded-3xl border border-border shadow-card overflow-hidden float-up max-h-[calc(100dvh-7rem)] sm:max-h-[calc(100dvh-2rem)] ${shaking ? 'secure-shake' : ''}`}
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center glow-primary">
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">Secured Chats</h2>
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
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {foundChat.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  {editingNickname ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={nicknameInput}
                        onChange={e => setNicknameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); if (e.key === 'Escape') { setEditingNickname(false); setNicknameInput(savedNickname); } }}
                        placeholder="Custom name (only you see this)"
                        maxLength={40}
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                      <button onClick={handleSaveNickname} className="p-1.5 gradient-primary text-white rounded-lg hover:opacity-90" title="Save">
                        <Check size={14} />
                      </button>
                      <button onClick={() => { setEditingNickname(false); setNicknameInput(savedNickname); }} className="p-1.5 glass border border-border text-muted-foreground rounded-lg hover:bg-muted" title="Cancel">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-foreground truncate">{foundChat.name}</p>
                      <button
                        onClick={() => { setEditingNickname(true); setNicknameInput(savedNickname); }}
                        className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0"
                        title="Set a custom name (only visible to you in Secured Chats)"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground truncate">{foundChat.lastMessage}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <Lock size={16} className="text-vt-green" />
                </div>
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

              <button
                onClick={() => { setDeleteStep('confirm'); setDeletePin(''); }}
                className="w-full mt-2 py-2.5 rounded-xl border border-vt-red/40 text-vt-red text-sm font-semibold flex items-center justify-center gap-2 hover:bg-vt-red/10 transition-all"
              >
                <Trash2 size={14} />
                <span>Delete all Secured Chats</span>
              </button>
            </div>
          ) : (
            /* Pattern Input */
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Draw Your Pattern</p>
              <p className="text-xs text-muted-foreground mb-4">Drag across the dots in the same order you used when securing the chat.</p>
              <PatternLock
                size={240}
                value={patternSelected}
                onChange={(next) => { setPatternSelected(next); setError(''); }}
                onComplete={async (final) => {
                  if (final.length < 4 || !user) return;
                  const patternCode = final.join('-');
                  try {
                    const { data: marks } = await supabase
                      .from('user_secure_chats')
                      .select('chat_id')
                      .eq('user_id', user.id)
                      .eq('code', patternCode);
                    if (marks && marks.length > 0) {
                      const chatId = marks[0].chat_id as string;
                      const { data: chat } = await supabase
                        .from('chats')
                        .select('id, participant_one, participant_two')
                        .eq('id', chatId)
                        .single();
                      if (!chat) throw new Error('Chat not found');
                      const otherUserId = chat.participant_one === user.id ? chat.participant_two : chat.participant_one;
                      const { data: otherUser } = await supabase
                        .from('user_profiles').select('full_name').eq('id', otherUserId).single();
                      const realName = otherUser?.full_name || 'Secure Contact';
                      const nickname = getPreferredNickname(user.id, otherUserId);
                      const displayName = nickname || realName;
                      setFoundChat({
                        id: chat.id, name: displayName,
                        avatar: displayName[0]?.toUpperCase() || 'S',
                        lastMessage: 'Secure conversation',
                        code: patternCode, otherUserId,
                      });
                      setError('');
                      toast.success(`Opening secure chat with ${displayName}`);
                    } else {
                      setAttempts(a => a + 1);
                      setError('Pattern does not match any secured chat for your account.');
                      triggerShake();
                      setTimeout(() => setPatternSelected([]), 600);
                    }
                  } catch {
                    setError('Unable to verify pattern. Please try again.');
                    triggerShake();
                  }
                }}
              />

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
              <button
                onClick={() => { setDeleteStep('confirm'); setDeletePin(''); }}
                className="w-full mt-2 py-2.5 rounded-xl border border-vt-red/40 text-vt-red text-sm font-semibold flex items-center justify-center gap-2 hover:bg-vt-red/10 transition-all"
              >
                <Trash2 size={14} />
                <span>Delete all Secured Chats</span>
              </button>
            </div>
          )}
        </div>

        {/* Delete-all overlay */}
        {deleteStep && (
          <div className="absolute inset-0 z-10 bg-background/85 backdrop-blur-md flex items-center justify-center p-5">
            <div className="w-full max-w-sm glass-strong rounded-2xl border border-vt-red/30 p-5 float-up">
              {deleteStep === 'confirm' ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-vt-red/15 flex items-center justify-center">
                      <AlertTriangle size={18} className="text-vt-red" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Delete all secured chats?</h3>
                      <p className="text-[11px] text-muted-foreground">This permanently removes every chat you have marked as secured — from your device and the database. This cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setDeleteStep(null); setDeletePin(''); }}
                      className="flex-1 py-2.5 rounded-xl glass border border-border text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setDeleteStep('pin')}
                      className="flex-1 py-2.5 rounded-xl bg-vt-red text-white text-sm font-semibold hover:opacity-90"
                    >
                      Yes, delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <Lock size={18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">Enter Encryption PIN</h3>
                      <p className="text-[11px] text-muted-foreground">Type the 6-digit E2E PIN you created at sign-up to confirm.</p>
                    </div>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={deletePin}
                    onChange={(e) => setDeletePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                    placeholder="6-digit PIN"
                    style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                    className="w-full bg-input border border-border rounded-xl px-4 py-3 text-center text-xl tracking-[0.4em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setDeleteStep(null); setDeletePin(''); }}
                      disabled={deleteBusy}
                      className="flex-1 py-2.5 rounded-xl glass border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={deleteBusy || deletePin.length !== 6}
                      className="flex-1 py-2.5 rounded-xl bg-vt-red text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {deleteBusy ? 'Deleting…' : 'Delete all'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}