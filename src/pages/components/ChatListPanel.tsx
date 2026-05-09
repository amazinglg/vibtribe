// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Lock, Users, UserPlus } from 'lucide-react';
import MarkSecureModal from '@/components/MarkSecureModal';
import ContactsPanel from '@/components/ContactsPanel';
import CreateGroupModal from '@/components/CreateGroupModal';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface Chat {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  typing: boolean;
  pinned: boolean;
  muted: boolean;
  isGroup?: boolean;
  hasMedia?: boolean;
  participantId?: string;
}

export default function ChatListPanel() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'groups'>('all');
  const [secureModalOpen, setSecureModalOpen] = useState(false);
  const [secureTarget, setSecureTarget] = useState<{ id: string; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const { selectedChatId, setSelectedChatId } = useChatStore();
  const { user, profile } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (user) loadChats();
  }, [user]);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, debouncedReload)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadChats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1:1 chats where I'm a participant
      const { data: oneToOne, error: oneErr } = await supabase
        .from('chats')
        .select(`
          id, chat_type, participant_one, participant_two, is_group, name, updated_at,
          messages(id, content, created_at, sender_id, message_status)
        `)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .neq('chat_type', 'secure')
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

      const data = [...(oneToOne || []), ...groups];

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
        const { data: otherUser } = await supabase
          .from('user_profiles')
          .select('id, full_name, is_online, last_seen')
          .eq('id', otherUserId)
          .single();

        if (otherUser) {
          chatList.push({
            id: chat.id,
            name: otherUser.full_name || 'Unknown',
            avatar: (otherUser.full_name || 'U')[0].toUpperCase(),
            avatarColor: avatarColors[chatList.length % avatarColors.length],
            lastMessage: lastMsg?.content?.startsWith('e2e:') ? '🔒 Encrypted message' : (lastMsg?.content || 'Start a conversation...'),
            time: lastMsg ? formatTime(lastMsg.created_at) : '',
            unread: unreadCount,
            online: otherUser.is_online || false,
            typing: false,
            pinned: false,
            muted: false,
            participantId: otherUserId,
          });
        }
      }
      setChats(chatList);
      if (chatList.length > 0 && !selectedChatId) {
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
      lastMessage: 'Hey! Welcome to VibeTribe 🎉',
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

  const handleContactStartChat = (chatId: string, name: string) => {
    setSelectedChatId(chatId);
    loadChats();
  };

  const filtered = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || (activeTab === 'unread' && chat.unread > 0) || (activeTab === 'groups' && chat.isGroup);
    return matchesSearch && matchesTab;
  });

  return (
    <>
      <div
        className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col border-r border-border glass h-full min-w-0 max-w-full overflow-hidden"
        onClick={() => contextMenu && setContextMenu(null)}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-xl text-foreground">Messages</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateGroupOpen(true)}
                className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                title="New Group"
              >
                <UserPlus size={18} />
              </button>
              <button
                onClick={() => setContactsOpen(true)}
                className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                title="Contacts"
              >
                <Users size={18} />
              </button>
              <button
                onClick={() => setContactsOpen(true)}
                className="p-2 gradient-primary rounded-xl text-white hover:opacity-90 transition-all glow-primary"
                title="New Chat"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex gap-1 mt-3 p-1 bg-muted rounded-xl">
            {(['all', 'unread', 'groups'] as const).map((tab) => (
              <button
                key={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  activeTab === tab ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'unread' && (
                  <span className="ml-1 text-[10px]">({chats.filter(c => c.unread > 0).length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
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
          ) : filtered.length === 0 ? (
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
          ) : (
            filtered.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isSelected={selectedChatId === chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ chatId: chat.id, x: e.clientX, y: e.clientY });
                }}
                onDelete={() => handleDeleteChat(chat.id)}
                onMarkSecure={() => handleMarkSecure(chat)}
              />
            ))
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
        <div className={`w-12 h-12 ${chat.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-base`}>
          {chat.avatar}
        </div>
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