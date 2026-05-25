// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Trash2, Smile, BadgeCheck } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export const BROADCAST_CHAT_ID = '__vibtribe_broadcast__';
const LOGO_URL = '/assets/images/app_logo.png';
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

interface BMessage {
  id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  reactions: { emoji: string; user_id: string }[];
}

export default function BroadcastChatPanel() {
  const { setSelectedChatId } = useChatStore();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const isMaster = !!profile?.is_master_admin || profile?.role === 'master_admin';

  const [messages, setMessages] = useState<BMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: msgs } = await supabase
      .from('broadcast_messages')
      .select('id, sender_id, content, attachment_url, attachment_type, created_at')
      .order('created_at', { ascending: true });
    const ids = (msgs || []).map((m) => m.id);
    let reactions: any[] = [];
    if (ids.length) {
      const { data: r } = await supabase
        .from('broadcast_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', ids);
      reactions = r || [];
    }
    const merged: BMessage[] = (msgs || []).map((m: any) => ({
      ...m,
      reactions: reactions.filter((r) => r.message_id === m.id).map((r) => ({ emoji: r.emoji, user_id: r.user_id })),
    }));
    setMessages(merged);
    try {
      if (typeof window !== 'undefined' && merged.length) {
        localStorage.setItem('vt_broadcast_last_read', merged[merged.length - 1].created_at);
        window.dispatchEvent(new Event('vt-broadcast-read'));
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('broadcast-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_reactions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isMaster || !user) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    const { error } = await supabase
      .from('broadcast_messages')
      .insert({ sender_id: user.id, content: text });
    if (error) {
      toast.error('Failed to send: ' + error.message);
      setInput(text);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    if (!isMaster) return;
    if (!confirm('Permanently delete this broadcast for everyone? This cannot be undone.')) return;
    const { error } = await supabase.from('broadcast_messages').delete().eq('id', id);
    if (error) toast.error('Delete failed: ' + error.message);
    else setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find((m) => m.id === msgId);
    const has = msg?.reactions.some((r) => r.user_id === user.id && r.emoji === emoji);
    if (has) {
      await supabase
        .from('broadcast_reactions')
        .delete()
        .eq('message_id', msgId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from('broadcast_reactions')
        .insert({ message_id: msgId, user_id: user.id, emoji });
    }
    setPickerFor(null);
  };

  const formatTime = (s: string) => {
    const d = new Date(s);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 gradient-bg-page">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-border glass-strong">
        <button onClick={() => setSelectedChatId(null)} className="lg:hidden p-1.5 hover:bg-muted rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <img src={LOGO_URL} alt="VibTribe" className="w-10 h-10 rounded-full object-cover border border-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-bold text-sm text-foreground truncate">VibTribe</p>
            <BadgeCheck size={14} className="text-primary fill-primary/20" />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Official VibTribe Account</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 opacity-60">
            <img src={LOGO_URL} alt="" className="w-16 h-16 rounded-full opacity-80" />
            <p className="text-sm font-semibold text-foreground">Welcome to VibTribe</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Official announcements from VibTribe will appear here.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const grouped = m.reactions.reduce<Record<string, number>>((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {});
            const myReactions = new Set(m.reactions.filter((r) => r.user_id === user?.id).map((r) => r.emoji));
            return (
              <div key={m.id} className="flex flex-col items-start max-w-[85%] group">
                <div className="relative bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                  </div>
                  {/* Action bar */}
                  <div className="absolute -top-3 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                      className="p-1 bg-background border border-border rounded-full shadow"
                      aria-label="React"
                    >
                      <Smile size={12} />
                    </button>
                    {isMaster && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1 bg-background border border-border rounded-full shadow text-red-400"
                        aria-label="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {pickerFor === m.id && (
                  <div className="mt-1 flex flex-wrap gap-1 p-1.5 bg-background border border-border rounded-full shadow">
                    {REACTION_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(m.id, e)}
                        className={`text-lg hover:scale-125 transition-transform px-1 ${myReactions.has(e) ? 'opacity-100' : 'opacity-80'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                {Object.keys(grouped).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-1">
                    {Object.entries(grouped).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(m.id, emoji)}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border ${
                          myReactions.has(emoji)
                            ? 'bg-primary/20 border-primary/50 text-foreground'
                            : 'bg-card border-border text-muted-foreground'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="font-semibold">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {isMaster ? (
        <div className="border-t border-border p-3 glass-strong">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Broadcast to all VibTribe users..."
              rows={1}
              className="flex-1 resize-none bg-input border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-2.5 gradient-primary rounded-full text-white disabled:opacity-40 hover:opacity-90 transition-all glow-primary"
              aria-label="Send broadcast"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            This message will be sent to all VibTribe users.
          </p>
        </div>
      ) : (
        <div className="border-t border-border p-4 glass-strong text-center">
          <p className="text-xs text-muted-foreground italic">
            Only VibTribe can post comments here.
          </p>
        </div>
      )}
    </div>
  );
}