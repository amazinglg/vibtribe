// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Send, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { encryptMessage, encryptGroupMessage, encryptBytes, encryptBytesWithRandomKey, hasLocalPrivateKey, type GroupMember } from '@/lib/encryption';

export interface ForwardAttachment {
  blob: Blob;
  mime: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'file';
}

interface Target {
  /** Stable list key. Existing chats use the chat id, contacts use `u:<userId>`. */
  key: string;
  chatId: string | null;
  name: string;
  avatarUrl: string | null;
  isGroup: boolean;
  // For 1:1: other participant id
  otherUserId?: string | null;
  /** Saved contact with no existing conversation yet. */
  isNew?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: string[]; // plaintext strings to forward
  attachments?: ForwardAttachment[]; // decrypted media to re-encrypt per target
}

const MAX_TARGETS = 10;

export default function ForwardMessageModal({ isOpen, onClose, messages, attachments = [] }: Props) {
  const { user } = useAuth();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !user) return;
    setSelected(new Set());
    setQuery('');
    setLoading(true);
    (async () => {
      try {
        // Recent chats the user belongs to
        const { data: myMemberships } = await supabase
          .from('chat_members').select('chat_id').eq('user_id', user.id);
        const memberChatIds = (myMemberships || []).map((r: any) => r.chat_id);
        const { data: chats } = await supabase
          .from('chats')
          .select('id, name, avatar_url, is_group, participant_one, participant_two, updated_at')
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}${memberChatIds.length ? `,id.in.(${memberChatIds.join(',')})` : ''}`)
          .order('updated_at', { ascending: false })
          .limit(50);
        const otherIds = new Set<string>();
        (chats || []).forEach((c: any) => {
          if (!c.is_group) {
            const other = c.participant_one === user.id ? c.participant_two : c.participant_one;
            if (other) otherIds.add(other);
          }
        });
        let profMap: Record<string, any> = {};
        if (otherIds.size > 0) {
          const { data: profs } = await supabase
            .from('user_profiles').select('id, full_name, avatar_url')
            .in('id', Array.from(otherIds));
          (profs || []).forEach((p: any) => { profMap[p.id] = p; });
        }
        const out: Target[] = (chats || []).map((c: any) => {
          if (c.is_group) {
            return { key: c.id, chatId: c.id, name: c.name || 'Tribe', avatarUrl: c.avatar_url, isGroup: true };
          }
          const other = c.participant_one === user.id ? c.participant_two : c.participant_one;
          const p = profMap[other] || {};
          return { key: c.id, chatId: c.id, name: p.full_name || 'Contact', avatarUrl: p.avatar_url, isGroup: false, otherUserId: other };
        });

        // Saved contacts that don't have a conversation yet — the chat is
        // created lazily when the user actually forwards to them.
        try {
          const { data: saved } = await supabase
            .from('contacts')
            .select('contact_id, contact_name')
            .eq('user_id', user.id);
          const savedIds = [...new Set((saved || []).map((r: any) => r.contact_id).filter(Boolean))];
          const alreadyListed = new Set(out.filter(t => !t.isGroup).map(t => t.otherUserId));
          const missing = savedIds.filter((id: string) => !alreadyListed.has(id));
          if (missing.length) {
            const { data: profs } = await supabase.rpc('get_my_saved_contact_profiles', { _ids: missing });
            const nameByID: Record<string, string> = {};
            (saved || []).forEach((r: any) => { if (r.contact_name) nameByID[r.contact_id] = r.contact_name; });
            (profs || []).forEach((p: any) => {
              out.push({
                key: `u:${p.id}`,
                chatId: null,
                name: nameByID[p.id] || p.full_name || 'Saved contact',
                avatarUrl: p.avatar_url || null,
                isGroup: false,
                otherUserId: p.id,
                isNew: true,
              });
            });
          }
        } catch { /* contacts are optional */ }

        // Apply avatar-privacy for 1:1 targets (group avatars are public).
        try {
          const { applyAvatarPrivacy } = await import('@/lib/visible-avatars');
          setTargets(await applyAvatarPrivacy(out, 'otherUserId' as any, 'avatarUrl' as any));
        } catch { setTargets(out); }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load contacts');
      } finally { setLoading(false); }
    })();
  }, [isOpen, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(t => t.name.toLowerCase().includes(q));
  }, [targets, query]);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); return next; }
      if (next.size >= MAX_TARGETS) {
        toast.error(`You can forward to up to ${MAX_TARGETS} chats at once`);
        return next;
      }
      next.add(key);
      return next;
    });
  };

  const send = async () => {
    if (!user || selected.size === 0 || (messages.length === 0 && attachments.length === 0)) return;
    const ok = await hasLocalPrivateKey();
    if (!ok) { toast.error('Unlock your encryption PIN first'); return; }
    setSending(true);
    let okCount = 0;
    let failCount = 0;
    for (const key of Array.from(selected)) {
      const tgt = targets.find(t => t.key === key);
      if (!tgt) continue;
      try {
        // Lazily create the 1:1 conversation for saved contacts with no chat.
        let chatId = tgt.chatId;
        if (!chatId && tgt.otherUserId) {
          const { data: existing } = await supabase
            .from('chats')
            .select('id')
            .or(`and(participant_one.eq.${user.id},participant_two.eq.${tgt.otherUserId}),and(participant_one.eq.${tgt.otherUserId},participant_two.eq.${user.id})`)
            .maybeSingle();
          if (existing?.id) chatId = existing.id;
          else {
            const { data: created, error: createErr } = await supabase
              .from('chats')
              .insert({ participant_one: user.id, participant_two: tgt.otherUserId, chat_type: 'normal' })
              .select('id')
              .single();
            if (createErr || !created?.id) { failCount++; continue; }
            chatId = created.id;
          }
        }
        if (!chatId) { failCount++; continue; }
        let members: GroupMember[] = [];
        let otherPk: string | null = null;
        if (tgt.isGroup) {
          const { data: mrows } = await supabase.from('chat_members').select('user_id').eq('chat_id', chatId);
          const ids = (mrows || []).map((r: any) => r.user_id);
          if (ids.length) {
            const { data: profs } = await supabase.from('user_profiles').select('id, public_key').in('id', ids);
            members = (profs || []).filter((p: any) => !!p.public_key).map((p: any) => ({ userId: p.id, publicKey: p.public_key }));
          }
        } else if (tgt.otherUserId) {
          const { data: prof } = await supabase.from('user_profiles').select('public_key').eq('id', tgt.otherUserId).single();
          otherPk = prof?.public_key || null;
          if (!otherPk) { failCount++; continue; }
        }
        for (const text of messages) {
          let content = text;
          if (tgt.isGroup) {
            if (members.length === 0) { failCount++; continue; }
            content = await encryptGroupMessage(text, members);
          } else if (otherPk) {
            content = await encryptMessage(text, otherPk);
          }
          await supabase.from('messages').insert({ chat_id: chatId, sender_id: user.id, content, message_status: 'sent' });
        }

        // Media: re-encrypt + re-upload for each target so the recipient can
        // actually decrypt it (media keys are per-conversation).
        for (const att of attachments) {
          const plainBuf = await att.blob.arrayBuffer();
          let uploadBody: Blob = att.blob;
          let ext = att.name.includes('.') ? att.name.split('.').pop() : 'bin';
          let mediaKey: string | null = null;
          const useGroup = tgt.isGroup && members.length > 0;
          const use1to1 = !tgt.isGroup && !!otherPk;
          if (use1to1) {
            const cipher = await encryptBytes(plainBuf, otherPk as string);
            uploadBody = new Blob([cipher], { type: 'application/octet-stream' });
            ext = 'enc';
          } else if (useGroup) {
            const { keyB64, cipher } = await encryptBytesWithRandomKey(plainBuf);
            mediaKey = keyB64;
            uploadBody = new Blob([cipher], { type: 'application/octet-stream' });
            ext = 'enc';
          } else { failCount++; continue; }

          const safeName = att.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${user.id}/${chatId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('chat-media')
            .upload(filePath, uploadBody, { upsert: true, contentType: 'application/octet-stream' });
          if (upErr) { failCount++; continue; }
          const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
          const publicUrl = urlData?.publicUrl || '';
          const envelope = `__media__:${JSON.stringify(
            useGroup
              ? { type: att.type, url: publicUrl, mime: att.mime, name: att.name, k: mediaKey, gk: true }
              : { type: att.type, url: publicUrl, mime: att.mime, name: att.name },
          )}`;
          const content = useGroup
            ? await encryptGroupMessage(envelope, members)
            : await encryptMessage(envelope, otherPk as string);
          await supabase.from('messages').insert({ chat_id: chatId, sender_id: user.id, content, message_status: 'sent' });
        }

        await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
        okCount++;
      } catch (err: any) {
        failCount++;
      }
    }
    setSending(false);
    if (okCount > 0) toast.success(`Forwarded to ${okCount} chat${okCount > 1 ? 's' : ''}${failCount ? ` · ${failCount} failed` : ''}`);
    else toast.error('Failed to forward');
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[1800] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      style={{ paddingBottom: 'calc(var(--mobile-bottom-nav-offset, 0px) + 1rem)' }}
      onClick={onClose}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-card float-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Forward to…</h3>
            <p className="text-[11px] text-muted-foreground">
              {messages.length + attachments.length} item{messages.length + attachments.length > 1 ? 's' : ''} · {selected.size}/{MAX_TARGETS} selected
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
            <Search size={14} className="text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chats & contacts…" className="flex-1 bg-transparent text-sm outline-none text-foreground" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No chats found</p>
          ) : filtered.map(t => {
            const isSel = selected.has(t.key);
            return (
              <button key={t.key} onClick={() => toggle(t.key)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left">
                {t.avatarUrl ? (
                  <img src={t.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {t.isGroup ? <Users size={16} /> : (t.name[0]?.toUpperCase() || '?')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.isGroup ? 'Tribe' : t.isNew ? 'Saved contact' : 'Recent chat'}</p>
                </div>
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSel ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                  {isSel && <Check size={14} />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm bg-muted text-foreground" disabled={sending}>Cancel</button>
          <button onClick={send} disabled={sending || selected.size === 0} className="flex-1 py-2 rounded-lg text-sm bg-primary text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Send size={14} /> {sending ? 'Sending…' : `Forward (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}