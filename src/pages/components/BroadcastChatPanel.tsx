// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, Trash2, Smile, BadgeCheck, Paperclip, Pencil, Copy, Share2, X, MoreVertical, Plus } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { isNativeWrapper, pickNativeFiles } from '@/lib/native-bridge';
import Wordmark from '@/components/ui/Wordmark';
import ImageCropModal from '@/components/ImageCropModal';
import { EMOJI_CATEGORIES, type EmojiCategoryKey } from '@/lib/emojis';
import { appConfirm } from '@/components/ui/AppDialog';
import { VIBTRIBE_EMOJI_MAP } from '@/lib/vibtribe-emojis';

export const BROADCAST_CHAT_ID = '__vibtribe_broadcast__';
const FALLBACK_LOGO = '/assets/images/app_logo.png';
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
  const [fullPickerFor, setFullPickerFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Broadcast avatar — master admin can change it for everyone. Read from
  // app_settings.broadcast_avatar_url. Falls back to the bundled logo.
  const [broadcastAvatar, setBroadcastAvatar] = useState<string>(FALLBACK_LOGO);
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [emojiTab, setEmojiTab] = useState<EmojiCategoryKey>('vibtribe');

  const allReactionEmojis = useMemo(() => EMOJI_CATEGORIES.find((c) => c.key === emojiTab)?.emojis || [], [emojiTab]);

  const loadBroadcastAvatar = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'broadcast_avatar_url')
      .maybeSingle();
    if (data?.value) setBroadcastAvatar(String(data.value));
  };

  const uploadAvatarBlob = async (blob: Blob) => {
    if (!isMaster || !user) return;
    setAvatarBusy(true);
    try {
      const path = `broadcast/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, blob, {
        upsert: true, contentType: 'image/jpeg', cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: rpcErr } = await supabase.rpc('set_broadcast_avatar', { _url: url });
      if (rpcErr) throw rpcErr;
      setBroadcastAvatar(url);
      toast.success('Broadcast avatar updated');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update avatar');
    } finally {
      setAvatarBusy(false);
      if (avatarUploadRef.current) avatarUploadRef.current.value = '';
    }
  };

  const handleAvatarPick = (file: File) => {
    if (!isMaster || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be under 8MB'); return; }
    setAvatarCropFile(file);
  };

  const handleAvatarClick = async () => {
    if (!isMaster || avatarBusy) return;
    if (isNativeWrapper()) {
      try {
        const picked = await pickNativeFiles({ multiple: false, types: ['image/*'] });
        if (!picked.length) return;
        const p = picked[0];
        if (!p.dataUrl) {
          toast.error('Could not read the selected image. Try a smaller file.');
          return;
        }
        const res = await fetch(p.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], p.name || 'avatar.jpg', { type: p.mime || blob.type || 'image/jpeg' });
        handleAvatarPick(file);
      } catch (e: any) {
        console.error('[VT-Broadcast] native avatar pick failed', e);
        toast.error('Could not open picker: ' + (e?.message || 'unknown'));
      }
      return;
    }
    avatarUploadRef.current?.click();
  };

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
    loadBroadcastAvatar();
    const ch = supabase
      .channel('broadcast-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_reactions' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, () => loadBroadcastAvatar())
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
    if (editingId) {
      const id = editingId;
      setEditingId(null);
      const { error } = await supabase
        .from('broadcast_messages')
        .update({ content: text })
        .eq('id', id);
      if (error) {
        toast.error('Edit failed: ' + error.message);
        setInput(text);
        setEditingId(id);
      } else {
        toast.success('Message updated');
      }
    } else {
      const { error } = await supabase
        .from('broadcast_messages')
        .insert({ sender_id: user.id, content: text });
      if (error) {
        toast.error('Failed to send: ' + error.message);
        setInput(text);
      }
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    if (!isMaster) return;
    const ok = await appConfirm({
      title: 'Delete broadcast?',
      message: 'This will permanently delete this broadcast for everyone. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('broadcast_messages').delete().eq('id', id);
    if (error) toast.error('Delete failed: ' + error.message);
    else setMessages((prev) => prev.filter((m) => m.id !== id));
    setMenuFor(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
    setMenuFor(null);
  };

  const handleShare = async (m: BMessage) => {
    const shareData: any = { text: m.content, title: 'VibTribe' };
    if (m.attachment_url) shareData.url = m.attachment_url;
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(m.content + (m.attachment_url ? `\n${m.attachment_url}` : ''));
        toast.success('Copied — share anywhere');
      }
    } catch {}
    setMenuFor(null);
  };

  const handleEdit = (m: BMessage) => {
    if (!isMaster) return;
    setEditingId(m.id);
    setInput(m.content);
    setMenuFor(null);
  };

  const handleAttach = async (file: File) => {
    if (!isMaster || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      // Broadcast media is admin-published content visible to every VibTribe
      // user; upload to the public `profile-photos` bucket so recipients can
      // load it via a plain <img>. The private `chat-media` bucket is now
      // reserved for participant-only 1:1 / tribe chat attachments.
      const path = `${user.id}/broadcasts/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, file, {
        contentType: file.type,
         upsert: false,
         cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
      const { error: insErr } = await supabase.from('broadcast_messages').insert({
        sender_id: user.id,
        content: input.trim() || '',
        attachment_url: `${pub.publicUrl}?v=${Date.now()}`,
        attachment_type: type,
      });
      if (insErr) throw insErr;
      setInput('');
      toast.success('Media sent');
    } catch (e: any) {
      toast.error('Upload failed: ' + (e?.message || 'unknown'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  const formatDateLabel = (s: string) => {
    const d = new Date(s);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  };
  const dayKey = (s: string) => {
    const d = new Date(s);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const handleAttachClick = async () => {
    if (isNativeWrapper()) {
      try {
        const picked = await pickNativeFiles({
          multiple: false,
          types: ['image/*', 'video/*', 'application/pdf'],
        });
        if (!picked.length) {
          toast.message('No file selected');
          return;
        }
        const p = picked[0];
        if (!p.dataUrl) {
          toast.error('Could not read the selected file. Try a smaller file or pick a photo from your gallery.');
          return;
        }
        const res = await fetch(p.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], p.name, { type: p.mime || blob.type || 'application/octet-stream' });
        await handleAttach(file);
      } catch (e: any) {
        console.error('[VT-Broadcast] native pick failed', e);
        toast.error('Could not open file picker: ' + (e?.message || 'unknown'));
      }
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <>
    <div className="flex-1 flex flex-col h-full min-w-0 gradient-bg-page">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-border glass-strong">
        <button onClick={() => setSelectedChatId(null)} className="lg:hidden p-1.5 hover:bg-muted rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div className="relative">
          <img
            src={broadcastAvatar}
            alt="VibTribe"
            onClick={handleAvatarClick}
            className={`w-10 h-10 rounded-full object-cover border border-border ${isMaster ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            title={isMaster ? 'Tap to change broadcast avatar (everyone sees this)' : undefined}
          />
          {isMaster && (
            <>
              <input
                ref={avatarUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarPick(f);
                }}
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                aria-label="Change broadcast avatar"
                title="Change broadcast avatar"
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground shadow-md border border-background flex items-center justify-center hover:scale-110 transition-transform"
              >
                <Pencil size={10} />
              </button>
            </>
          )}
          {avatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full text-[10px] text-white">…</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Wordmark className="text-sm truncate" />
            <BadgeCheck size={14} className="text-primary fill-primary/20" />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Official VibTribe Account</p>
        </div>
        {isMaster && (
          null
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 opacity-60">
            <img src={broadcastAvatar} alt="" className="w-16 h-16 rounded-full opacity-80" />
            <p className="text-sm font-semibold text-foreground">Welcome to VibTribe</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Official announcements from VibTribe will appear here.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDate = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const grouped = m.reactions.reduce<Record<string, number>>((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {});
            const myReactions = new Set(m.reactions.filter((r) => r.user_id === user?.id).map((r) => r.emoji));
            return (
              <React.Fragment key={m.id}>
              {showDate && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-background/70 border border-border text-muted-foreground">
                    {formatDateLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className="flex flex-col items-start max-w-[85%] group">
                <div className="relative bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                  {m.attachment_url && m.attachment_type === 'image' && (
                    <img src={m.attachment_url} alt="" className="rounded-lg mb-2 max-h-64 object-cover" />
                  )}
                  {m.attachment_url && m.attachment_type === 'video' && (
                    <video src={m.attachment_url} controls className="rounded-lg mb-2 max-h-64 w-full" />
                  )}
                  {m.attachment_url && m.attachment_type !== 'image' && m.attachment_type !== 'video' && (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block text-xs text-primary underline mb-2 break-all">
                      {m.attachment_url.split('/').pop()}
                    </a>
                  )}
                  {m.content && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.content}</p>}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                  </div>
                  {/* Action bar — always visible on mobile */}
                  <div className="absolute -top-3 right-1 flex items-center gap-1">
                    <button
                      onClick={() => { setPickerFor(pickerFor === m.id ? null : m.id); setFullPickerFor(null); setMenuFor(null); }}
                      className="p-1 bg-background border border-border rounded-full shadow"
                      aria-label="React"
                    >
                      <Smile size={12} />
                    </button>
                    <button
                      onClick={() => { setMenuFor(menuFor === m.id ? null : m.id); setPickerFor(null); setFullPickerFor(null); }}
                      className="p-1 bg-background border border-border rounded-full shadow"
                      aria-label="More"
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>
                </div>
                {menuFor === m.id && (
                  <div className="mt-1 flex flex-wrap gap-1 p-1.5 bg-background border border-border rounded-2xl shadow text-xs">
                    <button onClick={() => handleCopy(m.content)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted">
                      <Copy size={12} /> Copy
                    </button>
                    <button onClick={() => handleShare(m)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted">
                      <Share2 size={12} /> Share
                    </button>
                    {isMaster && (
                      <>
                        <button onClick={() => handleEdit(m)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted">
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted text-red-400">
                          <Trash2 size={12} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
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
                    <button
                      onClick={() => { setFullPickerFor(m.id); setPickerFor(null); }}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-border bg-card hover:bg-muted transition-colors"
                      type="button"
                      aria-label="More reactions"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
                {fullPickerFor === m.id && (
                  <div className="mt-2 p-2 bg-background border border-border rounded-2xl shadow space-y-2 max-w-[17rem]">
                    <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto no-scrollbar">
                      {EMOJI_CATEGORIES.map(cat => (
                        <button
                          key={cat.key}
                          onClick={() => setEmojiTab(cat.key)}
                          className={`flex-shrink-0 px-2 py-1 rounded-lg text-sm transition-all ${emojiTab === cat.key ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          aria-label={cat.label}
                          title={cat.label}
                          type="button"
                        >
                          {cat.icon}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                      {allReactionEmojis.map((emoji, i) => {
                        const vtMatch = /^:vt:([a-z0-9_-]+):$/.exec(emoji);
                        const vt = vtMatch ? VIBTRIBE_EMOJI_MAP[vtMatch[1]] : null;
                        return (
                          <button
                            key={`${emoji}-${i}`}
                            onClick={() => toggleReaction(m.id, emoji)}
                            className="aspect-square flex items-center justify-center text-xl rounded-lg hover:bg-muted active:scale-90 transition-all p-1"
                            type="button"
                            aria-label={vt?.name || emoji}
                            title={vt?.name || emoji}
                          >
                            {vt ? (
                              <img
                                src={vt.url}
                                alt={vt.name}
                                draggable={false}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain select-none"
                              />
                            ) : (
                              emoji
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {Object.keys(grouped).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-1">
                    {Object.entries(grouped).map(([emoji, count]) => {
                      const vtMatch = /^:vt:([a-z0-9_-]+):$/.exec(emoji);
                      const vt = vtMatch ? VIBTRIBE_EMOJI_MAP[vtMatch[1]] : null;
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(m.id, emoji)}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border ${
                            myReactions.has(emoji)
                              ? 'bg-primary/20 border-primary/50 text-foreground'
                              : 'bg-card border-border text-muted-foreground'
                          }`}
                        >
                          {vt ? (
                            <img src={vt.url} alt={vt.name} className="w-4 h-4 select-none" draggable={false} loading="lazy" decoding="async" />
                          ) : (
                            <span>{emoji}</span>
                          )}
                          <span className="font-semibold">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Footer */}
      {isMaster ? (
        <div className="border-t border-border p-3 glass-strong">
          {editingId && (
            <div className="flex items-center justify-between mb-2 px-2 py-1 rounded-lg bg-primary/10 border border-primary/30 text-xs">
              <span className="text-primary font-medium">Editing message</span>
              <button
                onClick={() => { setEditingId(null); setInput(''); }}
                className="p-1 rounded hover:bg-muted"
                aria-label="Cancel edit"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,application/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAttach(f);
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAttachClick();
              }}
              disabled={uploading || !!editingId}
              className="p-2.5 rounded-full bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Attach media"
              title="Attach photo, video, or document"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={editingId ? 'Edit message...' : 'Broadcast to all VibTribe users...'}
              rows={1}
              className="flex-1 resize-none bg-input border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || uploading}
              className="p-2.5 gradient-primary rounded-full text-white disabled:opacity-40 hover:opacity-90 transition-all glow-primary"
              aria-label={editingId ? 'Save edit' : 'Send broadcast'}
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
      <ImageCropModal
        isOpen={!!avatarCropFile}
        file={avatarCropFile}
        onClose={() => setAvatarCropFile(null)}
        onCropped={async (blob) => { setAvatarCropFile(null); await uploadAvatarBlob(blob); }}
        aspect={1}
        title="Crop Broadcast Avatar"
        output={{ width: 512, height: 512, mime: 'image/jpeg', quality: 0.9 }}
      />
    </>
  );
}