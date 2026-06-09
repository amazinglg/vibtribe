// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Phone, Video, Paperclip, Mic, MicOff, Send, Lock, CheckCheck, Check, ArrowLeft, Info, Trash2, ShieldCheck, Ban, ShieldOff, X, Image, FileText, Camera, VideoOff, PhoneOff, Volume2, VolumeX, Timer, MoreVertical, UserPlus, Smile, KeyRound } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import MarkSecureModal from '@/components/MarkSecureModal';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateKeyPair, encryptMessage, decryptMessage, isEncrypted, encryptBytes, encryptBytesWithRandomKey, hasLocalPrivateKey, encryptGroupMessage, decryptGroupMessageForMe, isGroupEncrypted, type GroupMember } from '@/lib/encryption';
import EncryptedMedia from '@/components/EncryptedMedia';
import { getPreferredNickname } from '@/components/SecureVaultModal';
import PermissionPrompt from '@/components/PermissionPrompt';
import { usePermissions } from '@/hooks/usePermissions';
import { sendPushNotification } from '@/lib/pushNotifications';
import { useCall } from '@/components/CallProvider';
import { isNativeWrapper, pickNativeImage, pickNativeFiles, requestNativeCameraPermission } from '@/lib/native-bridge';
import { toast } from 'sonner';
import { EMOJI_CATEGORIES, type EmojiCategoryKey } from '@/lib/emojis';
import { useT } from '@/contexts/LanguageContext';
import TribeDetailsSheet from '@/components/TribeDetailsSheet';
import EncryptionPinModal from '@/components/EncryptionPinModal';

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  status: 'sent' | 'delivered' | 'read';
  reactions: string[];
  encrypted?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'file' | 'audio';
  editedAt?: string | null;
  deletedForEveryone?: boolean;
  createdAt?: string;
  messageType?: string;
}

