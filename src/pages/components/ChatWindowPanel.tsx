import React, { useState, useRef, useEffect } from 'react';
import { Phone, Video, Smile, Paperclip, Mic, Send, Lock, CheckCheck, Check, ArrowLeft, Info, Trash2, ShieldCheck } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import MarkSecureModal from '@/components/MarkSecureModal';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateKeyPair, encryptMessage, decryptMessage, isEncrypted } from '@/lib/encryption';

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  status: 'sent' | 'delivered' | 'read';
  reactions: string[];
  encrypted?: boolean;
}

const EMOJI_LIST = ['😊', '❤️', '😂', '🔥', '👍', '🎉', '😍', '🙏', '💯', '✨', '🚀', '💜'];

export default function ChatWindowPanel() {
  const { selectedChatId, setSelectedChatId } = useChatStore();
  const { user } = useAuth();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [secureModalOpen, setSecureModalOpen] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [contact, setContact] = useState<{ name: string; avatar: string; online: boolean; lastSeen: string; publicKey?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [e2eEnabled, setE2eEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedChatId && user) {
      loadChatData();
      const channel = supabase
        .channel(`chat-${selectedChatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChatId}` },
          async (payload) => {
            const newMsg = payload.new as any;
            if (newMsg.sender_id !== user.id) {
              let text = newMsg.content;
              const encrypted = isEncrypted(text);
              if (encrypted && contact?.publicKey) {
                text = await decryptMessage(text, contact.publicKey);
              }
              setMessages(prev => [...prev, {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                text,
                time: formatTime(newMsg.created_at),
                status: 'delivered',
                reactions: [],
                encrypted,
              }]);
            }
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedChatId, user]);

  const loadChatData = async () => {
    if (!selectedChatId || !user) return;
    setLoading(true);
    try {
      // Ensure this user has a public key stored
      const { publicKey: myPublicKey } = await getOrCreateKeyPair();
      await supabase
        .from('user_profiles')
        .update({ public_key: myPublicKey })
        .eq('id', user.id);

      // Load chat participants
      const { data: chat } = await supabase
        .from('chats')
        .select('participant_one, participant_two')
        .eq('id', selectedChatId)
        .single();

      if (chat) {
        const otherUserId = chat.participant_one === user.id ? chat.participant_two : chat.participant_one;
        const { data: otherUser } = await supabase
          .from('user_profiles')
          .select('full_name, is_online, last_seen, public_key')
          .eq('id', otherUserId as string)
          .single();

        if (otherUser) {
          const hasE2E = !!otherUser.public_key;
          setE2eEnabled(hasE2E);
          setContact({
            name: otherUser.full_name || 'Unknown',
            avatar: (otherUser.full_name || 'U')[0].toUpperCase(),
            online: otherUser.is_online || false,
            lastSeen: otherUser.is_online ? 'Online' : 'Last seen recently',
            publicKey: otherUser.public_key || undefined,
          });
        }
      }

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', selectedChatId)
        .order('created_at', { ascending: true });

      const decryptedMsgs: Message[] = [];
      for (const m of (msgs || [])) {
        let text = m.content;
        const encrypted = isEncrypted(text);
        if (encrypted && contact?.publicKey) {
          text = await decryptMessage(text, contact.publicKey);
        }
        decryptedMsgs.push({
          id: m.id,
          senderId: (m.sender_id ?? '') as string,
          text,
          time: formatTime(m.created_at as any),
          status: m.message_status || 'sent',
          reactions: (m.reactions as any) || [],
          encrypted,
        });
      }
      setMessages(decryptedMsgs);
    } catch {
      setContact({ name: 'Alex Rivera', avatar: 'A', online: true, lastSeen: 'Online' });
      setMessages([
        { id: 'demo-1', senderId: 'other', text: 'Hey! Welcome to VibeTribe 🎉', time: '10:30 AM', status: 'read', reactions: [] },
        { id: 'demo-2', senderId: user?.id || 'me', text: 'Thanks! This platform is amazing 🚀', time: '10:31 AM', status: 'read', reactions: ['❤️'] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedChatId || !user) return;
    let text = inputText.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      senderId: user.id,
      text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      reactions: [],
      encrypted: e2eEnabled,
    };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setShowEmoji(false);

    try {
      // Encrypt if recipient has a public key
      let contentToStore = text;
      if (e2eEnabled && contact?.publicKey) {
        contentToStore = await encryptMessage(text, contact.publicKey);
      }

      const { data } = await supabase
        .from('messages')
        .insert({ chat_id: selectedChatId, sender_id: user.id, content: contentToStore, message_status: 'sent' })
        .select()
        .single();
      if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: 'delivered' } : m));
        await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', selectedChatId);
      }
    } catch {}
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, reactions: m.reactions.includes(emoji) ? m.reactions.filter(r => r !== emoji) : [...m.reactions, emoji] }
        : m
    ));
  };

  const deleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      await supabase.from('messages').delete().eq('id', msgId);
    } catch {}
  };

  if (!selectedChatId) {
    return (
      <div className="flex-1 hidden lg:flex items-center justify-center">
        <div className="text-center float-up">
          <div className="w-24 h-24 gradient-tri rounded-full flex items-center justify-center mx-auto mb-4 glow-primary">
            <span className="text-4xl">💬</span>
          </div>
          <h3 className="font-bold text-xl text-foreground mb-2">Select a conversation</h3>
          <p className="text-sm text-muted-foreground">Choose a chat from the list to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Chat Header */}
      <div className="glass border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          className="lg:hidden p-2 rounded-xl hover:bg-muted text-muted-foreground transition-all"
          onClick={() => setSelectedChatId(null)}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="relative">
          <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
            {contact?.avatar || '?'}
          </div>
          {contact?.online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-vt-green rounded-full border-2 border-background" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm text-foreground">{contact?.name || 'Loading...'}</h3>
            {e2eEnabled && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-vt-green/10 rounded-full" title="End-to-end encrypted">
                <ShieldCheck size={10} className="text-vt-green" />
                <span className="text-[9px] text-vt-green font-medium">E2E</span>
              </div>
            )}
          </div>
          <p className={`text-xs ${contact?.online ? 'text-vt-green' : 'text-muted-foreground'}`}>
            {contact?.lastSeen || ''}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSecureModalOpen(true)}
            className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-all"
            title="Mark as Secure Chat"
          >
            <Lock size={18} />
          </button>
          <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <Phone size={18} />
          </button>
          <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <Video size={18} />
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* E2E Banner */}
      {e2eEnabled && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-vt-green/5 border-b border-vt-green/10">
          <ShieldCheck size={11} className="text-vt-green" />
          <span className="text-[11px] text-vt-green">Messages are end-to-end encrypted</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground px-3 py-1 glass rounded-full">Today</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-pulse`}>
                <div className="h-10 w-48 bg-muted rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                onMouseEnter={() => setHoveredMsg(msg.id)}
                onMouseLeave={() => setHoveredMsg(null)}
              >
                <div className={`relative max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'gradient-primary text-white rounded-br-sm' :'glass border border-border text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                    {msg.encrypted && (
                      <ShieldCheck size={9} className={`inline ml-1 ${isMe ? 'text-white/60' : 'text-vt-green/60'}`} />
                    )}
                  </div>

                  {/* Reactions */}
                  {msg.reactions.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {msg.reactions.map((r, i) => (
                        <span key={i} className="text-sm bg-muted rounded-full px-1.5 py-0.5 text-xs">{r}</span>
                      ))}
                    </div>
                  )}

                  {/* Time + Status */}
                  <div className={`flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                    {isMe && (
                      msg.status === 'read' ? <CheckCheck size={12} className="text-primary" /> :
                      msg.status === 'delivered' ? <CheckCheck size={12} className="text-muted-foreground" /> :
                      <Check size={12} className="text-muted-foreground" />
                    )}
                  </div>

                  {/* Hover Actions */}
                  {hoveredMsg === msg.id && (
                    <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-0 flex items-center gap-1 glass rounded-xl border border-border px-2 py-1 float-up`}>
                      {EMOJI_LIST.slice(0, 4).map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(msg.id, emoji)}
                          className="text-sm hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                      {isMe && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="px-4 py-3 border-t border-border glass">
          <div className="flex flex-wrap gap-2">
            {EMOJI_LIST.map(emoji => (
              <button
                key={emoji}
                onClick={() => setInputText(prev => prev + emoji)}
                className="text-xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="glass border-t border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
        >
          <Smile size={20} />
        </button>
        <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0">
          <Paperclip size={20} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={e2eEnabled ? '🔒 Send encrypted message...' : 'Type a message...'}
          className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
        />
        {inputText.trim() ? (
          <button
            onClick={sendMessage}
            className="p-2.5 gradient-primary rounded-xl text-white hover:opacity-90 transition-all glow-primary flex-shrink-0"
          >
            <Send size={18} />
          </button>
        ) : (
          <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0">
            <Mic size={20} />
          </button>
        )}
      </div>

      {secureModalOpen && (
        <MarkSecureModal
          isOpen={secureModalOpen}
          onClose={() => setSecureModalOpen(false)}
          chatId={selectedChatId}
          chatName={contact?.name || 'Chat'}
        />
      )}
    </div>
  );
}