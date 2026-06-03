// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Lock, Users, UserPlus, MessageSquare, Phone, Check } from 'lucide-react';
import MarkSecureModal from '@/components/MarkSecureModal';
import ContactsPanel from '@/components/ContactsPanel';
import CreateGroupModal from '@/components/CreateGroupModal';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { decryptMessage, isEncrypted } from '@/lib/encryption';
import { BROADCAST_CHAT_ID } from './BroadcastChatPanel';
import { useT } from '@/contexts/LanguageContext';
import { isNativeWrapper, requestNativeContactsPermission } from '@/lib/native-bridge';
const BROADCAST_LOGO = '/assets/images/app_logo.png';

interface Chat {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  avatarUrl?: string | null;
  lastMessage: string;
  time: string;
  rawTime?: string;
  unread: number;
  online: boolean;
  typing: boolean;
  pinned: boolean;
  muted: boolean;
  isGroup?: boolean;
  hasMedia?: boolean;
  participantId?: string;
  isBroadcast?: boolean;
}

export default function ChatListPanel() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'groups' | 'contacts'>('all');
  const [secureModalOpen, setSecureModalOpen] = useState(false);
  const [secureTarget, setSecureTarget] = useState<{ id: string; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const CHATS_CACHE_KEY = 'vt_chats_cache_v1';
  const [chats, setChats] = useState<Chat[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem(CHATS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Chat[]) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return !sessionStorage.getItem(CHATS_CACHE_KEY); } catch { return true; }
  });
  const [contactsOpen, setContactsOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  // ===== Contacts tab state =====
  const [contactsPerm, setContactsPerm] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [inviteTarget, setInviteTarget] = useState<any | null>(null);
  const { selectedChatId, setSelectedChatId } = useChatStore();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [broadcastPreview, setBroadcastPreview] = useState<{ content: string; created_at: string } | null>(null);
  const [broadcastUnread, setBroadcastUnread] = useState(0);

  const loadBroadcastPreview = async () => {
    if (!user) return;
    const { data: latest } = await supabase
      .from('broadcast_messages')
      .select('content, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setBroadcastPreview(latest || null);
    try {
      const lastRead = typeof window !== 'undefined' ? localStorage.getItem('vt_broadcast_last_read') : null;
      if (latest && (!lastRead || new Date(latest.created_at) > new Date(lastRead))) {
        const { count } = await supabase
          .from('broadcast_messages')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastRead || '1970-01-01');
        setBroadcastUnread(count || 0);
      } else {
        setBroadcastUnread(0);
      }
    } catch { setBroadcastUnread(0); }
  };

  useEffect(() => {
    if (!user) return;
    loadBroadcastPreview();
    const onRead = () => loadBroadcastPreview();
    window.addEventListener('vt-broadcast-read', onRead);
    const ch = supabase
      .channel('chatlist-broadcast')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_messages' }, () => loadBroadcastPreview())
      .subscribe();
    return () => {
      window.removeEventListener('vt-broadcast-read', onRead);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadChats();
      loadSavedContacts();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const handleUnlocked = () => loadChats();
    window.addEventListener('vt-encryption-unlocked', handleUnlocked);
    return () => window.removeEventListener('vt-encryption-unlocked', handleUnlocked);
  }, [user?.id]);

  useEffect(() => {
    const refreshContacts = () => loadSavedContacts();
    window.addEventListener('vt-contacts-changed', refreshContacts);
    return () => window.removeEventListener('vt-contacts-changed', refreshContacts);
  }, [user?.id]);

  const loadSavedContacts = async () => {
    if (!user?.id) return [];
    setContactsLoading(true);
    try {
      const { data: saved, error } = await supabase
        .from('contacts')
        .select('contact_id, contact_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = [...new Set((saved || []).map((row: any) => row.contact_id).filter(Boolean))];
      const profileMap = new Map<string, any>();
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, mobile_number, avatar_url, profile_photo_visibility')
          .in('id', ids);
        for (const p of (profiles || [])) profileMap.set(p.id, p);
      }

      const rows = (saved || []).map((row: any) => {
        const p = profileMap.get(row.contact_id);
        const name = row.contact_name || p?.full_name || 'Saved contact';
        return {
          name,
          phone: p?.mobile_number || '',
          onPlatform: true,
          userId: row.contact_id,
          avatar: name[0]?.toUpperCase() || 'U',
          avatarUrl: (p?.profile_photo_visibility ?? 'all') === 'all' ? (p?.avatar_url || null) : null,
          saved: true,
        };
      });
      setContactsList(rows);
      if (rows.length > 0) setContactsPerm('granted');
      return rows;
    } catch (err) {
      console.error('load saved contacts', err);
      return [];
    } finally {
      setContactsLoading(false);
    }
  };

  // Lightweight realtime: refresh chat list when a new message hits any chat.
  // Debounced so high-traffic chats don't trigger a flood of refetches.
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadChats(), 600);
    };
    const channel = supabase
      .channel(`chatlist-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, debouncedReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, debouncedReload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, debouncedReload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, debouncedReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, debouncedReload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chats' }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_secure_chats', filter: `user_id=eq.${user.id}` }, debouncedReload)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadChats = async () => {
    if (!user) return;
    // Only show the skeleton on the very first load. Background refreshes
    // (realtime updates, tab returns) should refresh data silently.
    if (chats.length === 0) setLoading(true);
    try {
      // Chats the current user has moved to their Secure Vault — hide entirely
      // from the normal chat list. They only appear after the user unlocks
      // them via the vault PIN/pattern.
      const { data: securedMarks } = await supabase
        .from('user_secure_chats')
        .select('chat_id')
        .eq('user_id', user.id);
      const securedSet = new Set((securedMarks || []).map((m: any) => m.chat_id));

      // 1:1 chats where I'm a participant
      const { data: oneToOne, error: oneErr } = await supabase
        .from('chats')
        .select(`
          id, chat_type, participant_one, participant_two, is_group, name, updated_at,
          messages(id, content, created_at, sender_id, message_status)
        `)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .eq('is_group', false)
        .order('updated_at', { ascending: false });
      if (oneErr) throw oneErr;

      // Group chats I'm a member of
      const { data: myMemberships } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id);
      const groupIds = (myMemberships || []).map(m => m.chat_id);
      let groups: any[] = [];
      if (groupIds.length) {
        const { data: gData } = await supabase
          .from('chats')
          .select(`
            id, chat_type, is_group, name, updated_at,
            messages(id, content, created_at, sender_id, message_status)
          `)
          .in('id', groupIds)
          .eq('is_group', true)
          .order('updated_at', { ascending: false });
        groups = gData || [];
      }

      // Filter out chats the user has moved to their Secure Vault.
      const data = [...(oneToOne || []), ...groups].filter(
        (c: any) => !securedSet.has(c.id),
      );

      // Batch-fetch all other participants in a single query to avoid the
      // previous N+1 waterfall (one round-trip per 1:1 chat).
      const otherIds = Array.from(new Set(
        (oneToOne || [])
          .map((c: any) => c.participant_one === user.id ? c.participant_two : c.participant_one)
          .filter(Boolean)
      ));
      const otherProfilesMap = new Map<string, any>();
      if (otherIds.length) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, full_name, is_online, last_seen, public_key, avatar_url, profile_photo_visibility')
          .in('id', otherIds);
        for (const p of (profs || [])) otherProfilesMap.set(p.id, p);
      }

      const chatList: Chat[] = [];
      for (const chat of data) {
        const isGroup = !!(chat as any).is_group;
        const msgs = (chat as any).messages || [];
        const sortedMsgs = msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const lastMsg = sortedMsgs[0];
        const unreadCount = msgs.filter((m: any) => m.sender_id !== user.id && m.message_status !== 'read').length;
        const avatarColors = ['gradient-primary', 'gradient-cyan', 'gradient-pink', 'gradient-tri'];

        if (isGroup) {
          const gname = (chat as any).name || 'Group';
          chatList.push({
            id: chat.id,
            name: gname,
            avatar: gname[0]?.toUpperCase() || 'G',
            avatarColor: avatarColors[chatList.length % avatarColors.length],
            lastMessage: lastMsg?.content?.startsWith('e2e:') ? '[message]' : (lastMsg?.content || 'Start the conversation...'),
            time: lastMsg ? formatTime(lastMsg.created_at) : '',
            rawTime: lastMsg?.created_at || (chat as any).updated_at,
            unread: unreadCount,
            online: false,
            typing: false,
            pinned: false,
            muted: false,
            isGroup: true,
          });
          continue;
        }

        const otherUserId = chat.participant_one === user.id ? chat.participant_two : chat.participant_one;
        const otherUser = otherProfilesMap.get(otherUserId);

        if (otherUser) {
          // Decrypt the last message preview so sender/receiver see plaintext.
          let preview = lastMsg?.content || 'Start a conversation...';
          if (lastMsg?.content && isEncrypted(lastMsg.content)) {
            if (otherUser.public_key) {
              try {
                preview = await decryptMessage(lastMsg.content, otherUser.public_key);
              } catch {
                preview = '🔒 New message';
              }
            } else {
              preview = '🔒 New message';
            }
          }
          if (preview?.startsWith('[IMAGE:')) preview = '📷 Photo';
          else if (preview?.startsWith('[FILE:')) preview = '📎 File';
          else if (preview?.startsWith('[STICKER:')) preview = 'Sticker removed';
          else if (preview?.startsWith('__media__:')) {
            try {
              const m = JSON.parse(preview.slice('__media__:'.length));
              const isVid = m.type === 'video' || (m.mime && String(m.mime).startsWith('video/'));
              preview = isVid ? '🎥 Video'
                : m.type === 'image' ? '📷 Photo'
                : m.type === 'audio' ? '🎵 Audio'
                : `📎 ${m.name || 'File'}`;
            } catch { preview = '📎 Media'; }
          }
          else if (preview?.startsWith('__call_log__:')) {
            const parts = preview.split(':');
            preview = parts[1] === 'video' ? '📹 Video call' : '📞 Voice call';
          } else if (preview?.startsWith('__missed_call__:')) {
            const parts = preview.split(':');
            preview = parts[1] === 'video' ? '📹 Missed video call' : '📞 Missed voice call';
          }
          chatList.push({
            id: chat.id,
            name: otherUser.full_name || 'Unknown',
            avatar: (otherUser.full_name || 'U')[0].toUpperCase(),
            avatarColor: avatarColors[chatList.length % avatarColors.length],
            avatarUrl: (otherUser.profile_photo_visibility ?? 'all') === 'all' ? (otherUser.avatar_url || null) : null,
            lastMessage: preview,
            time: lastMsg ? formatTime(lastMsg.created_at) : '',
            rawTime: lastMsg?.created_at || (chat as any).updated_at,
            unread: unreadCount,
            online: !!(otherUser.is_online && otherUser.last_seen && (Date.now() - new Date(otherUser.last_seen).getTime()) < 2 * 60 * 1000),
            typing: false,
            pinned: false,
            muted: false,
            participantId: otherUserId,
          });
        }
      }
      setChats(chatList);
      try { sessionStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(chatList)); } catch {}
      // Only auto-open the first chat on desktop side-by-side layout.
      // On mobile/tablet the user should land on the chat list, not a chat.
      if (
        chatList.length > 0 &&
        !selectedChatId &&
        typeof window !== 'undefined' &&
        window.matchMedia('(min-width: 1024px)').matches
      ) {
        setSelectedChatId(chatList[0].id);
      }
    } catch (err) {
      setChats(getDemoChats());
    } finally {
      setLoading(false);
    }
  };

  const getDemoChats = (): Chat[] => [
    {
      id: 'demo-chat-001',
      name: 'Alex Rivera',
      avatar: 'A',
      avatarColor: 'gradient-cyan',
      lastMessage: 'Hey! Welcome to VibTribe 🎉',
      time: '2m',
      unread: 1,
      online: true,
      typing: false,
      pinned: false,
      muted: false,
    },
  ];

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await supabase.from('messages').delete().eq('chat_id', chatId);
      await supabase.from('chats').delete().eq('id', chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChatId === chatId) setSelectedChatId(null);
    } catch {
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChatId === chatId) setSelectedChatId(null);
    }
    setContextMenu(null);
  };

  const handleMarkSecure = (chat: Chat) => {
    setSecureTarget({ id: chat.id, name: chat.name });
    setSecureModalOpen(true);
    setContextMenu(null);
  };

  const handleMarkAsRead = async (chatId: string) => {
    setContextMenu(null);
    if (!user) return;
    try {
      await supabase.rpc('mark_messages_read', { _chat_id: chatId });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unread: 0 } : c));
    } catch {}
  };

  // Mark the VibTribe broadcast as read the instant the user opens it.
  // BroadcastChatPanel also stamps `vt_broadcast_last_read` after its own
  // load(), but on Android Capacitor that load() occasionally races the
  // realtime postgres_changes refresh and the unread badge would
  // reappear after a reload. Stamping here guarantees the badge clears.
  const markBroadcastRead = () => {
    try {
      if (typeof window === 'undefined') return;
      const ts = broadcastPreview?.created_at || new Date().toISOString();
      const prev = localStorage.getItem('vt_broadcast_last_read');
      // Always advance — never move the timestamp backwards.
      if (!prev || new Date(ts) >= new Date(prev)) {
        localStorage.setItem('vt_broadcast_last_read', ts);
      }
      setBroadcastUnread(0);
      window.dispatchEvent(new Event('vt-broadcast-read'));
    } catch {}
  };

  const handleContactStartChat = (chatId: string, name: string) => {
    setSelectedChatId(chatId);
    loadChats();
  };

  const isMaster = !!profile?.is_master_admin || profile?.role === 'master_admin';

  const filtered = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || (activeTab === 'unread' && chat.unread > 0) || (activeTab === 'groups' && chat.isGroup);
    return matchesSearch && matchesTab;
  });

  // Pin VibTribe at top only for master admins. For everyone else, the broadcast
  // chat shows up inline among regular chats, ordered by its latest message time.
  const broadcastMatchesSearch = 'vibtribe'.includes(search.toLowerCase());
  const showBroadcastPinned =
    isMaster &&
    activeTab !== 'contacts' &&
    activeTab !== 'groups' &&
    broadcastMatchesSearch;
  const broadcastTime = broadcastPreview ? formatTime(broadcastPreview.created_at) : '';
  const broadcastLast = broadcastPreview?.content || 'Official VibTribe announcements';

  // Build the in-list broadcast row for non-master users (and master users on
  // the unread tab, where pinning doesn't apply) — placed inline by time.
  const inlineBroadcast: Chat | null =
    !isMaster &&
    broadcastPreview &&
    activeTab !== 'contacts' &&
    activeTab !== 'groups' &&
    broadcastMatchesSearch &&
    (activeTab !== 'unread' || broadcastUnread > 0)
      ? {
          id: BROADCAST_CHAT_ID,
          name: 'VibTribe',
          avatar: 'V',
          avatarColor: 'gradient-primary',
          avatarUrl: BROADCAST_LOGO,
          lastMessage: broadcastPreview.content || 'Official announcement',
          time: broadcastTime,
          rawTime: broadcastPreview.created_at,
          unread: broadcastUnread,
          online: false,
          typing: false,
          pinned: false,
          muted: false,
          isBroadcast: true,
        }
      : null;

  const filteredWithBroadcast: Chat[] = inlineBroadcast
    ? (() => {
        const out = [...filtered];
        const t = new Date(inlineBroadcast.rawTime || 0).getTime();
        let idx = out.findIndex(
          (c) => new Date((c as any).rawTime || 0).getTime() < t,
        );
        if (idx === -1) idx = out.length;
        out.splice(idx, 0, inlineBroadcast);
        return out;
      })()
    : filtered;

  return (
    <>
      <div
        className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col border-r border-border glass h-full min-w-0 max-w-full overflow-hidden"
        onClick={() => contextMenu && setContextMenu(null)}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('chatlist.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex gap-1 mt-3 p-1 bg-muted rounded-xl">
            {(['all', 'unread', 'groups', 'contacts'] as const).map((tab) => (
              <button
                key={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`chatlist.tab.${tab}` as any)}
                {tab === 'unread' && (
                  <span className="ml-1 text-[10px]">({chats.filter(c => c.unread > 0).length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab-specific action */}
          {activeTab === 'groups' ? (
            <button
              onClick={() => setCreateGroupOpen(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all glow-primary"
            >
              <UserPlus size={16} />
              {t('chatlist.newGroup')}
            </button>
          ) : activeTab === 'contacts' ? null : (
            <button
              onClick={() => setContactsOpen(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all glow-primary"
            >
              <Plus size={16} />
              {t('chatlist.newChat')}
            </button>
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'contacts' ? (
            <ContactsTabContent
              user={user}
              supabase={supabase}
              perm={contactsPerm}
              setPerm={setContactsPerm}
              contacts={contactsList}
              setContacts={setContactsList}
              loading={contactsLoading}
              setLoading={setContactsLoading}
              search={contactsSearch}
              setSearch={setContactsSearch}
              setInviteTarget={setInviteTarget}
              onStartedChat={(chatId) => { setSelectedChatId(chatId); loadChats(); }}
            />
          ) : loading ? (
            <div className="flex flex-col gap-3 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-muted rounded w-24 mb-2" />
                    <div className="h-2 bg-muted rounded w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
            {showBroadcastPinned && (
              <div
                onClick={() => setSelectedChatId(BROADCAST_CHAT_ID)}
                onClickCapture={markBroadcastRead}
                className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
                  selectedChatId === BROADCAST_CHAT_ID ? 'bg-primary/10 border-r-2 border-primary' : 'bg-primary/5'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img src={BROADCAST_LOGO} alt="VibTribe" className="w-12 h-12 rounded-full object-cover border border-primary/40" />
                  <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded-full">📌</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">VibTribe</p>
                      <span className="text-primary text-xs">✓</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{broadcastTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs truncate text-muted-foreground italic">
                      Official VibTribe Account · {broadcastLast}
                    </p>
                    {broadcastUnread > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 gradient-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
                        {broadcastUnread > 99 ? '99+' : broadcastUnread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {filteredWithBroadcast.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 p-4">
                <span className="text-3xl">💬</span>
                <p className="text-sm text-muted-foreground text-center">No conversations yet</p>
                <button
                  onClick={() => setContactsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
                >
                  <Users size={14} />
                  Find Contacts
                </button>
              </div>
            ) : filteredWithBroadcast.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isSelected={selectedChatId === chat.id}
                onClick={() => {
                  // Optimistically clear unread on the list as soon as the user
                  // opens the chat. The ChatWindowPanel separately calls the
                  // mark_messages_read RPC; this just keeps the list in sync
                  // without waiting for the realtime UPDATE round-trip.
                  if (chat.unread > 0) {
                    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                  }
                  if (chat.isBroadcast) markBroadcastRead();
                  setSelectedChatId(chat.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (chat.isBroadcast) return;
                  setContextMenu({ chatId: chat.id, x: e.clientX, y: e.clientY });
                }}
                onDelete={() => handleDeleteChat(chat.id)}
                onMarkSecure={() => handleMarkSecure(chat)}
              />
            ))}
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 glass-strong rounded-xl border border-border shadow-card overflow-hidden float-up"
          style={{ top: contextMenu.y, left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 180 : 200) }}
        >
          <button
            onClick={() => handleMarkAsRead(contextMenu.chatId)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted w-full text-left transition-colors"
          >
            <Check size={14} className="text-vt-green" />
            Mark as Read
          </button>
          <button
            onClick={() => {
              const chat = chats.find(c => c.id === contextMenu.chatId);
              if (chat) handleMarkSecure(chat);
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted w-full text-left transition-colors"
          >
            <Lock size={14} className="text-primary" />
            Mark as Secure
          </button>
          <button
            onClick={() => handleDeleteChat(contextMenu.chatId)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 w-full text-left transition-colors"
          >
            <Trash2 size={14} />
            Delete Chat
          </button>
        </div>
      )}

      {secureModalOpen && secureTarget && (
        <MarkSecureModal
          isOpen={secureModalOpen}
          onClose={() => {
            setSecureModalOpen(false);
            loadChats();
          }}
          chatId={secureTarget.id}
          chatName={secureTarget.name}
          onSecured={(id) => {
            // Optimistically remove from list immediately so the chat
            // disappears without waiting for a reload.
            setChats((prev) => prev.filter((c) => c.id !== id));
            if (selectedChatId === id) setSelectedChatId(null);
          }}
        />
      )}

      {contactsOpen && (
        <ContactsPanel
          onClose={() => setContactsOpen(false)}
          onStartChat={handleContactStartChat}
        />
      )}

      {createGroupOpen && (
        <CreateGroupModal
          isOpen={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          onCreated={(id) => { setSelectedChatId(id); loadChats(); }}
        />
      )}

      {inviteTarget && (
        <InviteOptionsModal
          contact={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </>
  );
}

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onMarkSecure: () => void;
}

function ChatListItem({ chat, isSelected, onClick, onContextMenu, onDelete, onMarkSecure }: ChatListItemProps) {
  const hasUnread = chat.unread > 0;
  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
        isSelected ? 'bg-primary/10 border-r-2 border-primary' : hasUnread ? 'bg-primary/5' : ''
      }`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {chat.avatarUrl ? (
          <img
            src={chat.avatarUrl}
            alt={chat.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className={`w-12 h-12 ${chat.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-base`}>
            {chat.avatar}
          </div>
        )}
        {chat.online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-vt-green rounded-full border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${hasUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
            {chat.name}
          </p>
          <span className={`text-[11px] flex-shrink-0 ${hasUnread ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
            {chat.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-xs truncate ${
            chat.typing ? 'text-primary italic' : hasUnread ?'text-foreground font-medium': 'text-muted-foreground'
          }`}>
            {chat.typing ? 'typing...' : chat.lastMessage}
          </p>
          {hasUnread && (
            <span className="flex-shrink-0 min-w-[20px] h-5 gradient-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
              {chat.unread > 99 ? '99+' : chat.unread}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Contacts Tab =====

const PLATFORM_URL = typeof window !== 'undefined' ? window.location.origin : 'https://vibtribe.in';
const INVITE_MSG = `Hey! I'm using VibTribe — a secure messaging app. Join me here: ${PLATFORM_URL}/sign-up 🚀`;

function ContactsTabContent({
  user, supabase, perm, setPerm, contacts, setContacts,
  loading, setLoading, search, setSearch, setInviteTarget, onStartedChat,
}: any) {
  const requestContacts = async () => {
    setPerm('requesting');
    try {
      // 1) Capacitor native (Android) — read real phone address book.
      if (isNativeWrapper()) {
        const granted = await requestNativeContactsPermission();
        if (granted !== 'granted') {
          setPerm('denied');
          return;
        }
        try {
          const { Contacts } = await import('@capacitor-community/contacts');
          const res: any = await Contacts.getContacts({
            projection: { name: true, phones: true },
          });
          const raw = (res?.contacts || []).map((c: any) => ({
            name:
              c?.name?.display
              || [c?.name?.given, c?.name?.family].filter(Boolean).join(' ')
              || 'Unknown',
            tel: (c?.phones || [])
              .map((p: any) => (typeof p === 'string' ? p : p?.number))
              .filter(Boolean),
          }));
          setPerm('granted');
          await matchContacts(raw);
        } catch (nativeErr) {
          console.error('[VibTribe] native contacts fetch failed', nativeErr);
          setPerm('granted');
          await loadDemo();
        }
        return;
      }
      // 2) Web Contacts Picker API (Chrome on Android PWA).
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const raw = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
        setPerm('granted');
        await matchContacts(raw);
      } else {
        setPerm('granted');
        await loadDemo();
      }
    } catch (err: any) {
      console.error('[VibTribe] requestContacts failed', err);
      if (err?.name === 'SecurityError' || err?.name === 'NotAllowedError') {
        setPerm('denied');
      } else {
        setPerm('granted');
        try { await loadDemo(); } catch (e) { console.error('[VibTribe] loadDemo fallback failed', e); }
      }
    }
  };

  const matchContacts = async (raw: any[]) => {
    setLoading(true);
    try {
      const normalized: { name: string; phone: string }[] = [];
      for (const c of raw) {
        const name = Array.isArray(c.name) ? c.name[0] : c.name || 'Unknown';
        const phones: string[] = Array.isArray(c.tel) ? c.tel : [c.tel].filter(Boolean);
        for (const phone of phones) {
          const clean = String(phone).replace(/\D/g, '');
          if (clean.length >= 7) normalized.push({ name: String(name), phone: clean });
        }
      }
      // De-dupe phones and chunk the .in() query — Supabase / PostgREST will
      // reject overly long URLs when the address book has hundreds of
      // numbers, which previously bubbled up as the root error boundary
      // ("This page didn't load").
      const uniquePhones = Array.from(new Set(normalized.map(c => c.phone)));
      const map = new Map<string, any>();
      const CHUNK = 100;
      for (let i = 0; i < uniquePhones.length; i += CHUNK) {
        const slice = uniquePhones.slice(i, i + CHUNK);
        try {
          const { data: platformUsers } = await supabase
            .from('user_profiles')
            .select('id, full_name, mobile_number, avatar_url, profile_photo_visibility')
            .in('mobile_number', slice);
          for (const u of (platformUsers || [])) {
            const key = (u as any).mobile_number?.replace(/\D/g, '');
            if (key) map.set(key, u);
          }
        } catch (e) {
          console.warn('[VibTribe] contact match chunk failed', e);
        }
      }
      setContacts(normalized.map(c => {
        const m: any = map.get(c.phone);
        return {
          name: c.name,
          phone: c.phone,
          onPlatform: !!m,
          userId: m?.id,
          avatar: m?.full_name?.[0]?.toUpperCase() || c.name?.[0]?.toUpperCase() || 'U',
          avatarUrl: m && (m.profile_photo_visibility ?? 'all') === 'all' ? (m.avatar_url || null) : null,
        };
      }));
    } catch (e) {
      console.error('[VibTribe] matchContacts failed', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = async () => {
    setLoading(true);
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, full_name, mobile_number, avatar_url, profile_photo_visibility')
      .neq('id', user?.id || '')
      .limit(50);
    const result = (users || []).map((u: any) => ({
      name: u.full_name || 'Unknown',
      phone: u.mobile_number || '',
      onPlatform: true,
      userId: u.id,
      avatar: u.full_name?.[0]?.toUpperCase(),
      avatarUrl: (u.profile_photo_visibility ?? 'all') === 'all' ? (u.avatar_url || null) : null,
    }));
    setContacts(result);
    setLoading(false);
  };

  const startChat = async (contact: any) => {
    if (!contact.userId || !user) return;
    const { data: existing } = await supabase
      .from('chats')
      .select('id')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${contact.userId}),and(participant_one.eq.${contact.userId},participant_two.eq.${user.id})`)
      .maybeSingle();
    if (existing) { onStartedChat(existing.id); return; }
    const { data: newChat } = await supabase
      .from('chats')
      .insert({ participant_one: user.id, participant_two: contact.userId, chat_type: 'normal' })
      .select()
      .single();
    if (newChat) onStartedChat(newChat.id);
  };

  if (perm === 'idle') {
    return (
      <div className="p-4">
        <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t('chatlist.allowContacts')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Find friends already on VibTribe and invite the rest from your phonebook.
              </p>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-[11px] text-foreground leading-relaxed">
              <span className="font-bold text-amber-400">Tip:</span> When the contact picker opens, tap
              <span className="font-bold"> "Select all"</span> at the top to import everyone in one go.
              Browsers require you to confirm the selection — VibTribe can't auto-pick contacts for privacy reasons.
            </p>
          </div>
          <button
            onClick={requestContacts}
            className="w-full py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all glow-primary"
          >
            Allow access
          </button>
        </div>
      </div>
    );
  }

  if (perm === 'requesting') {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Phone size={20} className="text-white" />
        </div>
        <p className="text-sm text-muted-foreground">Requesting contact access…</p>
      </div>
    );
  }

  if (perm === 'denied') {
    return (
      <div className="p-4">
        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5">
          <p className="text-sm font-semibold text-foreground">{t('chatlist.contactsDenied')}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Enable contacts permission from your browser/app settings to discover friends, then try again.
          </p>
          <button
            onClick={() => setPerm('idle')}
            className="px-4 py-2 gradient-primary rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const filtered = contacts.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );
  const onPlatform = filtered.filter((c: any) => c.onPlatform);
  const offPlatform = filtered.filter((c: any) => !c.onPlatform);

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={requestContacts}
        className="w-full py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all glow-primary flex items-center justify-center gap-2"
      >
        <UserPlus size={16} />
        {isNativeWrapper() ? 'Sync phone contacts' : 'Import contacts'}
      </button>

      <input
        type="text"
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-3 bg-muted rounded w-24 mb-1.5" />
                <div className="h-2 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Users size={28} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No contacts found</p>
        </div>
      ) : (
        <>
          {onPlatform.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                On VibTribe ({onPlatform.length})
              </p>
              <div className="space-y-2">
                {onPlatform.map((c: any, i: number) => (
                  <div key={`p-${i}`} className="flex items-center gap-3 p-2.5 glass rounded-xl border border-border">
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {c.avatar || c.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Check size={10} className="text-vt-green" />
                        <span className="text-[11px] text-vt-green font-medium">On VibTribe</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startChat(c)}
                      className="flex items-center gap-1 px-3 py-1.5 gradient-primary rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all"
                    >
                      <MessageSquare size={12} />
                      Chat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {offPlatform.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Invite to VibTribe ({offPlatform.length})
              </p>
              <div className="space-y-2">
                {offPlatform.map((c: any, i: number) => (
                  <div key={`o-${i}`} className="flex items-center gap-3 p-2.5 glass rounded-xl border border-border">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-bold text-sm flex-shrink-0">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.phone || 'Not on VibTribe yet'}</p>
                    </div>
                    <button
                      onClick={() => setInviteTarget(c)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                    >
                      <UserPlus size={12} />
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InviteOptionsModal({ contact, onClose }: { contact: any; onClose: () => void }) {
  const phone = (contact.phone || '').replace(/\D/g, '');
  const inviteWhatsApp = () => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(INVITE_MSG)}`, '_blank');
    onClose();
  };
  const inviteSMS = () => {
    window.location.href = `sms:${contact.phone}?body=${encodeURIComponent(INVITE_MSG)}`;
    onClose();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(INVITE_MSG); } catch {}
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm glass-strong rounded-3xl border border-border shadow-card overflow-hidden float-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-base text-foreground">Invite {contact.name}</h3>
          <p className="text-xs text-muted-foreground">Choose how to send the invite</p>
        </div>
        <div className="mx-4 mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-[11px] text-muted-foreground mb-1 font-medium">Message Preview</p>
          <p className="text-xs text-foreground leading-relaxed">{INVITE_MSG}</p>
        </div>
        <div className="p-4 space-y-2">
          <button onClick={inviteWhatsApp} className="w-full flex items-center gap-3 p-3 glass rounded-xl border border-border hover:border-green-500/40 hover:bg-green-500/5 transition-all">
            <span className="text-lg">💬</span>
            <span className="text-sm font-semibold text-foreground">WhatsApp</span>
          </button>
          <button onClick={inviteSMS} className="w-full flex items-center gap-3 p-3 glass rounded-xl border border-border hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <MessageSquare size={18} className="text-blue-400" />
            <span className="text-sm font-semibold text-foreground">SMS / Text</span>
          </button>
          <button onClick={copy} className="w-full flex items-center gap-3 p-3 glass rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all">
            <UserPlus size={18} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Copy invite link</span>
          </button>
        </div>
      </div>
    </div>
  );
}