// Call Modal Component
function CallModal({
  type,
  contactName,
  contactAvatar,
  onEnd,
}: {
  type: 'voice' | 'video';
  contactName: string;
  contactAvatar: string;
  onEnd: () => void;
}) {
  const [callDuration, setCallDuration] = useState(0);
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Simulate ringing then connect after 2s
    const ringTimeout = setTimeout(() => {
      setCallState('connected');
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }, 2000);

    // Request media permissions for real device access
    if (type === 'video') {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
        .then(stream => {
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Permission denied or not available — still show UI
        });
    } else {
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then(stream => { streamRef.current = stream; })
        .catch(() => {});
    }

    return () => {
      clearTimeout(ringTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [type]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleMicToggle = () => {
    setMicMuted(m => {
      const next = !m;
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  };

  const handleVideoToggle = () => {
    setVideoOff(v => {
      const next = !v;
      streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden float-up" style={{ background: 'linear-gradient(135deg, #0a0a1f 0%, #1a0a2e 50%, #0a1a2e 100%)' }}>
        {/* Video preview (video calls) */}
        {type === 'video' && (
          <div className="relative h-64 bg-black/40 overflow-hidden">
            {!videoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover opacity-60"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <VideoOff size={40} className="text-white/30" />
              </div>
            )}
            {/* Remote user placeholder */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-3xl mb-3 border-4 border-white/20">
                {contactAvatar}
              </div>
            </div>
            {/* Small self-view */}
            {!videoOff && (
              <div className="absolute bottom-3 right-3 w-20 h-28 rounded-xl overflow-hidden border-2 border-white/20 bg-black/60">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        {/* Voice call avatar */}
        {type === 'voice' && (
          <div className="pt-12 pb-6 flex flex-col items-center">
            <div className={`w-24 h-24 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-4xl mb-4 ${callState === 'ringing' ? 'pulse-ring' : ''}`}>
              {contactAvatar}
            </div>
          </div>
        )}

        {/* Call info */}
        <div className="px-6 pb-4 text-center">
          <h3 className="font-bold text-xl text-white mb-1">{contactName}</h3>
          <p className="text-sm text-white/60">
            {callState === 'ringing'
              ? `${type === 'video' ? 'Video' : 'Voice'} calling...`
              : formatDuration(callDuration)
            }
          </p>
          {callState === 'ringing' && (
            <div className="flex justify-center gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-6 pb-8 flex items-center justify-center gap-4">
          {/* Mic */}
          <button
            onClick={handleMicToggle}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Speaker */}
          <button
            onClick={() => setSpeakerOff(s => !s)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${speakerOff ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {speakerOff ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          {/* Video toggle (video calls only) */}
          {type === 'video' && (
            <button
              onClick={handleVideoToggle}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${videoOff ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          )}

          {/* End call */}
          <button
            onClick={onEnd}
            className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatWindowPanel() {
  const { t } = useT();
  const { selectedChatId, setSelectedChatId } = useChatStore();
  const { user } = useAuth();
  const { startCall } = useCall();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    type: 'image' | 'file' | 'audio' | 'video';
    previewUrl?: string;
  } | null>(null);
  const [secureModalOpen, setSecureModalOpen] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [contact, setContact] = useState<{ name: string; avatar: string; avatarUrl?: string | null; online: boolean; lastSeen: string; publicKey?: string; userId?: string; isContact?: boolean } | null>(null);
  const [enlargeAvatar, setEnlargeAvatar] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [e2eEnabled, setE2eEnabled] = useState(false);
  const [showE2EInfo, setShowE2EInfo] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [disappearMode, setDisappearMode] = useState<'never' | '24h' | 'after_seen'>('24h');
  const [chatType, setChatType] = useState<'normal' | 'secure' | 'group'>('normal');
  // True iff the CURRENT user has marked this chat as secure on their side.
  // The other participant is independent — they may or may not have secured it.
  const [myChatSecured, setMyChatSecured] = useState(false);
  const [showDisappearMenu, setShowDisappearMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showUnlockPinModal, setShowUnlockPinModal] = useState(false);
  const [tribeRole, setTribeRole] = useState<'leader' | 'member' | null>(null);
  const [tribeSheetOpen, setTribeSheetOpen] = useState(false);
  const contactPubKeyRef = useRef<string | null>(null);
  const previousChatIdRef = useRef<string | null>(null);
  // Group E2E: cached member list (with pubkeys) for the active tribe, and a
  // per-sender pubkey cache used to decrypt received tribe messages.
  const tribeMembersRef = useRef<GroupMember[]>([]);
  const senderPubKeyCacheRef = useRef<Map<string, string>>(new Map());
  // Tribe edge-case state: when the current user joined this tribe + how
  // many members still haven't set up an encryption PIN.
  const tribeJoinedAtRef = useRef<string | null>(null);
  const [tribeMissingKeyCount, setTribeMissingKeyCount] = useState(0);
  const [tribeTotalMembers, setTribeTotalMembers] = useState(0);
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const longPressTimerRef = useRef<any>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [pendingCall, setPendingCall] = useState<'voice' | 'video' | null>(null);
  const [showCallPermPrompt, setShowCallPermPrompt] = useState(false);
  const [showMediaPermPrompt, setShowMediaPermPrompt] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiTab, setEmojiTab] = useState<EmojiCategoryKey>('smileys');
  const { permissions, requestMicrophone, requestCamera, requestMicAndCamera, requestStorage } = usePermissions();
  const [profile, setProfile] = React.useState<{ full_name?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Jump straight to the latest message. We use instant scroll (not smooth)
    // so opening a chat lands on the newest message immediately instead of
    // animating from the top — and we re-run on the next tick to account for
    // late-loading media changing the scroll height.
    const el = messagesEndRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'auto', block: 'end' });
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, 50);
    return () => clearTimeout(t);
  }, [messages, selectedChatId]);

  useEffect(() => {
    // When the active chat changes, expire seen messages in the previous one if it was 'after_seen'.
    const prev = previousChatIdRef.current;
    if (prev && prev !== selectedChatId) {
      // Fire-and-forget; RPC checks mode server-side.
      supabase.rpc('expire_seen_messages', { p_chat_id: prev }).then(() => {});
    }
    previousChatIdRef.current = selectedChatId;

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
              const groupEnc = isGroupEncrypted(text);
              if (groupEnc) {
                const sPk = await getSenderPubKey(newMsg.sender_id);
                text = sPk
                  ? await decryptGroupMessageForMe(text, user.id, sPk)
                  : '🔒 Locked';
              } else if (encrypted) {
                const pk = contactPubKeyRef.current;
                text = pk ? await decryptMessage(text, pk) : '…';
              }
              setMessages(prev => [...prev, {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                text,
                time: formatTime(newMsg.created_at),
                status: 'delivered',
                reactions: [],
                encrypted: encrypted || groupEnc,
                createdAt: newMsg.created_at,
              }]);
              // Mark as read (recipient — uses RPC to bypass RLS sender restriction)
              await supabase.rpc('mark_messages_read', { _chat_id: selectedChatId });
            }
          }
        )
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChatId}` },
          (payload) => {
            const oldMsg = payload.old as any;
            setMessages(prev => prev.filter(m => m.id !== oldMsg.id));
          }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChatId}` },
          async (payload) => {
            const upd = payload.new as any;
            // Deleted for me — remove from view
            if (Array.isArray(upd.deleted_for) && upd.deleted_for.includes(user.id)) {
              setMessages(prev => prev.filter(m => m.id !== upd.id));
              return;
            }
            // Deleted for everyone — show tombstone
            if (upd.deleted_for_everyone) {
              setMessages(prev => prev.map(m => m.id === upd.id
                ? { ...m, text: '🚫 This message was deleted', deletedForEveryone: true, encrypted: false }
                : m
              ));
              return;
            }
            // Content edited — re-decrypt if needed
            let newText: string | null = null;
            if (typeof upd.content === 'string') {
              const enc = isEncrypted(upd.content);
              const gEnc = isGroupEncrypted(upd.content);
              if (gEnc) {
                const sPk = await getSenderPubKey(upd.sender_id);
                newText = sPk
                  ? await decryptGroupMessageForMe(upd.content, user.id, sPk)
                  : '🔒 Locked';
              } else if (enc) {
                const pk = contactPubKeyRef.current;
                if (pk) newText = await decryptMessage(upd.content, pk);
              } else {
                newText = upd.content;
              }
            }
            setMessages(prev => prev.map(m => m.id === upd.id
              ? {
                  ...m,
                  status: upd.message_status || m.status,
                  text: newText !== null ? newText : m.text,
                  editedAt: upd.edited_at || m.editedAt,
                }
              : m
            ));
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChatId, user]);

  // On unmount, expire seen messages for current chat if mode is 'after_seen'.
  useEffect(() => {
    return () => {
      const id = previousChatIdRef.current;
      if (id) {
        supabase.rpc('expire_seen_messages', { p_chat_id: id }).then(() => {});
      }
    };
  }, []);

  // Local sweep: hide messages whose expires_at has passed (every 30s + on focus).
  useEffect(() => {
    if (!selectedChatId) return;
    const sweep = async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('id, expires_at')
          .eq('chat_id', selectedChatId);
        if (!data) return;
        const expiredIds = new Set(
          data.filter(m => m.expires_at && new Date(m.expires_at) < new Date()).map(m => m.id)
        );
        if (expiredIds.size) {
          setMessages(prev => prev.filter(m => !expiredIds.has(m.id)));
        }
      } catch {}
    };
    const interval = setInterval(sweep, 30000);
    return () => clearInterval(interval);
  }, [selectedChatId]);

  const loadChatData = async () => {
    if (!selectedChatId || !user) return;
    setLoading(true);
    try {
      // Note: my public_key is managed by the PIN setup flow — do not overwrite here.

      const { data: chat } = await supabase
        .from('chats')
        .select('participant_one, participant_two, disappear_mode, chat_type, is_group, name, avatar_url')
        .eq('id', selectedChatId)
        .single();

      if (chat) {
        setDisappearMode((chat as any).disappear_mode || '24h');
        setChatType(((chat as any).is_group ? 'group' : (chat as any).chat_type) || 'normal');

        // Per-user secure mark — is THIS user treating this chat as secure?
        try {
          const { data: myMark } = await supabase
            .from('user_secure_chats')
            .select('chat_id')
            .eq('user_id', user.id)
            .eq('chat_id', selectedChatId)
            .maybeSingle();
          setMyChatSecured(!!myMark);
        } catch { setMyChatSecured(false); }

        // Group chat path
        if ((chat as any).is_group) {
          const groupName = (chat as any).name || 'Group';
          setContact({
            name: groupName,
            avatar: groupName[0]?.toUpperCase() || 'G',
            online: false,
            lastSeen: 'Tribe chat',
            publicKey: undefined,
            userId: undefined,
            isContact: false,
          });
          contactPubKeyRef.current = null;
          setE2eEnabled(true);
          setIsBlocked(false);

          // Fetch caller's role in this tribe (founder is implicitly leader via DB triggers)
          try {
            const { data: myRow } = await supabase
              .from('chat_members')
              .select('role, joined_at')
              .eq('chat_id', selectedChatId)
              .eq('user_id', user.id)
              .maybeSingle();
            setTribeRole(((myRow as any)?.role as any) || null);
            tribeJoinedAtRef.current = (myRow as any)?.joined_at || null;
          } catch { setTribeRole(null); }

          // Load tribe members + their pubkeys for per-recipient encryption.
          try {
            const { data: memberRows } = await supabase
              .from('chat_members')
              .select('user_id')
              .eq('chat_id', selectedChatId);
            const memberIds = (memberRows || []).map((r: any) => r.user_id);
            if (memberIds.length) {
              const { data: profs } = await supabase
                .from('user_profiles')
                .select('id, public_key')
                .in('id', memberIds);
              const members: GroupMember[] = (profs || [])
                .filter((p: any) => !!p.public_key)
                .map((p: any) => ({ userId: p.id, publicKey: p.public_key }));
              tribeMembersRef.current = members;
              // Prime sender pubkey cache so history decrypts without extra fetches.
              for (const m of members) senderPubKeyCacheRef.current.set(m.userId, m.publicKey);
              // Track members without an encryption key (haven't set up PIN).
              const missing = (profs || []).filter((p: any) => !p.public_key).length;
              // Exclude self from "missing" count if caller hasn't set up either.
              setTribeMissingKeyCount(missing);
              setTribeTotalMembers(memberIds.length);
            } else {
              tribeMembersRef.current = [];
              setTribeMissingKeyCount(0);
              setTribeTotalMembers(0);
            }
          } catch {
            tribeMembersRef.current = [];
            setTribeMissingKeyCount(0);
            setTribeTotalMembers(0);
          }

          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', selectedChatId)
            .order('created_at', { ascending: true });

          const out: Message[] = [];
          const joinedAtMs = tribeJoinedAtRef.current
            ? new Date(tribeJoinedAtRef.current).getTime()
            : 0;
          const haveLocalKey = await hasLocalPrivateKey();
          for (const m of (msgs || [])) {
            let text = m.content;
            // Decrypt group envelope using the sender's pubkey; fall back gracefully
            // for legacy 1:1-style ciphertext or plaintext system messages.
            if (isGroupEncrypted(text)) {
              const sentBeforeJoin =
                joinedAtMs > 0 &&
                m.created_at &&
                new Date(m.created_at).getTime() < joinedAtMs &&
                m.sender_id !== user.id;
              if (sentBeforeJoin) {
                text = '🔒 Sent before you joined the tribe — not available';
              } else if (!haveLocalKey) {
                text = '🔒 Unlock encryption to read this message';
              } else {
                const sPk = await getSenderPubKey(m.sender_id);
                if (sPk) text = await decryptGroupMessageForMe(text, user.id, sPk);
                else text = '🔒 Message locked';
              }
            } else if (isEncrypted(text)) {
              text = '[Encrypted]';
            }
            out.push({
              id: m.id,
              senderId: m.sender_id,
              text,
              time: formatTime(m.created_at),
              status: m.message_status || 'sent',
              reactions: m.reactions || [],
              encrypted: isGroupEncrypted(m.content),
              messageType: (m as any).message_type || 'user',
              createdAt: m.created_at,
              deletedForEveryone: !!m.deleted_for_everyone,
            });
          }
          setMessages(out);
          await supabase.rpc('mark_messages_read', { _chat_id: selectedChatId });
          setLoading(false);
          return;
        }
        // Non-group: clear tribe role
        setTribeRole(null);
        tribeMembersRef.current = [];

        const otherUserId = chat.participant_one === user.id ? chat.participant_two : chat.participant_one;
        const { data: otherUser } = await supabase
          .from('user_profiles')
          .select('full_name, is_online, last_seen, public_key, avatar_url, profile_photo_visibility')
          .eq('id', otherUserId)
          .single();

        if (otherUser) {
          const hasE2E = !!otherUser.public_key;
          setE2eEnabled(hasE2E);
          contactPubKeyRef.current = otherUser.public_key || null;

          const preferredNickname = user ? getPreferredNickname(user.id, otherUserId) : '';
          const displayName = preferredNickname || otherUser.full_name || 'Unknown';
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.id)
            .eq('contact_id', otherUserId)
            .maybeSingle();

          // Honor profile photo privacy: only show avatar if 'all' OR ('contacts' AND we're in their contacts)
          let showAvatar = false;
          const vis = (otherUser as any).profile_photo_visibility || 'all';
          if (vis === 'all') showAvatar = true;
          else if (vis === 'contacts') {
            const { data: theyHaveUs } = await supabase
              .from('contacts').select('id')
              .eq('user_id', otherUserId).eq('contact_id', user.id).maybeSingle();
            showAvatar = !!theyHaveUs;
          }

          const isReallyOnline = !!(otherUser.is_online && (otherUser as any).last_seen && (Date.now() - new Date((otherUser as any).last_seen).getTime()) < 2 * 60 * 1000);
          setContact({
            name: displayName,
            avatar: displayName[0]?.toUpperCase() || 'U',
            avatarUrl: showAvatar ? (otherUser as any).avatar_url || null : null,
            online: isReallyOnline,
            lastSeen: isReallyOnline ? 'Online' : 'Last seen recently',
            publicKey: otherUser.public_key || undefined,
            userId: otherUserId,
            isContact: !!existingContact,
          });

          const { data: blockData } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('blocker_id', user.id)
            .eq('blocked_user_id', otherUserId)
            .single();
          setIsBlocked(!!blockData);
        }
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', selectedChatId)
        .order('created_at', { ascending: true });

      const otherKey = contactPubKeyRef.current;
      const decryptedMsgs: Message[] = [];
      for (const m of (msgs || [])) {
        // Skip messages this user has deleted-for-me
        if (Array.isArray((m as any).deleted_for) && (m as any).deleted_for.includes(user.id)) continue;
        let text = m.content;
        const tombstone = !!(m as any).deleted_for_everyone;
        const encrypted = isEncrypted(text);
        if (tombstone) {
          text = '🚫 This message was deleted';
        } else if (encrypted && otherKey) {
          text = await decryptMessage(text, otherKey);
        } else if (encrypted) {
          // Never show raw `e2e:` ciphertext to users.
          text = '[Encrypted message]';
        }
        decryptedMsgs.push({
          id: m.id,
          senderId: m.sender_id,
          text,
          time: formatTime(m.created_at),
          status: m.message_status || 'sent',
          reactions: m.reactions || [],
          encrypted,
          editedAt: (m as any).edited_at || null,
          deletedForEveryone: tombstone,
          createdAt: m.created_at,
        });
      }
      setMessages(decryptedMsgs);

      // Mark all received messages as read (uses SECURITY DEFINER RPC so RLS allows recipient updates)
      await supabase.rpc('mark_messages_read', { _chat_id: selectedChatId });

    } catch {
      setContact({ name: 'Alex Rivera', avatar: 'A', online: true, lastSeen: 'Online' });
      setMessages([
        { id: 'demo-1', senderId: 'other', text: 'Hey! Welcome to VibTribe 🎉', time: '10:30 AM', status: 'read', reactions: [] },
        { id: 'demo-2', senderId: user?.id || 'me', text: 'Thanks! This platform is amazing 🚀', time: '10:31 AM', status: 'read', reactions: ['❤️'] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // When PIN / biometric unlock completes, reload the active chat so any
  // locked placeholders are decrypted immediately without changing screens.
  useEffect(() => {
    if (!selectedChatId || !user) return;
    const handleUnlocked = () => loadChatData();
    window.addEventListener('vt-encryption-unlocked', handleUnlocked);
    return () => window.removeEventListener('vt-encryption-unlocked', handleUnlocked);
  }, [selectedChatId, user?.id]);

  useEffect(() => {
    if (user) {
      supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  }, [user]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Resolve a sender's public key (cached) for decrypting tribe messages.
  const getSenderPubKey = async (senderId: string): Promise<string | null> => {
    if (!senderId) return null;
    const cached = senderPubKeyCacheRef.current.get(senderId);
    if (cached) return cached;
    const { data } = await supabase
      .from('user_profiles')
      .select('public_key')
      .eq('id', senderId)
      .maybeSingle();
    const pk = (data as any)?.public_key || null;
    if (pk) senderPubKeyCacheRef.current.set(senderId, pk);
    return pk;
  };

  const sendMessage = async (overrideText?: string) => {
    const raw = overrideText ?? inputText;
    if (!raw.trim() || !selectedChatId || !user) return;
    // Strict E2E: 1:1 chats require both sides to have set up encryption.
    if (chatType !== 'group') {
      if (!contact?.publicKey) {
        toast.error(`${contact?.name || 'This user'} hasn't enabled encryption yet. Ask them to set up their encryption PIN.`);
        return;
      }
      const ok = await hasLocalPrivateKey();
      if (!ok) {
        toast.error('Set up or unlock your encryption PIN to send messages.');
        return;
      }
    } else {
      // Tribe send: needs the user's PIN unlocked to wrap the message key
      // for each member. Members without a pubkey will simply be skipped
      // and will see a "locked" placeholder until they set up their PIN.
      const ok = await hasLocalPrivateKey();
      if (!ok) {
        toast.error('Set up or unlock your encryption PIN to send tribe messages.');
        return;
      }
      // Refresh member pubkeys so newly-joined members (and members who
      // just enabled encryption since we opened the chat) are included.
      try {
        const { data: memberRows } = await supabase
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', selectedChatId);
        const memberIds = (memberRows || []).map((r: any) => r.user_id);
        if (memberIds.length) {
          const { data: profs } = await supabase
            .from('user_profiles')
            .select('id, public_key')
            .in('id', memberIds);
          const members: GroupMember[] = (profs || [])
            .filter((p: any) => !!p.public_key)
            .map((p: any) => ({ userId: p.id, publicKey: p.public_key }));
          tribeMembersRef.current = members;
          for (const m of members) senderPubKeyCacheRef.current.set(m.userId, m.publicKey);
          const missing = (profs || []).filter((p: any) => !p.public_key).length;
          setTribeMissingKeyCount(missing);
          setTribeTotalMembers(memberIds.length);
          if (missing > 0) {
            toast.message(
              `${missing} member${missing > 1 ? "s haven't" : " hasn't"} set up encryption — your message won't reach ${missing > 1 ? 'them' : 'them'} until they do.`,
            );
          }
        }
      } catch {
        // best-effort refresh; fall through with whatever we had cached.
      }
    }
    let text = raw.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      senderId: user.id,
      text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      reactions: [],
      encrypted: e2eEnabled,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    if (!overrideText) setInputText('');
    setShowEmoji(false);

    try {
      let contentToStore = text;
      if (chatType !== 'group' && contact?.publicKey) {
        contentToStore = await encryptMessage(text, contact.publicKey);
      } else if (chatType === 'group') {
        // Always include self so we can decrypt our own messages on other devices.
        const members = [...tribeMembersRef.current];
        const myPk = senderPubKeyCacheRef.current.get(user.id);
        if (myPk && !members.find(m => m.userId === user.id)) {
          members.push({ userId: user.id, publicKey: myPk });
        }
        if (members.length > 0) {
          contentToStore = await encryptGroupMessage(text, members);
        }
      }

      const { data } = await supabase
        .from('messages')
        .insert({ chat_id: selectedChatId, sender_id: user.id, content: contentToStore, message_status: 'sent' })
        .select()
        .single();
      if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: 'delivered', createdAt: data.created_at } : m));
        await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', selectedChatId);
        if (contact?.userId) {
          const senderName = profile?.full_name || 'Someone';
          await sendPushNotification(supabase, {
            recipient_user_id: contact.userId,
            chat_id: selectedChatId,
            title: senderName,
            body: text,
            tag: `chat-${selectedChatId}`,
            url: '/',
            type: 'message',
          });
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error(err?.message || 'Message could not be sent');
    }
  };

  const handleFileAttach = async (file: File, type: 'image' | 'file' | 'audio' | 'video') => {
    if (!file || !selectedChatId || !user) return;
    // Strict E2E: both 1:1 and group must encrypt; block if keys are missing.
    const localOk = await hasLocalPrivateKey();
    if (!localOk) {
      toast.error('Set up or unlock your encryption PIN to share files.');
      return;
    }
    if (chatType !== 'group' && !contact?.publicKey) {
      toast.error(`${contact?.name || 'This user'} hasn't enabled encryption yet.`);
      return;
    }
    // For groups, refresh members so the AES key wraps reach everyone with keys.
    let groupMembers: GroupMember[] = [];
    if (chatType === 'group') {
      try {
        const { data: memberRows } = await supabase
          .from('chat_members').select('user_id').eq('chat_id', selectedChatId);
        const memberIds = (memberRows || []).map((r: any) => r.user_id);
        if (memberIds.length) {
          const { data: profs } = await supabase
            .from('user_profiles').select('id, public_key').in('id', memberIds);
          groupMembers = (profs || [])
            .filter((p: any) => !!p.public_key)
            .map((p: any) => ({ userId: p.id, publicKey: p.public_key }));
          const myPk = senderPubKeyCacheRef.current.get(user.id);
          if (myPk && !groupMembers.find(m => m.userId === user.id)) {
            groupMembers.push({ userId: user.id, publicKey: myPk });
          }
          tribeMembersRef.current = groupMembers;
        }
      } catch {}
      if (groupMembers.length === 0) {
        toast.error('No tribe members have set up encryption yet.');
        return;
      }
    }
    setShowAttachMenu(false);
    const tempId = `temp-${Date.now()}`;
    // Auto-detect video files coming through the image picker
    if (type === 'image' && file.type?.startsWith('video/')) type = 'video';
    const isImage = type === 'image';
    const isVideo = type === 'video';
    const previewUrl = (isImage || isVideo) ? URL.createObjectURL(file) : undefined;
    const tempMsg: Message = {
      id: tempId,
      senderId: user.id,
      text: isImage ? `📷 ${file.name}` : isVideo ? `🎥 ${file.name}` : `📎 ${file.name}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      reactions: [],
      mediaUrl: previewUrl,
      mediaType: type,
      encrypted: e2eEnabled,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const isGroup = chatType === 'group';
      const use1to1E2E = !isGroup && e2eEnabled && !!contact?.publicKey;
      const useGroupE2E = isGroup && groupMembers.length > 0;
      const useE2E = use1to1E2E || useGroupE2E;
      const mime = file.type || 'application/octet-stream';
      let uploadBody: Blob = file;
      let ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      let groupMediaKey: string | null = null;
      if (use1to1E2E) {
        const plainBuf = await file.arrayBuffer();
        const cipherBuf = await encryptBytes(plainBuf, contact!.publicKey!);
        uploadBody = new Blob([cipherBuf], { type: 'application/octet-stream' });
        ext = 'enc';
      } else if (useGroupE2E) {
        const plainBuf = await file.arrayBuffer();
        const { keyB64, cipher } = await encryptBytesWithRandomKey(plainBuf);
        groupMediaKey = keyB64;
        uploadBody = new Blob([cipher], { type: 'application/octet-stream' });
        ext = 'enc';
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${selectedChatId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}_${safeName}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, uploadBody, { upsert: true, contentType: useE2E ? 'application/octet-stream' : mime });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || '';

      let content: string;
      if (use1to1E2E) {
        const envelope = `__media__:${JSON.stringify({ type, url: publicUrl, mime, name: file.name })}`;
        content = await encryptMessage(envelope, contact!.publicKey!);
      } else if (useGroupE2E) {
        const envelope = `__media__:${JSON.stringify({ type, url: publicUrl, mime, name: file.name, k: groupMediaKey, gk: true })}`;
        content = await encryptGroupMessage(envelope, groupMembers);
      } else {
        content = isImage ? `[IMAGE:${publicUrl}]` : `[FILE:${file.name}:${publicUrl}]`;
      }
      const { data } = await supabase
        .from('messages')
        .insert({ chat_id: selectedChatId, sender_id: user.id, content, message_status: 'sent' })
        .select()
        .single();
      if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: 'delivered', mediaUrl: previewUrl || publicUrl } : m));
        await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', selectedChatId);
        if (contact?.userId) {
          const senderName = profile?.full_name || 'Someone';
          await sendPushNotification(supabase, {
            recipient_user_id: contact.userId,
            chat_id: selectedChatId,
            title: senderName,
            body: isImage ? '📷 Photo' : `📎 ${file.name}`,
            tag: `chat-${selectedChatId}`,
            url: '/',
            type: 'message',
          });
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent', text: `📎 ${file.name} (upload failed)` } : m));
    }
  };

  // Convert a dataURL returned by Capacitor Camera into a File object so it
  // can flow through the same handleFileAttach() pipeline as web uploads.
  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File | null> => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    } catch (e) {
      console.warn('[VibTribe] dataUrlToFile failed', e);
      return null;
    }
  };

  // Show the captured/selected file in a preview modal so the user can
  // confirm before sending. Replaces the previous fire-and-forget upload.
  const queueAttachment = (file: File, type: 'image' | 'file' | 'audio' | 'video') => {
    if (type === 'image' && file.type?.startsWith('video/')) type = 'video';
    // Hard cap per file. Documents have a higher 250 MB cap; media
    // (photos/videos/audio) keep the existing 100 MB ceiling to avoid
    // multi-minute uploads on flaky mobile networks.
    const MAX_DOC_BYTES = 250 * 1024 * 1024;
    const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
    const limit = type === 'file' ? MAX_DOC_BYTES : MAX_MEDIA_BYTES;
    if (file.size > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      toast.error(
        type === 'file'
          ? `Documents can be up to ${mb} MB.`
          : `File is too large. Max ${mb} MB for ${type}s.`
      );
      return;
    }
    const previewUrl = (type === 'image' || type === 'video' || type === 'audio')
      ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, type, previewUrl });
  };

  const cancelPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
  };

  const sendPendingAttachment = async () => {
    if (!pendingAttachment) return;
    const { file, type, previewUrl } = pendingAttachment;
    setPendingAttachment(null);
    try {
      await handleFileAttach(file, type);
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  };

  // Pick from gallery. On native we use the Capacitor Camera plugin (it
  // prompts for READ_MEDIA_IMAGES itself). On web we synchronously click the
  // hidden file input — any await before .click() loses gesture context.
  const handlePickPhotoVideo = () => {
    if (isNativeWrapper()) {
      setShowAttachMenu(false);
      (async () => {
        // Use the system file picker so users can choose photos OR videos.
        // Camera.getPhoto() is image-only — videos never appeared in the
        // gallery sheet before.
        const picked = await pickNativeFiles({
          multiple: false,
          types: ['image/*', 'video/*'],
        });
        if (!picked.length) return;
        const p = picked[0];
        const file = await dataUrlToFile(p.dataUrl, p.name);
        if (!file) return;
        const renamed = new File([file], p.name, { type: p.mime });
        const kind: 'image' | 'video' = (p.mime || '').startsWith('video/') ? 'video' : 'image';
        queueAttachment(renamed, kind);
      })();
      return;
    }
    imageInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handlePickCamera = () => {
    if (isNativeWrapper()) {
      setShowAttachMenu(false);
      (async () => {
        const perm = await requestNativeCameraPermission();
        if (perm !== 'granted') {
          toast.error('Camera permission is required to take a photo.');
          return;
        }
        const dataUrl = await pickNativeImage({ source: 'camera' });
        if (!dataUrl) return;
        const file = await dataUrlToFile(dataUrl, `camera-${Date.now()}.jpg`);
        if (file) queueAttachment(file, 'image');
      })();
      return;
    }
    cameraInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handlePickDocument = () => {
    if (isNativeWrapper()) {
      setShowAttachMenu(false);
      (async () => {
        const picked = await pickNativeFiles({ multiple: false });
        if (!picked.length) return;
        const p = picked[0];
        const file = await dataUrlToFile(p.dataUrl, p.name);
        if (file) {
          const renamed = new File([file], p.name, { type: p.mime });
          queueAttachment(renamed, 'file');
        }
      })();
      return;
    }
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, reactions: m.reactions.includes(emoji) ? m.reactions.filter(r => r !== emoji) : [...m.reactions, emoji] }
        : m
    ));
  };

  const insertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const deleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      await supabase.from('messages').delete().eq('id', msgId);
    } catch {}
  };

  const deleteForMe = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc('delete_message_for_me', { _msg_id: msgId });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    }
  };

  const deleteForEveryone = async (msgId: string) => {
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc('delete_message_for_everyone', { _msg_id: msgId });
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, text: '🚫 This message was deleted', deletedForEveryone: true, encrypted: false }
        : m
      ));
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete for everyone');
    }
  };

  const deleteAsTribeLeader = async (msgId: string) => {
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc('tribe_delete_message_as_leader', { _msg_id: msgId });
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, text: '🚫 This message was deleted by a Tribe Leader', deletedForEveryone: true, encrypted: false }
        : m
      ));
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete as Tribe Leader');
    }
  };

  const submitEdit = async () => {
    if (!editingMsg) return;
    const newText = editText.trim();
    if (!newText) { toast.error('Message cannot be empty'); return; }
    if (chatType !== 'group') {
      if (!contact?.publicKey) { toast.error('Recipient has no encryption key.'); return; }
      const ok = await hasLocalPrivateKey();
      if (!ok) { toast.error('Unlock your encryption PIN to edit messages.'); return; }
    }
    const msgId = editingMsg.id;
    setEditingMsg(null);
    try {
      let stored = newText;
      if (chatType !== 'group' && contact?.publicKey) {
        stored = await encryptMessage(newText, contact.publicKey);
      }
      const { error } = await supabase.rpc('edit_my_message', { _msg_id: msgId, _new_content: stored });
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, text: newText, editedAt: new Date().toISOString() }
        : m
      ));
    } catch (e: any) {
      toast.error(e?.message || 'Could not edit message');
    }
  };

  const isWithinHour = (iso?: string) => {
    if (!iso) return false;
    return (Date.now() - new Date(iso).getTime()) < 60 * 60 * 1000;
  };

  const handleLongPressStart = (msg: Message) => {
    if (msg.deletedForEveryone) return;
    if (msg.messageType === 'system') return;
    const isOwn = msg.senderId === user?.id;
    const canLeaderActOnOthers = chatType === 'group' && tribeRole === 'leader' && !isOwn;
    if (!isOwn && !canLeaderActOnOthers) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => setActionMsg(msg), 500);
  };
  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const updateDisappearMode = async (mode: 'never' | '24h' | 'after_seen') => {
    if (!selectedChatId) return;
    setDisappearMode(mode);
    setShowDisappearMenu(false);
    try {
      await supabase.from('chats').update({ disappear_mode: mode }).eq('id', selectedChatId);
      // Insert a system note for transparency
      const labels = { never: 'Off', '24h': '24 hours', after_seen: 'Immediately after seen' } as const;
      await supabase.from('messages').insert({
        chat_id: selectedChatId,
        sender_id: user?.id,
        content: `⏱ Disappearing messages set to: ${labels[mode]}`,
        message_status: 'sent',
      });
    } catch {}
  };

  const handleBlockToggle = async () => {
    if (!contact?.userId || !user) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_user_id', contact.userId);
        setIsBlocked(false);
      } else {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_user_id: contact.userId });
        setIsBlocked(true);
      }
    } catch {}
    setBlockLoading(false);
  };

  const handleAddToContacts = async () => {
    if (!contact?.userId || !user) return;
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_id', contact.userId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) {
        const { error } = await supabase
          .from('contacts')
          .insert({ user_id: user.id, contact_id: contact.userId, contact_name: contact.name });
        if (error) throw error;
      }
      setContact(prev => prev ? { ...prev, isContact: true } : prev);
      window.dispatchEvent(new CustomEvent('vt-contacts-changed', {
        detail: { contactId: contact.userId, contactName: contact.name },
      }));
      toast.success(`${contact.name} added to contacts`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not add contact');
    }
  };

  // Calls now start immediately — the browser's native permission prompt handles mic/camera.
  const handleVoiceCallClick = async () => {
    if (!contact?.userId) return;
    const callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'voice', calleeName: contact.name, calleeAvatar: contact.avatar });
    if (callRow?.id) {
      const callerName = profile?.full_name || 'Someone';
      sendPushNotification(supabase, {
        user_id: contact.userId, chat_id: selectedChatId,
        title: `📞 Incoming Voice Call`, body: `${callerName} is calling you on VibTribe`,
        tag: `call-${contact.userId}`, url: '/', type: 'voice_call',
        callerId: user?.id, callId: callRow.id,
      }).catch(() => {});
    }
  };

  const handleVideoCallClick = async () => {
    if (!contact?.userId) return;
    const callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'video', calleeName: contact.name, calleeAvatar: contact.avatar });
    if (callRow?.id) {
      const callerName = profile?.full_name || 'Someone';
      sendPushNotification(supabase, {
        user_id: contact.userId, chat_id: selectedChatId,
        title: `📹 Incoming Video Call`, body: `${callerName} is calling you on VibTribe`,
        tag: `call-${contact.userId}`, url: '/', type: 'video_call',
        callerId: user?.id, callId: callRow.id,
      }).catch(() => {});
    }
  };

  const handleCallPermAllow = async () => {
    setShowCallPermPrompt(false);
    if (pendingCall === 'video') {
      await requestMicAndCamera();
      // Start real WebRTC video call
      let callRow: any = null;
      if (contact?.userId) {
        callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'video', calleeName: contact.name, calleeAvatar: contact.avatar });
      }
      // Also send push notification (best-effort)
      if (contact?.userId && callRow?.id) {
        const callerName = profile?.full_name || 'Someone';
        await sendPushNotification(supabase, {
          user_id: contact.userId,
          chat_id: selectedChatId,
          title: `📹 Incoming Video Call`,
          body: `${callerName} is calling you on VibTribe`,
          tag: `call-${contact.userId}`,
          url: '/',
          type: 'video_call',
          callerId: user?.id,
          callId: callRow.id,
        });
      }
    } else {
      await requestMicrophone();
      let callRow: any = null;
      if (contact?.userId) {
        callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'voice', calleeName: contact.name, calleeAvatar: contact.avatar });
      }
      if (contact?.userId && callRow?.id) {
        const callerName = profile?.full_name || 'Someone';
        await sendPushNotification(supabase, {
          user_id: contact.userId,
          chat_id: selectedChatId,
          title: `📞 Incoming Voice Call`,
          body: `${callerName} is calling you on VibTribe`,
          tag: `call-${contact.userId}`,
          url: '/',
          type: 'voice_call',
          callerId: user?.id,
          callId: callRow.id,
        });
      }
    }
    setPendingCall(null);
  };

  const handleCallPermDeny = () => {
    setShowCallPermPrompt(false);
    // Still allow call to proceed — browser will prompt natively
    if (contact?.userId) {
      const t = pendingCall === 'video' ? 'video' : 'voice';
      startCall({ calleeId: contact.userId, chatId: selectedChatId, type: t, calleeName: contact.name, calleeAvatar: contact.avatar });
    }
    setPendingCall(null);
  };

  const handleMediaAttachClick = () => {
    setShowMediaPermPrompt(true);
  };

  const handleMediaPermAllow = async () => {
    setShowMediaPermPrompt(false);
    await requestStorage();
    fileInputRef.current?.click();
  };

  const handleMediaPermDeny = () => {
    setShowMediaPermPrompt(false);
    fileInputRef.current?.click();
  };

  if (!selectedChatId) {
    return (
      <div className="flex-1 hidden lg:flex items-center justify-center">
        <div className="text-center float-up">
          <div className="w-24 h-24 gradient-tri rounded-full flex items-center justify-center mx-auto mb-4 glow-primary">
            <span className="text-4xl">💬</span>
          </div>
          <h3 className="font-bold text-xl text-foreground mb-2">{t('chat.selectConversation')}</h3>
          <p className="text-sm text-muted-foreground">{t('chat.selectConversation.sub')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative min-w-0 w-full max-w-full overflow-hidden" onClick={() => { setShowAttachMenu(false); setShowMoreMenu(false); setShowDisappearMenu(false); }}>
      {/* Voice Call Permission Prompt */}
      {showCallPermPrompt && (
        <PermissionPrompt
          title={pendingCall === 'video' ? 'Video Call Permissions' : 'Voice Call Permissions'}
          subtitle={pendingCall === 'video' ?'VibTribe needs access to your camera and microphone for video calls.' :'VibTribe needs access to your microphone for voice calls.'}
          permissions={pendingCall === 'video' ? [
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
              label: 'Camera',
              description: 'Required to show your video during calls',
              status: permissions.camera,
            },
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
              label: 'Microphone',
              description: 'Required to transmit your voice during calls',
              status: permissions.microphone,
            },
          ] : [
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
              label: 'Microphone',
              description: 'Required to transmit your voice during calls',
              status: permissions.microphone,
            },
          ]}
          onAllow={handleCallPermAllow}
          onDeny={handleCallPermDeny}
          allowLabel="Allow & Start Call"
          denyLabel="Skip"
        />
      )}

      {/* Media Attachment Permission Prompt */}
      {showMediaPermPrompt && (
        <PermissionPrompt
          title="Media Access"
          subtitle="VibTribe needs storage access to attach and share files."
          permissions={[
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
              label: 'Storage and Gallery',
              description: 'Access files and media from your device',
              status: permissions.storage,
            },
          ]}
          onAllow={handleMediaPermAllow}
          onDeny={handleMediaPermDeny}
          allowLabel="Allow & Attach"
          denyLabel="Skip"
        />
      )}

      {/* Call UI is rendered globally by CallProvider */}

      {/* Chat Header */}
      <div className="glass border-b border-border px-3 py-3 flex items-center gap-2 flex-shrink-0 min-w-0 max-w-full">
        <button
          className="lg:hidden -ml-1 p-2 rounded-xl text-foreground hover:bg-primary/10 active:bg-primary/20 transition-all flex-shrink-0"
          onClick={() => setSelectedChatId(null)}
          aria-label="Back to chats"
            title={t('chat.back')}
        >
          <ArrowLeft size={22} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (chatType === 'group') setTribeSheetOpen(true);
            else if (contact?.avatarUrl) setEnlargeAvatar(true);
          }}
          className="relative flex-shrink-0 focus:outline-none"
          aria-label={chatType === 'group' ? 'Tribe info' : 'View profile picture'}
        >
          {contact?.avatarUrl ? (
            <img src={contact.avatarUrl} alt={contact.name}
                 className="w-10 h-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
              {contact?.avatar || '?'}
            </div>
          )}
          {contact?.online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-vt-green rounded-full border-2 border-background" />
          )}
        </button>

        <button
          type="button"
          onClick={() => { if (chatType === 'group') setTribeSheetOpen(true); }}
          className={`flex-1 min-w-0 text-left ${chatType === 'group' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          aria-label={chatType === 'group' ? 'Open tribe info' : undefined}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate min-w-0">{contact?.name || 'Loading...'}</h3>
            {e2eEnabled && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-vt-green/10 rounded-full flex-shrink-0" title="End-to-end encrypted">
                <ShieldCheck size={10} className="text-vt-green" />
                <span className="text-[9px] text-vt-green font-medium">E2E</span>
              </div>
            )}
          </div>
          <p className={`text-xs truncate ${contact?.online ? 'text-vt-green' : 'text-muted-foreground'}`}>
            {contact?.lastSeen || ''}
          </p>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Voice Call */}
          <button
            onClick={handleVoiceCallClick}
            className="p-2 rounded-xl transition-all flex-shrink-0 text-muted-foreground hover:text-vt-green hover:bg-vt-green/10"
            title={t('chat.voiceCall')}
            aria-label="Voice call"
          >
            <Phone size={18} />
          </button>
          {/* Video Call */}
          <button
            onClick={handleVideoCallClick}
            className="p-2 rounded-xl transition-all flex-shrink-0 text-muted-foreground hover:text-vt-green hover:bg-vt-green/10"
            title={t('chat.videoCall')}
            aria-label="Video call"
          >
            <Video size={18} />
          </button>
          {/* More menu — collapses Block / Secure / Timer / Info */}
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMoreMenu(v => !v); setShowDisappearMenu(false); }}
              className={`p-2 rounded-xl transition-all flex-shrink-0 ${showMoreMenu ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title={t('chat.more')}
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>
            {showMoreMenu && (
              <div
                className="absolute right-0 top-full mt-1 z-30 glass-strong rounded-xl border border-border shadow-card overflow-hidden float-up min-w-[220px]"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => { setShowMoreMenu(false); setShowInfo(true); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                >
                  <Info size={16} className="text-muted-foreground" />
                  Chat info
                </button>
                {chatType !== 'group' && (
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false);
                      if (myChatSecured) {
                        if (!window.confirm('Move this chat back to your normal chat list? It will no longer require a PIN/pattern to access from your account. The other person is unaffected.')) return;
                        try {
                          const { error: upErr } = await supabase
                            .from('user_secure_chats')
                            .delete()
                            .eq('user_id', user!.id)
                            .eq('chat_id', selectedChatId);
                          if (upErr) throw upErr;
                          setMyChatSecured(false);
                          toast.success('Chat moved back to your normal chats');
                          setSelectedChatId(null);
                        } catch (e: any) {
                          toast.error(e?.message || 'Could not unsecure this chat');
                        }
                      } else {
                        setSecureModalOpen(true);
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                  >
                    {myChatSecured ? <ShieldOff size={16} className="text-vt-amber" /> : <Lock size={16} className="text-primary" />}
                    {myChatSecured ? 'Mark as Unsecured (for me)' : 'Mark as secure (only for me)'}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDisappearMenu(v => !v); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                >
                  <Timer size={16} className={disappearMode !== 'never' ? 'text-primary' : 'text-muted-foreground'} />
                  <span className="flex-1">Disappearing messages</span>
                  <span className="text-[10px] text-muted-foreground">
                    {disappearMode === 'never' ? 'Off' : disappearMode === '24h' ? '24h' : 'On seen'}
                  </span>
                </button>
                {showDisappearMenu && (
                  <div className="bg-muted/40 border-t border-border">
                    {([
                      { id: 'never', label: 'Off (keep forever)' },
                      { id: '24h', label: '24 hours' },
                      { id: 'after_seen', label: 'After seen (on chat exit)' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { updateDisappearMode(opt.id); setShowMoreMenu(false); }}
                        className={`w-full text-left pl-10 pr-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between ${disappearMode === opt.id ? 'text-primary font-semibold' : 'text-foreground/80'}`}
                      >
                        <span>{opt.label}</span>
                        {disappearMode === opt.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setShowMoreMenu(false); setShowUnlockPinModal(true); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                >
                  <KeyRound size={16} className="text-vt-green" />
                  <span className="flex-1">Unlock Encryption</span>
                </button>
                {chatType !== 'group' && contact?.userId && !contact.isContact && (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleAddToContacts(); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                  >
                    <UserPlus size={16} className="text-vt-green" />
                    Add to contacts
                  </button>
                )}
                <div className="border-t border-border" />
                <button
                  onClick={() => { setShowMoreMenu(false); handleBlockToggle(); }}
                  disabled={blockLoading}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 ${
                    isBlocked ? 'text-vt-green' : 'text-red-400'
                  }`}
                >
                  {isBlocked ? <ShieldOff size={16} /> : <Ban size={16} />}
                  {isBlocked ? `Unblock ${contact?.name || 'user'}` : `Block ${contact?.name || 'user'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Info Panel */}
      {showInfo && contact && (
        <div className="glass border-b border-border px-4 py-4 float-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
              {contact.avatar}
            </div>
            <div>
              <p className="font-bold text-foreground">{contact.name}</p>
              <p className={`text-xs ${contact.online ? 'text-vt-green' : 'text-muted-foreground'}`}>{contact.lastSeen}</p>
              {e2eEnabled && <p className="text-xs text-vt-green mt-0.5">🔒 End-to-end encrypted</p>}
            </div>
            <button onClick={() => setShowInfo(false)} className="ml-auto p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowInfo(false); handleVoiceCallClick(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 glass rounded-xl text-sm text-foreground hover:bg-muted transition-all"
            >
              <Phone size={14} /> Call
            </button>
            <button
              onClick={() => { setShowInfo(false); handleVideoCallClick(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 glass rounded-xl text-sm text-foreground hover:bg-muted transition-all"
            >
              <Video size={14} /> Video
            </button>
            <button
              onClick={handleBlockToggle}
              className={`flex-1 flex items-center justify-center gap-2 py-2 glass rounded-xl text-sm transition-all ${isBlocked ? 'text-vt-green' : 'text-red-400'}`}
            >
              {isBlocked ? <><ShieldOff size={14} /> Unblock</> : <><Ban size={14} /> Block</>}
            </button>
            {contact.userId && !contact.isContact && (
              <button
                onClick={handleAddToContacts}
                className="flex-1 flex items-center justify-center gap-2 py-2 glass rounded-xl text-sm text-vt-green hover:bg-vt-green/10 transition-all"
              >
                <UserPlus size={14} /> Add
              </button>
            )}
          </div>
        </div>
      )}

      {/* E2E Banner */}
      {/* Add-to-contacts banner — separate from phone contact import */}
      {chatType !== 'group' && contact?.userId && !contact.isContact && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-primary/15">
          <UserPlus size={14} className="text-primary flex-shrink-0" />
          <span className="text-[11px] text-foreground/80 flex-1 truncate">
            {contact.name} is not in your VibTribe contacts
          </span>
          <button
            onClick={handleAddToContacts}
            className="text-[11px] font-semibold text-primary hover:underline flex-shrink-0"
          >
            Add
          </button>
        </div>
      )}
      {e2eEnabled && (
        <button
          type="button"
          onClick={() => setShowE2EInfo(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-vt-green/5 border-b border-vt-green/10 hover:bg-vt-green/10 transition-colors"
        >
          <ShieldCheck size={11} className="text-vt-green" />
          <span className="text-[11px] text-vt-green underline-offset-2 hover:underline">{t('chat.e2eBanner')}</span>
        </button>
      )}
      {e2eEnabled && contact && !contact.publicKey && (
        <div className="px-4 py-2 bg-vt-amber/10 border-b border-vt-amber/20 text-center text-[11px] text-vt-amber">
          Waiting for {contact.name}'s encryption key before secure messages can be sent.
        </div>
      )}
      {chatType === 'group' && tribeMissingKeyCount > 0 && (
        <div className="px-4 py-2 bg-vt-amber/10 border-b border-vt-amber/20 text-center text-[11px] text-vt-amber">
          🔒 {tribeMissingKeyCount} of {tribeTotalMembers} member{tribeTotalMembers > 1 ? 's' : ''} haven't set up encryption yet — they won't be able to read new messages until they do.
        </div>
      )}

      {/* Blocked Banner */}
      {isBlocked && (
        <div className="flex items-center justify-center gap-2 py-2 bg-red-500/10 border-b border-red-500/20">
          <Ban size={14} className="text-red-400" />
          <span className="text-xs text-red-400">You have blocked {contact?.name}. They cannot send you messages.</span>
          <button onClick={handleBlockToggle} className="text-xs text-vt-green underline ml-1">Unblock</button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-pulse`}>
                <div className="h-10 w-48 bg-muted rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          messages.map((msg, __idx, messages) => {
            // Day-separator: render "Today" / "Yesterday" / formatted date
            // when this message falls on a different day than the previous one.
            const __sep = (() => {
              const cur = msg.createdAt ? new Date(msg.createdAt) : null;
              if (!cur || isNaN(cur.getTime())) return null;
              const prev = __idx > 0 ? messages[__idx - 1] : null;
              const prevDate = prev?.createdAt ? new Date(prev.createdAt) : null;
              const sameDay = prevDate && !isNaN(prevDate.getTime())
                && prevDate.toDateString() === cur.toDateString();
              if (sameDay) return null;
              const today = new Date();
              const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
              let label: string;
              if (cur.toDateString() === today.toDateString()) label = 'Today';
              else if (cur.toDateString() === yesterday.toDateString()) label = 'Yesterday';
              else label = cur.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: cur.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
              return (
                <div key={`sep-${msg.id}`} className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground px-3 py-1 glass rounded-full">{label}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              );
            })();
            const isMe = msg.senderId === user?.id;
            const isImageMsg = msg.text?.startsWith('[IMAGE:') || msg.mediaType === 'image';
            const isFileMsg = msg.text?.startsWith('[FILE:') || msg.mediaType === 'file';
            const missedMatch = typeof msg.text === 'string' && msg.text.startsWith('__missed_call__:')
              ? msg.text.split(':') : null;
            const isMissedCall = !!missedMatch;
            const callLogMatch = typeof msg.text === 'string' && msg.text.startsWith('__call_log__:')
              ? msg.text.split(':') : null;
            if (callLogMatch) {
              const kind = callLogMatch[1] || 'voice';
              const dur = parseInt(callLogMatch[2] || '0', 10);
              const mm = String(Math.floor(dur / 60)).padStart(2, '0');
              const ss = String(dur % 60).padStart(2, '0');
              const when = new Date(msg.time ? Date.now() : Date.now()).toLocaleString();
              return (
                <React.Fragment key={msg.id}>
                  {__sep}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="glass border border-border rounded-2xl px-4 py-2.5 text-sm flex items-center gap-3">
                      {kind === 'video' ? <Video size={16} className="text-vt-green" /> : <Phone size={16} className="text-vt-green" />}
                      <div className="flex flex-col">
                        <span className="text-foreground/90">{kind === 'video' ? 'Video' : 'Voice'} call · {mm}:{ss}</span>
                        <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            }
            if (isMissedCall) {
              const callKind = missedMatch![1] || 'voice';
              return (
                <React.Fragment key={msg.id}>
                  {__sep}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="glass border border-border rounded-2xl px-4 py-2.5 text-sm flex items-center gap-3">
                    <PhoneOff size={16} className="text-red-400" />
                    <div className="flex flex-col">
                      <span className="text-red-400 font-medium">
                        {isMe ? `Missed ${callKind} call` : `You missed a ${callKind} call`}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                    </div>
                    {isMe && contact?.userId && (
                      <button
                        onClick={() => startCall({ calleeId: contact.userId!, chatId: selectedChatId, type: callKind as 'voice'|'video', calleeName: contact.name, calleeAvatar: contact.avatar })}
                        className="ml-2 px-3 py-1 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-all">
                        Call back
                      </button>
                    )}
                    </div>
                  </div>
                </React.Fragment>
              );
            }
            // Defensive: never render raw `e2e:` ciphertext
            const safeText = isEncrypted(msg.text) ? '[Encrypted message]' : msg.text;
            // Tribe system message — render centered grey pill
            if (msg.messageType === 'system') {
              return (
                <React.Fragment key={msg.id}>
                  {__sep}
                  <div className="flex justify-center">
                    <span className="text-[11px] text-muted-foreground px-3 py-1 glass rounded-full border border-border/60 text-center max-w-[80%]">
                      {safeText}
                    </span>
                  </div>
                </React.Fragment>
              );
            }
            // Encrypted-media envelope (text after decryption)
            let encMedia: { type: 'image'|'file'|'audio'|'video'; url: string; mime: string; name?: string; k?: string; gk?: boolean } | null = null;
            if (typeof safeText === 'string' && safeText.startsWith('__media__:')) {
              try { encMedia = JSON.parse(safeText.slice('__media__:'.length)); } catch {}
            }
            // Back-compat: legacy messages stored video as type 'image' or 'file'.
            if (encMedia && encMedia.mime?.startsWith('video/') && encMedia.type !== 'video') {
              encMedia.type = 'video';
            }
            const isRemovedStickerMsg = typeof safeText === 'string' && safeText.startsWith('[STICKER:');
            const displayText = encMedia
              ? (encMedia.type === 'image' ? '📷 Photo' : encMedia.type === 'video' ? '🎥 Video' : encMedia.type === 'audio' ? '🎵 Audio' : `📎 ${encMedia.name || 'File'}`)
              : isImageMsg
              ? '📷 Image'
              : isFileMsg
              ? `📎 ${safeText?.replace(/\[FILE:(.*?):(.*?)\]/, '$1') || 'File'}`
              : isRemovedStickerMsg
              ? 'Message removed'
              : safeText;
            const imageUrl = isImageMsg
              ? (msg.mediaUrl || msg.text?.replace('[IMAGE:', '').replace(']', ''))
              : null;

            return (
              <React.Fragment key={msg.id}>
              {__sep}
              <div
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                onMouseEnter={() => setHoveredMsg(msg.id)}
                onMouseLeave={() => setHoveredMsg(null)}
              >
                <div
                  className={`relative max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}
                  onTouchStart={() => handleLongPressStart(msg)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onContextMenu={(e) => {
                    if (msg.deletedForEveryone || msg.messageType === 'system') return;
                    const canOpen = (msg.senderId === user?.id) || (chatType === 'group' && tribeRole === 'leader');
                    if (canOpen) { e.preventDefault(); setActionMsg(msg); }
                  }}
                >
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.deletedForEveryone
                        ? 'glass border border-dashed border-border text-muted-foreground italic'
                      : isMe
                        ? 'gradient-primary text-white rounded-br-sm' : 'glass border border-border text-foreground rounded-bl-sm'
                    }`}
                  >
                    {encMedia && (encMedia.k || contactPubKeyRef.current) ? (
                      isMe && msg.mediaUrl && msg.mediaUrl.startsWith('blob:') && encMedia.type === 'image' ? (
                        <img
                          src={msg.mediaUrl}
                          alt={encMedia.name || 'Shared image'}
                          className="max-w-[200px] rounded-xl cursor-zoom-in"
                          onClick={() => setLightboxUrl(msg.mediaUrl!)}
                        />
                      ) : (
                        <EncryptedMedia
                          url={encMedia.url}
                          mime={encMedia.mime}
                          name={encMedia.name}
                          kind={encMedia.type}
                          theirPublicKey={contactPubKeyRef.current || undefined}
                          mediaKey={encMedia.k}
                          onImageClick={(u) => setLightboxUrl(u)}
                        />
                      )
                    ) : imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Shared image"
                        className="max-w-[200px] rounded-xl cursor-zoom-in"
                        onClick={() => setLightboxUrl(imageUrl)}
                      />
                    ) : (
                      <>
                        {displayText}
                        {msg.editedAt && !msg.deletedForEveryone && (
                          <span className={`ml-1 text-[10px] italic ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>(edited)</span>
                        )}
                        {msg.encrypted && (
                          <ShieldCheck size={9} className={`inline ml-1 ${isMe ? 'text-white/60' : 'text-vt-green/60'}`} />
                        )}
                      </>
                    )}
                  </div>

                  {msg.reactions.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {msg.reactions.map((r, i) => (
                        <span key={i} className="text-sm bg-muted rounded-full px-1.5 py-0.5 text-xs">{r}</span>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                    {isMe && (
                      msg.status === 'read' ? <CheckCheck size={12} className="text-primary" /> :
                      msg.status === 'delivered' ? <CheckCheck size={12} className="text-muted-foreground" /> :
                      <Check size={12} className="text-muted-foreground" />
                    )}
                  </div>

                  {hoveredMsg === msg.id && (
                    <div className={`absolute -top-9 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 glass-strong rounded-xl border border-border px-2 py-1 float-up z-10 shadow-card`}>
                      {['❤️','😂','😮','😢','👍'].map(emoji => (
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
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attach Menu */}
      {showAttachMenu && (
        <div className="absolute bottom-20 left-16 z-20 glass-strong rounded-2xl border border-border shadow-card p-3 float-up" onClick={e => e.stopPropagation()}>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <button
              onClick={handlePickPhotoVideo}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-all text-sm text-foreground"
            >
              <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Image size={16} className="text-blue-400" />
              </div>
              Photo / Video
            </button>
            <button
              onClick={handlePickDocument}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-all text-sm text-foreground"
            >
              <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <FileText size={16} className="text-purple-400" />
              </div>
              Document
            </button>
            <button
              onClick={handlePickCamera}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-all text-sm text-foreground"
            >
              <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Camera size={16} className="text-green-400" />
              </div>
              Camera
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) queueAttachment(file, 'image');
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) queueAttachment(file, 'file');
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) queueAttachment(file, 'image');
          e.target.value = '';
        }}
      />

      {/* Attachment Preview Modal — confirm before upload/send */}
      {pendingAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={cancelPendingAttachment}
        >
          <div
            className="glass-strong rounded-2xl border border-border shadow-card p-4 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Send attachment</h3>
              <button
                onClick={cancelPendingAttachment}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-center bg-muted/30 rounded-xl overflow-hidden mb-3 max-h-[60vh]">
              {pendingAttachment.type === 'image' && pendingAttachment.previewUrl && (
                <img
                  src={pendingAttachment.previewUrl}
                  alt="Preview"
                  className="max-h-[60vh] w-auto object-contain"
                />
              )}
              {pendingAttachment.type === 'video' && pendingAttachment.previewUrl && (
                <video
                  src={pendingAttachment.previewUrl}
                  controls
                  playsInline
                  className="max-h-[60vh] w-auto"
                />
              )}
              {pendingAttachment.type === 'audio' && pendingAttachment.previewUrl && (
                <audio src={pendingAttachment.previewUrl} controls className="w-full p-4" />
              )}
              {pendingAttachment.type === 'file' && (
                <div className="flex items-center gap-3 p-6 w-full">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText size={24} className="text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {pendingAttachment.file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(pendingAttachment.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground mb-3 truncate">
              {pendingAttachment.file.name}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelPendingAttachment}
                className="px-4 py-2 rounded-xl text-sm text-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                onClick={sendPendingAttachment}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Send size={14} />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Unlock Encryption modal — accessible from chat menu */}
      {showUnlockPinModal && user && (
        <EncryptionPinModal
          userId={user.id}
          mode="unlock"
          onComplete={() => {
            setShowUnlockPinModal(false);
            try {
              sessionStorage.setItem(`vt_pin_session_${user.id}`, '1');
              localStorage.setItem(`vt_pin_last_verified_${user.id}`, String(Date.now()));
              window.dispatchEvent(new CustomEvent('vt-encryption-unlocked'));
            } catch {}
          }}
          onSkip={() => setShowUnlockPinModal(false)}
        />
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <div
          className="absolute bottom-20 left-2 right-2 sm:left-4 sm:right-auto sm:w-[360px] z-30 glass-strong rounded-2xl border border-border shadow-card p-3 float-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1 mb-3 p-1 bg-muted/50 rounded-xl overflow-x-auto no-scrollbar">
            {EMOJI_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setEmojiTab(cat.key)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-base transition-all ${emojiTab === cat.key ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label={cat.label}
                title={cat.label}
                type="button"
              >
                {cat.icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-72 overflow-y-auto">
            {(EMOJI_CATEGORIES.find(c => c.key === emojiTab)?.emojis || []).map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => insertEmoji(emoji)}
                className="aspect-square flex items-center justify-center text-2xl rounded-lg hover:bg-muted active:scale-90 transition-all"
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="glass border-t border-border px-2 py-2 flex items-center gap-1 flex-shrink-0 w-full max-w-full overflow-hidden">
        <button
          onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
          className={`p-2 rounded-xl transition-all flex-shrink-0 ${showAttachMenu ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          aria-label="Attach"
        >
          <Paperclip size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowEmoji(v => !v); }}
          className={`p-2 rounded-xl transition-all flex-shrink-0 ${showEmoji ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          aria-label="Emoji"
        >
          <Smile size={20} />
        </button>
        <input
          ref={inputRef}
          type="text"
          name="chat-message"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck={true}
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          enterKeyHint="send"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={e2eEnabled ? t('chat.typeEncrypted') : t('chat.type')}
          className="flex-1 min-w-0 bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
        />
        {inputText.trim() ? (
          <button
            onClick={() => sendMessage()}
            className="p-2.5 gradient-primary rounded-xl text-white hover:opacity-90 transition-all glow-primary flex-shrink-0"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
            aria-label="Record voice"
          >
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

      {/* Long-press action sheet for own messages */}
      {actionMsg && (
        <div
          className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4"
          onClick={() => setActionMsg(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-card float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Message options</p>
              <p className="text-sm text-foreground truncate mt-0.5">{formatPreviewText(actionMsg.text)}</p>
            </div>
            {actionMsg.senderId === user?.id && (
              <button
                onClick={() => {
                  setEditingMsg(actionMsg);
                  setEditText(actionMsg.text);
                  setActionMsg(null);
                }}
                disabled={!isWithinHour(actionMsg.createdAt)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground disabled:opacity-40"
              >
                ✏️ Edit message
                {!isWithinHour(actionMsg.createdAt) && <span className="ml-auto text-[10px] text-muted-foreground">expired</span>}
              </button>
            )}
            <button
              onClick={() => deleteForMe(actionMsg.id)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground border-t border-border"
            >
              🗑️ Delete for me
            </button>
            {actionMsg.senderId === user?.id && (
              <button
                onClick={() => deleteForEveryone(actionMsg.id)}
                disabled={!isWithinHour(actionMsg.createdAt)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-red-400 border-t border-border disabled:opacity-40"
              >
                🗑️ Delete for everyone
                {!isWithinHour(actionMsg.createdAt) && <span className="ml-auto text-[10px] text-muted-foreground">past 1 hour</span>}
              </button>
            )}
            {chatType === 'group' && tribeRole === 'leader' && (
              <button
                onClick={() => deleteAsTribeLeader(actionMsg.id)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-red-400 border-t border-border"
              >
                🛡️ Delete as Tribe Leader
                <span className="ml-auto text-[10px] text-muted-foreground">removes for everyone</span>
              </button>
            )}
            <button
              onClick={() => setActionMsg(null)}
              className="w-full text-center px-4 py-3 text-sm hover:bg-muted transition-colors text-muted-foreground border-t border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit message modal */}
      {editingMsg && (
        <div
          className="fixed inset-0 z-[1600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingMsg(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-card float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm text-foreground mb-3">Edit message</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              autoFocus
              className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setEditingMsg(null)}
                className="flex-1 py-2.5 rounded-xl glass text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showE2EInfo && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowE2EInfo(false)}>
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-vt-green/15 flex items-center justify-center">
                <ShieldCheck size={20} className="text-vt-green" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">End-to-end encrypted</h3>
                <p className="text-[11px] text-muted-foreground">Your privacy is our priority</p>
              </div>
              <button onClick={() => setShowE2EInfo(false)} className="ml-auto p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs text-foreground/90 leading-relaxed">
              <p>
                Messages and calls in this chat are secured with <strong>end-to-end encryption</strong>.
                Only you and <strong>{contact?.name || 'the other person'}</strong> can read what is sent —
                <strong> no one else, not even VibTribe</strong>, can access them.
              </p>
              <div className="rounded-lg bg-vt-green/5 border border-vt-green/15 p-3 space-y-1.5">
                <p className="flex items-start gap-2"><ShieldCheck size={13} className="text-vt-green mt-0.5"/> Your message is locked before it leaves your phone.</p>
                <p className="flex items-start gap-2"><Lock size={13} className="text-vt-green mt-0.5"/> Only you and {contact?.name || 'the other person'} can open and read it.</p>
                <p className="flex items-start gap-2"><ShieldOff size={13} className="text-vt-green mt-0.5"/> VibTribe cannot see your private chat content.</p>
              </div>
            </div>
            <button onClick={() => setShowE2EInfo(false)}
                    className="mt-4 w-full py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold">Got it</button>
          </div>
        </div>
      )}

      {/* Enlarged profile picture viewer */}
      {enlargeAvatar && contact?.avatarUrl && (
        <div
          className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          style={{ paddingTop: 'calc(min(var(--safe-top), 2.25rem) + 1rem)', paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}
          onClick={() => setEnlargeAvatar(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setEnlargeAvatar(false); }}
            className="absolute right-4 p-3 rounded-full bg-white/20 text-white hover:bg-white/30 z-10"
            style={{ top: 'calc(min(var(--safe-top), 2.25rem) + 0.75rem)' }}
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <img
            src={contact.avatarUrl}
            alt={contact.name}
            className="max-w-full max-h-[80vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Lightbox for chat media images */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          style={{ paddingTop: 'calc(min(var(--safe-top), 2.25rem) + 1rem)', paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
            className="absolute right-4 p-3 rounded-full bg-white/20 text-white hover:bg-white/30 z-10"
            style={{ top: 'calc(min(var(--safe-top), 2.25rem) + 0.75rem)' }}
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxUrl}
            alt="Media preview"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {tribeSheetOpen && selectedChatId && chatType === 'group' && (
        <TribeDetailsSheet
          chatId={selectedChatId}
          isOpen={tribeSheetOpen}
          onClose={() => setTribeSheetOpen(false)}
          onLeft={() => { setSelectedChatId(null); }}
        />
      )}
    </div>
  );
}