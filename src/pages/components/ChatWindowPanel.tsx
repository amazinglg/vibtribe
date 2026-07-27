// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Phone, Video, Paperclip, Mic, MicOff, Send, Lock, CheckCheck, Check, ArrowLeft, Info, Trash2, ShieldCheck, Ban, ShieldOff, X, Image, FileText, Camera, VideoOff, PhoneOff, Volume2, VolumeX, Timer, MoreVertical, UserPlus, Smile, KeyRound, Shield, ShieldAlert, Plus, Flag } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import MarkSecureModal from '@/components/MarkSecureModal';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateKeyPair, encryptMessage, decryptMessage, isEncrypted, encryptBytes, encryptBytesWithRandomKey, hasLocalPrivateKey, encryptGroupMessage, decryptGroupMessageForMe, isGroupEncrypted, type GroupMember } from '@/lib/encryption';
import { decryptBytes, decryptBytesWithKey } from '@/lib/encryption';
import { signChatMediaUrl } from '@/lib/chat-media-url';
import EncryptedMedia from '@/components/EncryptedMedia';
import ChatMediaImg from '@/components/ChatMediaImg';
import MediaViewer, { type ViewerSource } from '@/components/MediaViewer';
import { getPreferredNickname } from '@/components/SecureVaultModal';
import PermissionPrompt from '@/components/PermissionPrompt';
import { usePermissions } from '@/hooks/usePermissions';
import { sendPushNotification } from '@/lib/pushNotifications';
import { useCall } from '@/components/CallProvider';
import { isCapacitorWrapper, isNativeWrapper, pickNativeImage, pickNativeFiles, pickNativeMedia, requestNativeCameraPermission } from '@/lib/native-bridge';
import { TrustLockService, onTrustLockScreenshot, isIOS, isIosPwa } from '@/lib/trust-lock-service';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { EMOJI_CATEGORIES, type EmojiCategoryKey } from '@/lib/emojis';
import { VIBTRIBE_EMOJI_MAP, VIBTRIBE_SHORTCODE_RE, renderVtEmojis } from '@/lib/vibtribe-emojis';
import { useT } from '@/contexts/LanguageContext';
import TribeDetailsSheet from '@/components/TribeDetailsSheet';
import EncryptionPinModal from '@/components/EncryptionPinModal';
import { TrustLockProvider } from '@/contexts/TrustLockContext';
import ForwardMessageModal from '@/components/ForwardMessageModal';
import { appConfirm } from '@/components/ui/AppDialog';
import ReportContentSheet, { type ReportType } from '@/components/ReportContentSheet';

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

/**
 * Strip media envelope / marker prefixes so long-press message previews show
 * a human label instead of the raw JSON `__media__:{...}` blob.
 */
function formatPreviewText(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw.startsWith('__media__:')) {
    try {
      const m = JSON.parse(raw.slice('__media__:'.length));
      if (m?.type === 'image') return '📷 Photo';
      if (m?.type === 'video') return '🎥 Video';
      if (m?.type === 'audio') return '🎵 Audio';
      return `📎 ${m?.name || 'File'}`;
    } catch { return 'Media'; }
  }
  if (raw.startsWith('[IMAGE:')) return '📷 Image';
  if (raw.startsWith('[FILE:')) {
    const m = raw.match(/\[FILE:(.*?):(.*?)\]/);
    return `📎 ${m?.[1] || 'File'}`;
  }
  if (raw.startsWith('[STICKER:')) return 'Sticker';
  return raw;
}

// Renders plain text with auto-detected URLs as clickable links.
// Supports http(s)://, www., and bare domain.tld links.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|co|app|in|dev|me|xyz|gg|so|to|tv|info)(?:\/[^\s<>"']*)?)/gi;

/**
 * Detect "solo emoji" messages — a single emoji and nothing else (no text,
 * no whitespace, no second emoji). Used to render that single emoji larger
 * (sticker-style), the same way iMessage / WhatsApp / Telegram boost
 * lone-emoji messages.
 */
function isSoloEmojiText(s: string): boolean {
  const t = (s ?? '').trim();
  if (!t) return false;
  // Single VibTribe shortcode only — no surrounding chars.
  if (/^:vt:[a-z0-9_-]+:$/.test(t)) return true;
  // Single unicode emoji (allow variation selectors + ZWJ sequences,
  // but reject if any non-emoji text characters remain).
  const stripped = t.replace(/[\uFE0F\u200D\s]/g, '');
  try {
    const matches = stripped.match(/\p{Extended_Pictographic}/gu);
    if (!matches || matches.length !== 1) return false;
    const nonEmoji = stripped.replace(/\p{Extended_Pictographic}/gu, '');
    return nonEmoji.length === 0;
  } catch {
    return false;
  }
}

function Linkified({ text, isMe, boost = false }: { text: string; isMe: boolean; boost?: boolean }) {
  // First split by VibTribe image-emoji shortcodes, then linkify the
  // remaining text segments. This keeps custom emojis rendering inline
  // alongside auto-linked URLs without breaking either pipeline.
  const src = String(text ?? '');
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(VIBTRIBE_SHORTCODE_RE.source, 'g');
  const imgClass = boost
    ? 'inline-block align-middle w-[3em] h-[3em] mx-[1px] select-none'
    : 'inline-block align-[-0.25em] w-[1.5em] h-[1.5em] mx-[1px] select-none';
  while ((match = re.exec(src)) !== null) {
    if (match.index > lastIndex) nodes.push(src.slice(lastIndex, match.index));
    const emoji = VIBTRIBE_EMOJI_MAP[match[1]];
    if (emoji) {
      nodes.push(
        <img
          key={`vt-${match.index}`}
          src={emoji.url}
          alt={emoji.name}
          draggable={false}
          className={imgClass}
          loading="lazy"
          decoding="async"
        />
      );
    } else {
      nodes.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < src.length) nodes.push(src.slice(lastIndex));

  const linkColor = isMe ? 'text-white hover:text-white/80' : 'text-primary hover:text-primary/80';
  return (
    <span className={`whitespace-pre-wrap break-words ${boost ? 'text-5xl leading-tight' : ''}`}>
      {nodes.map((node, ni) => {
        if (typeof node !== 'string') return <React.Fragment key={`n-${ni}`}>{node}</React.Fragment>;
        const parts = node.split(URL_RE);
        return (
          <React.Fragment key={`s-${ni}`}>
            {parts.map((p, i) => {
              if (!p) return null;
              if (URL_RE.test(p)) {
                URL_RE.lastIndex = 0;
                const href = /^https?:\/\//i.test(p) ? p : `https://${p}`;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`underline underline-offset-2 break-all ${linkColor}`}
                  >
                    {p}
                  </a>
                );
              }
              return <React.Fragment key={i}>{p}</React.Fragment>;
            })}
          </React.Fragment>
        );
      })}
    </span>
  );
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
  const { user, profile: myProfile } = useAuth();
  const { startCall } = useCall();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  // Per-chat draft persistence: keep typed-but-unsent text per chat until the user
  // either sends it or clears the box themselves. Survives chat switches and reloads.
  const draftsRef = useRef<Record<string, string>>({});
  const draftsHydrated = useRef<string | null>(null);
  const draftsKey = user?.id ? `vt:chat-drafts_${user.id}` : 'vt:chat-drafts__anon';
  if (draftsHydrated.current !== draftsKey) {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftsKey) : null;
      draftsRef.current = raw ? (JSON.parse(raw) || {}) : {};
    } catch { draftsRef.current = {}; }
    draftsHydrated.current = draftsKey;
  }
  const persistDrafts = () => {
    try { window.localStorage.setItem(draftsKey, JSON.stringify(draftsRef.current)); } catch {}
  };
  const [showInfo, setShowInfo] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{
    file: File;
    type: 'image' | 'file' | 'audio' | 'video';
    previewUrl?: string;
  }>>([]);
  const [secureModalOpen, setSecureModalOpen] = useState(false);
  const [showUnsecureConfirm, setShowUnsecureConfirm] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [contact, setContact] = useState<{ name: string; avatar: string; avatarUrl?: string | null; online: boolean; lastSeen: string; publicKey?: string; userId?: string; isContact?: boolean } | null>(null);
  const [enlargeAvatar, setEnlargeAvatar] = useState(false);
  const [lightbox, setLightbox] = useState<ViewerSource | null>(null);
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
  // Trust Lock — per-chat privacy toggle (1:1 only). Owner_user_id is the
  // user who turned it on; only they can turn it back off.
  const [trustLock, setTrustLock] = useState<{ enabled: boolean; ownerUserId: string | null }>({ enabled: false, ownerUserId: null });
  const [trustLockBusy, setTrustLockBusy] = useState(false);
  const [trustLockProtected, setTrustLockProtected] = useState<boolean | null>(false);
  const [showTrustLockConfirm, setShowTrustLockConfirm] = useState(false);
  const [showTrustLockInfo, setShowTrustLockInfo] = useState(false);
  const trustLockAttemptRef = useRef(0);
  const [tribeRole, setTribeRole] = useState<'leader' | 'member' | null>(null);
  const [tribeIsFounder, setTribeIsFounder] = useState(false);
  const [showDeleteTribeConfirm, setShowDeleteTribeConfirm] = useState(false);
  const [showLeaveTribeConfirm, setShowLeaveTribeConfirm] = useState(false);
  const [deletingTribe, setDeletingTribe] = useState(false);
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
  const [reactionPickerMsg, setReactionPickerMsg] = useState<Message | null>(null);
  const [reportTarget, setReportTarget] = useState<null | {
    reportType: ReportType;
    reportedUserId?: string;
    chatId?: string;
    messageId?: string;
    snapshot?: any;
  }>(null);
  const [forwardTexts, setForwardTexts] = useState<string[] | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Track when to auto-scroll: only on chat open or when a NEW message arrives,
  // never on in-place updates (reactions, edits, status changes) — otherwise
  // reacting on an older message would yank the user to the bottom.
  const lastScrollKeyRef = useRef<string>('');
  const prevChatIdScrollRef = useRef<string | null>(null);
  const prevLenRef = useRef<number>(0);
  // First unread message id captured on chat open (before mark_messages_read).
  // If set, we scroll to that message instead of the bottom on open.
  const firstUnreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lastId = messages.length ? messages[messages.length - 1].id : '';
    const key = `${selectedChatId || ''}::${messages.length}::${lastId}`;
    if (key === lastScrollKeyRef.current) return;
    const chatChanged = prevChatIdScrollRef.current !== selectedChatId;
    const grew = messages.length > prevLenRef.current;
    lastScrollKeyRef.current = key;
    prevChatIdScrollRef.current = selectedChatId || null;
    prevLenRef.current = messages.length;
    // Only auto-scroll when opening a chat or when a new message is appended.
    // Skip on in-place updates AND on deletions (delete-for-me, etc.) so
    // tapping an action sheet doesn't yank the user to the bottom.
    if (!chatChanged && !grew) return;
    // On chat-open, if we captured a first-unread message, scroll to it.
    // Otherwise (no unread, or a new message just arrived), scroll to bottom.
    const scrollToBottom = () => {
      // Prefer directly pinning the scroll container: it works even when
      // the end sentinel hasn't reached its final position yet (late-loading
      // media, fonts, reactions). Fall back to scrollIntoView.
      const el = messagesContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    };
    const unreadId = chatChanged ? firstUnreadIdRef.current : null;
    if (unreadId) {
      firstUnreadIdRef.current = null;
      const target = document.querySelector<HTMLElement>(`[data-msg-id="${unreadId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        const t = setTimeout(() => {
          document.querySelector<HTMLElement>(`[data-msg-id="${unreadId}"]`)
            ?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
        return () => clearTimeout(t);
      }
      // Fallback: bottom
      scrollToBottom();
      return;
    }
    // Pin to bottom immediately, then re-pin as late-loading content (images,
    // audio waveforms, reactions) expands the list. On chat-open we also
    // watch the container with a ResizeObserver for ~1s so the view stays
    // stuck to the newest message even if a big image decodes late.
    scrollToBottom();
    const timers = [0, 50, 150, 350, 700, 1200].map(ms => setTimeout(scrollToBottom, ms));
    let ro: ResizeObserver | undefined;
    let roStop: ReturnType<typeof setTimeout> | undefined;
    if (chatChanged && typeof ResizeObserver !== 'undefined' && messagesContainerRef.current) {
      ro = new ResizeObserver(() => scrollToBottom());
      ro.observe(messagesContainerRef.current);
      roStop = setTimeout(() => ro?.disconnect(), 1500);
    }
    return () => {
      timers.forEach(clearTimeout);
      if (roStop) clearTimeout(roStop);
      ro?.disconnect();
    };
  }, [messages, selectedChatId]);

  useEffect(() => {
    // When the active chat changes, expire seen messages in the previous one if it was 'after_seen'.
    const prev = previousChatIdRef.current;
    if (prev && prev !== selectedChatId) {
      // Fire-and-forget; RPC checks mode server-side.
      supabase.rpc('expire_seen_messages', { p_chat_id: prev }).then(() => {});
      // Save current draft for the previous chat before switching.
      draftsRef.current[prev] = inputText;
      persistDrafts();
    }
    previousChatIdRef.current = selectedChatId;
    // Load draft for the newly selected chat (or empty string if none).
    if (selectedChatId) {
      setInputText(draftsRef.current[selectedChatId] ?? '');
    } else {
      setInputText('');
    }

    if (selectedChatId && user) {
      loadChatData();
      // Clear stale header/messages immediately so the previous chat's
      // contact info doesn't briefly render while the new chat loads.
      setContact(null);
      setMessages([]);
      setTribeRole(null);
      contactPubKeyRef.current = null;
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
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${selectedChatId}` },
          (payload) => {
            const updatedChat = payload.new as any;
            if (!updatedChat?.is_group) return;
            const groupName = updatedChat.name || contact?.name || 'Group';
            setContact(prev => ({
              ...(prev || {
                name: groupName,
                avatar: groupName[0]?.toUpperCase() || 'G',
                online: false,
                lastSeen: 'Tribe chat',
                isContact: false,
              }),
              name: groupName,
              avatar: groupName[0]?.toUpperCase() || 'G',
              avatarUrl: updatedChat.avatar_url || null,
            }));
          }
        )
        .subscribe();
      const onTribeAvatarUpdated = (event: Event) => {
        const detail = (event as CustomEvent<{ chatId?: string; avatarUrl?: string | null }>).detail;
        if (detail?.chatId !== selectedChatId) return;
        setContact(prev => prev ? { ...prev, avatarUrl: detail.avatarUrl || null } : prev);
      };
      window.addEventListener('vt-tribe-avatar-updated', onTribeAvatarUpdated);
      return () => {
        window.removeEventListener('vt-tribe-avatar-updated', onTribeAvatarUpdated);
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChatId, user]);

  // Persist the in-progress draft for the current chat on every keystroke so it
  // survives page reloads. Cleared only on send or when the user empties the box.
  useEffect(() => {
    if (!selectedChatId) return;
    if (inputText && inputText.length > 0) {
      draftsRef.current[selectedChatId] = inputText;
    } else {
      delete draftsRef.current[selectedChatId];
    }
    persistDrafts();
  }, [inputText, selectedChatId]);

  // Heartbeat "I am actively viewing this chat" so server-side push logic can
  // suppress notifications for the conversation the user is already looking at.
  // Row is written while the chat window is mounted AND the tab is visible.
  // Cleared on unmount / chat switch / tab hidden.
  useEffect(() => {
    if (!selectedChatId || !user) return;
    let cancelled = false;
    let interval: number | null = null;

    const write = async () => {
      if (cancelled) return;
      try {
        await supabase.from('user_active_chat').upsert({
          user_id: user.id,
          chat_id: selectedChatId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch {}
    };
    const clear = async () => {
      try {
        await supabase.from('user_active_chat').upsert({
          user_id: user.id,
          chat_id: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch {}
    };

    const start = () => {
      if (interval != null) return;
      void write();
      interval = window.setInterval(write, 8_000);
    };
    const stop = () => {
      if (interval != null) { window.clearInterval(interval); interval = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else { stop(); void clear(); }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', clear);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', clear);
      void clear();
    };
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
        .select('participant_one, participant_two, disappear_mode, chat_type, is_group, name, avatar_url, created_by')
        .eq('id', selectedChatId)
        .single();

      if (chat) {
        setDisappearMode((chat as any).disappear_mode || '24h');
        setChatType(((chat as any).is_group ? 'group' : (chat as any).chat_type) || 'normal');
        setTribeIsFounder(((chat as any).is_group || (chat as any).chat_type === 'group') && (chat as any).created_by === user.id);

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
            avatarUrl: (chat as any).avatar_url || null,
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
          // Capture the first unread (received) message BEFORE marking as read,
          // so the scroll effect can jump to it on chat open.
          {
            const firstUnread = (msgs || []).find((m: any) =>
              m.sender_id && m.sender_id !== user.id && m.message_status !== 'read'
            );
            firstUnreadIdRef.current = firstUnread ? firstUnread.id : null;
          }
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

          // Centralized privacy: resolve via visible_avatar_urls RPC which
          // enforces 'all' / 'contacts' / 'selected' server-side.
          const { resolveVisibleAvatars } = await import('@/lib/visible-avatars');
          const avMap = await resolveVisibleAvatars([otherUserId]);
          const effectiveAvatar = avMap.get(otherUserId) ?? null;

          const isReallyOnline = !!(otherUser.is_online && (otherUser as any).last_seen && (Date.now() - new Date((otherUser as any).last_seen).getTime()) < 2 * 60 * 1000);
          setContact({
            name: displayName,
            avatar: displayName[0]?.toUpperCase() || 'U',
            avatarUrl: effectiveAvatar,
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

      // Capture first unread (received) message BEFORE marking read.
      {
        const firstUnread = (msgs || []).find((m: any) =>
          m.sender_id && m.sender_id !== user.id && m.message_status !== 'read'
            && !(Array.isArray((m as any).deleted_for) && (m as any).deleted_for.includes(user.id))
        );
        firstUnreadIdRef.current = firstUnread ? firstUnread.id : null;
      }
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

  // Trust Lock: load current state when chat changes and subscribe to
  // realtime updates so both participants stay in sync. Cleared between
  // chats so other (non-Trust-Lock) chats keep their default behaviour.
  useEffect(() => {
    setTrustLock({ enabled: false, ownerUserId: null });
    if (!selectedChatId || !user || chatType !== 'normal') return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('trust_locks' as any)
          .select('enabled, owner_user_id')
          .eq('chat_id', selectedChatId)
          .maybeSingle();
        if (!cancelled && data) {
          setTrustLock({
            enabled: !!(data as any).enabled,
            ownerUserId: (data as any).owner_user_id || null,
          });
        }
      } catch {}
    })();
    const ch = supabase
      .channel(`trust-lock-${selectedChatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trust_locks', filter: `chat_id=eq.${selectedChatId}` },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row) return;
          if (payload.eventType === 'DELETE') {
            setTrustLock({ enabled: false, ownerUserId: null });
          } else {
            setTrustLock({
              enabled: !!row.enabled,
              ownerUserId: row.owner_user_id || null,
            });
          }
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [selectedChatId, user?.id, chatType]);

  // Apply / clear Trust Lock protection whenever the active chat's state
  // changes. The TrustLockService routes to the strongest protections per
  // platform (Android FLAG_SECURE, iOS blur + screenshot detection, web
  // backgrounding blur). Always disabled on unmount / chat switch so other
  // chats and the rest of the app stay unrestricted.
  useEffect(() => {
    const active = !!selectedChatId && trustLock.enabled;
    let cancelled = false;
    const attemptId = ++trustLockAttemptRef.current;
    const confirmWithTimeout = async () => {
      const timeoutMs = 2500;
      let timer: number | undefined;
      try {
        return await Promise.race([
          TrustLockService.enableProtection(),
          new Promise<boolean>((resolve) => {
            timer = window.setTimeout(() => resolve(false), timeoutMs);
          }),
        ]);
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    };
    (async () => {
      if (active) {
        setTrustLockProtected(null);
        const protectedNow = await confirmWithTimeout();
        if (!cancelled && attemptId === trustLockAttemptRef.current) setTrustLockProtected(protectedNow);
        if (!protectedNow && !cancelled) {
          toast.error('Trust Lock could not confirm screenshot blocking on this device. Please use the updated Android app.');
        }
        // iOS PWA: Apple does not let web apps block screenshots. Warn the
        // user pre-emptively that screenshots are not allowed and will be
        // logged. Native iOS app shows this through the OS-level blur +
        // detection — no extra toast needed there.
        if (!cancelled && isIosPwa()) {
          toast.warning('Trust Lock is on — screenshots are not allowed. If a screenshot is detected, it will be logged in this chat.', { duration: 6000 });
        }
      } else {
        setTrustLockProtected(false);
        await TrustLockService.disableProtection();
      }
    })().catch(() => {});
    // iOS: when the OS reports a screenshot was taken, insert a system
    // event into the conversation so both participants see it. Android
    // never fires this listener because FLAG_SECURE prevents the
    // screenshot from happening in the first place.
    let unsub: (() => void) | null = null;
    if (active) {
      let lastTs = 0;
      unsub = onTrustLockScreenshot(() => {
        // Debounce: iOS occasionally fires the notification twice.
        const now = Date.now();
        if (now - lastTs < 1500) return;
        lastTs = now;
        if (cancelled || !selectedChatId || !user?.id) return;
        supabase.from('messages').insert({
          chat_id: selectedChatId,
          sender_id: user.id,
          content: '🛡️ Screenshot detected on this device.',
          message_status: 'sent',
        }).then(() => {}, () => {});
      });
    }
    return () => {
      cancelled = true;
      trustLockAttemptRef.current += 1;
      if (unsub) unsub();
      setTrustLockProtected(false);
      if (active) TrustLockService.disableProtection().catch(() => {});
    };
  }, [selectedChatId, trustLock.enabled, user?.id]);

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
      // If the contact object hasn't loaded yet (race with chat open), or the
      // cached publicKey is stale, do a fresh lookup against the recipient's
      // profile before failing. This avoids false "hasn't enabled encryption"
      // toasts when the user hits Send while the header still shows "Loading…".
      let effectivePubKey = contact?.publicKey || contactPubKeyRef.current || null;
      if (!effectivePubKey) {
        try {
          const { data: chatRow } = await supabase
            .from('chats')
            .select('participant_one, participant_two')
            .eq('id', selectedChatId)
            .maybeSingle();
          const otherId = chatRow
            ? (chatRow.participant_one === user.id ? chatRow.participant_two : chatRow.participant_one)
            : null;
          if (otherId) {
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('public_key, full_name')
              .eq('id', otherId)
              .maybeSingle();
            if (prof?.public_key) {
              effectivePubKey = prof.public_key;
              contactPubKeyRef.current = prof.public_key;
              setE2eEnabled(true);
              setContact((c) => c ? { ...c, publicKey: prof.public_key } : c);
            }
          }
        } catch {}
      }
      if (!effectivePubKey) {
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
    if (!overrideText) {
      setInputText('');
      if (selectedChatId) {
        delete draftsRef.current[selectedChatId];
        persistDrafts();
      }
    }
    setShowEmoji(false);

    try {
      let contentToStore = text;
      const pkForSend = contact?.publicKey || contactPubKeyRef.current || null;
      if (chatType !== 'group' && pkForSend) {
        contentToStore = await encryptMessage(text, pkForSend);
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
        // Nudge the chat list to reorder immediately, without waiting for the
        // realtime round-trip (which can lag 1–3s on mobile/PWAs).
        try {
          window.dispatchEvent(new CustomEvent('vt-message-sent', {
            detail: { chatId: selectedChatId, preview: text, at: Date.now() },
          }));
        } catch {}
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
      const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(dataUrl);
      const mime = match?.[1] || 'image/jpeg';
      const base64 = match?.[2] || dataUrl;
      const binary = atob(base64.replace(/\s/g, ''));
      const chunkSize = 8192;
      const chunks: Uint8Array[] = [];
      for (let offset = 0; offset < binary.length; offset += chunkSize) {
        const slice = binary.slice(offset, offset + chunkSize);
        const bytes = new Uint8Array(slice.length);
        for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i);
        chunks.push(bytes);
      }
      const blob = new Blob(chunks, { type: mime });
      return new File([blob], filename, { type: mime });
    } catch (e) {
      console.warn('[VibTribe] dataUrlToFile failed', e);
      return null;
    }
  };

  const nativePickedFileToFile = async (picked: {
    name: string;
    mime: string;
    dataUrl?: string;
    blob?: Blob;
    path?: string;
  }): Promise<File | null> => {
    try {
      if (picked.blob) {
        return new File([picked.blob], picked.name, {
          type: picked.mime || picked.blob.type || 'application/octet-stream',
        });
      }
      // Prefer the file path when available — streaming a content:// URI
      // through fetch avoids loading the entire file (esp. large videos)
      // into memory as a base64 dataUrl, which crashes the WebView.
      if (picked.path) {
        let res: Response | null = null;
        try {
          res = await fetch(picked.path);
        } catch {}
        if (!res?.ok) {
          try {
            const { Capacitor } = await import('@capacitor/core');
            res = await fetch(Capacitor.convertFileSrc(picked.path));
          } catch {}
        }
        if (res?.ok) {
          const blob = await res.blob();
          return new File([blob], picked.name, {
            type: picked.mime || blob.type || 'application/octet-stream',
          });
        }
      }
      if (picked.dataUrl) {
        // Fallback for pickers that only expose base64. Use fetch() to
        // decode via the browser's native pipeline instead of atob(), which
        // OOM-crashes on large binaries.
        try {
          const res = await fetch(picked.dataUrl);
          const blob = await res.blob();
          return new File([blob], picked.name, {
            type: picked.mime || blob.type || 'application/octet-stream',
          });
        } catch {
          const file = await dataUrlToFile(picked.dataUrl, picked.name);
          return file ? new File([file], picked.name, { type: picked.mime || file.type }) : null;
        }
      }
    } catch (e) {
      console.warn('[VibTribe] nativePickedFileToFile failed', e);
    }
    return null;
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
    setPendingAttachments(prev => [...prev, { file, type, previewUrl }]);
  };

  const queueAttachments = (items: Array<{ file: File; type: 'image' | 'file' | 'audio' | 'video' }>) => {
    items.forEach(({ file, type }) => queueAttachment(file, type));
  };

  const cancelPendingAttachment = () => {
    pendingAttachments.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPendingAttachments([]);
  };

  const sendPendingAttachment = async () => {
    if (pendingAttachments.length === 0) return;
    const items = pendingAttachments;
    setPendingAttachments([]);
    try {
      for (const { file, type } of items) {
        await handleFileAttach(file, type);
      }
    } finally {
      items.forEach(({ previewUrl }) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
    }
  };

  // Pick from gallery. On native we use the Capacitor Camera plugin (it
  // prompts for READ_MEDIA_IMAGES itself). On web we synchronously click the
  // hidden file input — any await before .click() loses gesture context.
  const handlePickPhotoVideo = () => {
    if (isCapacitorWrapper()) {
      setShowAttachMenu(false);
      (async () => {
        // Use the system file picker so users can choose photos OR videos.
        // Camera.getPhoto() is image-only — videos never appeared in the
        // gallery sheet before.
        // readData: false — receive a content:// path instead of a huge
        // base64 dataUrl. Videos would otherwise crash the WebView while
        // decoding a 50MB+ base64 string in memory.
        const picked = await pickNativeMedia({ multiple: true, readData: false });
        if (!picked.length) return;
        const converted = await Promise.all(picked.map(async (p) => {
          const file = await nativePickedFileToFile(p);
          if (!file) return null;
          const kind: 'image' | 'video' = (p.mime || file.type || '').startsWith('video/') ? 'video' : 'image';
          return { file, type: kind };
        }));
        const readable = converted.filter(Boolean) as Array<{ file: File; type: 'image' | 'video' }>;
        if (readable.length === 0) {
          toast.error('Could not read the selected photo. Please try again.');
          return;
        }
        if (readable.length < picked.length) toast.error('Some selected media could not be read.');
        queueAttachments(readable);
      })();
      return;
    }
    imageInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handlePickCamera = () => {
    if (isCapacitorWrapper()) {
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
    if (isCapacitorWrapper()) {
      setShowAttachMenu(false);
      (async () => {
        const picked = await pickNativeFiles({ multiple: false });
        if (!picked.length) return;
        const p = picked[0];
        const file = await nativePickedFileToFile(p);
        if (file) {
          queueAttachment(file, 'file');
        } else {
          toast.error('Could not read the selected file. Please try again.');
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
    setReactionPickerMsg(null);
  };

  const insertEmoji = (emoji: string) => {
    // VibTribe image emojis are sticker-style: send instantly as their
    // own message so the composer never shows the raw `:vt:id:` shortcode
    // (which looks like a debug string to the user). Standard unicode
    // emojis still get appended to the text input as before.
    if (/^:vt:[a-z0-9_-]+:$/.test(emoji)) {
      setShowEmoji(false);
      void sendMessage(emoji);
      return;
    }
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
    setActionMsg(null);
    const ok = await appConfirm({
      title: 'Delete for me?',
      message: 'This message will be removed from your view only. Other participants will still see it.',
      confirmLabel: 'Delete for me',
      variant: 'destructive',
    });
    if (!ok) return;
    setMessages(prev => prev.filter(m => m.id !== msgId));
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

  // Premium users and the master admin bypass the 1-hour delete-for-everyone window.
  const canDeleteForEveryoneUnlimited = (() => {
    if (!myProfile) return false;
    if (myProfile.is_master_admin) return true;
    if (!myProfile.is_premium) return false;
    const exp = myProfile.premium_expires_at ? new Date(myProfile.premium_expires_at).getTime() : null;
    return exp === null || exp > Date.now();
  })();
  const canDeleteForEveryone = (iso?: string) => canDeleteForEveryoneUnlimited || isWithinHour(iso);
  // Premium users and the master admin can also edit messages beyond the
  // default 1-hour edit window, as long as their premium is still active.
  const canEditMessage = (iso?: string) => canDeleteForEveryoneUnlimited || isWithinHour(iso);

  const handleLongPressStart = (msg: Message) => {
    if (msg.deletedForEveryone) return;
    if (msg.messageType === 'system') return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(async () => {
      setActionMsg(msg);
      // Premium tactile feedback on native long-press
      if (isNativeWrapper()) {
        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch { /* noop */ }
      } else if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
        try { (navigator as any).vibrate(12); } catch { /* noop */ }
      }
    }, 450);
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
    const callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'voice', calleeName: contact.name, calleeAvatar: contact.avatarUrl || contact.avatar });
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
    const callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'video', calleeName: contact.name, calleeAvatar: contact.avatarUrl || contact.avatar });
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
        callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'video', calleeName: contact.name, calleeAvatar: contact.avatarUrl || contact.avatar });
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
        callRow = await startCall({ calleeId: contact.userId, chatId: selectedChatId, type: 'voice', calleeName: contact.name, calleeAvatar: contact.avatarUrl || contact.avatar });
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
      startCall({ calleeId: contact.userId, chatId: selectedChatId, type: t, calleeName: contact.name, calleeAvatar: contact.avatarUrl || contact.avatar });
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
    <TrustLockProvider value={{ enabled: trustLock.enabled, ownerUserId: trustLock.ownerUserId, isOwner: !!user && trustLock.ownerUserId === user.id }}>
    <div className="flex-1 flex flex-col h-full relative min-w-0 w-full max-w-full overflow-hidden" onClick={() => { setShowAttachMenu(false); setShowMoreMenu(false); setShowDisappearMenu(false); setShowEmoji(false); }}>
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
          <h3 className="font-semibold text-sm text-foreground truncate min-w-0">{contact?.name || 'Loading...'}</h3>
          {(e2eEnabled || trustLock.enabled) ? (
            <div className="flex items-center gap-1 mt-0.5 min-w-0">
              {e2eEnabled && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-vt-green/10 rounded-full flex-shrink-0" title="End-to-end encrypted">
                  <ShieldCheck size={9} className="text-vt-green" />
                  <span className="text-[9px] text-vt-green font-medium leading-none">E2E</span>
                </div>
              )}
              {trustLock.enabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowTrustLockInfo(true); }}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/15 rounded-full flex-shrink-0"
                  title="Trust Lock is enabled in this chat"
                >
                  <Shield size={9} className="text-primary" />
                  <span className="text-[9px] text-primary font-medium leading-none">Trust Lock</span>
                </button>
              )}
              {contact?.online && (
                <span className="text-[10px] text-vt-green truncate ml-1">online</span>
              )}
            </div>
          ) : (
            <p className={`text-xs truncate ${contact?.online ? 'text-vt-green' : 'text-muted-foreground'}`}>
              {contact?.lastSeen || ''}
            </p>
          )}
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
                {(chatType !== 'group' || tribeIsFounder || tribeRole === 'leader') && (
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false);
                      if (myChatSecured) {
                        setShowUnsecureConfirm(true);
                      } else {
                        setSecureModalOpen(true);
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                  >
                    {myChatSecured ? <ShieldOff size={16} className="text-vt-amber" /> : <Lock size={16} className="text-primary" />}
                    {chatType === 'group'
                      ? (myChatSecured ? 'Mark tribe as Unsecured' : 'Mark tribe as Secured')
                      : (myChatSecured ? 'Mark as Unsecured (for me)' : 'Mark as secure (only for me)')}
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
                {chatType !== 'group' && (
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false);
                      if (!user || !selectedChatId) return;
                      if (trustLock.enabled) {
                        // Disable — only the owner is allowed
                        if (trustLock.ownerUserId !== user.id) {
                          toast.error('Only the user who enabled Trust Lock can turn it off');
                          return;
                        }
                        setTrustLockBusy(true);
                        try {
                          const { error } = await supabase
                            .from('trust_locks' as any)
                            .update({ enabled: false, enabled_at: null, owner_user_id: user.id } as any)
                            .eq('chat_id', selectedChatId);
                          if (error) throw error;
                          setTrustLock({ enabled: false, ownerUserId: user.id });
                          toast.success('Trust Lock disabled');
                        } catch (e: any) {
                          toast.error(e?.message || 'Could not disable Trust Lock');
                        } finally {
                          setTrustLockBusy(false);
                        }
                      } else {
                        // Enable — show confirmation first
                        setShowTrustLockConfirm(true);
                      }
                    }}
                    disabled={trustLockBusy || (trustLock.enabled && trustLock.ownerUserId !== user?.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground disabled:opacity-60"
                  >
                    <Shield size={16} className={trustLock.enabled ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="flex-1">Trust Lock</span>
                    <span className={`text-[10px] font-semibold ${trustLock.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                      {trustLock.enabled
                        ? (trustLock.ownerUserId === user?.id ? 'On · You' : 'On · Locked')
                        : 'Off'}
                    </span>
                  </button>
                )}
                {chatType !== 'group' && contact?.userId && !contact.isContact && (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleAddToContacts(); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-foreground"
                  >
                    <UserPlus size={16} className="text-vt-green" />
                    Add to contacts
                  </button>
                )}
                {chatType !== 'group' && <div className="border-t border-border" />}
                {chatType !== 'group' && <button
                  onClick={() => { setShowMoreMenu(false); handleBlockToggle(); }}
                  disabled={blockLoading}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 ${
                    isBlocked ? 'text-vt-green' : 'text-red-400'
                  }`}
                >
                  {isBlocked ? <ShieldOff size={16} /> : <Ban size={16} />}
                  {isBlocked ? `Unblock ${contact?.name || 'user'}` : `Block ${contact?.name || 'user'}`}
                </button>}
                {chatType === 'group' && tribeIsFounder && (
                  <button
                    onClick={() => { setShowMoreMenu(false); setShowDeleteTribeConfirm(true); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-red-500/10 transition-colors flex items-center gap-3 text-red-400 border-t border-border"
                  >
                    <Trash2 size={16} />
                    Delete tribe
                  </button>
                )}
                {chatType === 'group' && !tribeIsFounder && (
                  <button
                    onClick={() => { setShowMoreMenu(false); setShowLeaveTribeConfirm(true); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3 text-red-400 border-t border-border"
                  >
                    <Ban size={16} />
                    Leave tribe
                  </button>
                )}
                <div className="border-t border-border" />
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (chatType === 'group') {
                      setReportTarget({
                        reportType: 'tribe',
                        chatId: (chatId as any) || undefined,
                        snapshot: { chatMeta: { id: (chatId as any) || undefined, name: contact?.name || 'Tribe', type: 'group' } },
                      });
                    } else {
                      setReportTarget({
                        reportType: 'profile',
                        reportedUserId: (contact as any)?.userId || (contact as any)?.id,
                        snapshot: {
                          profile: {
                            id: (contact as any)?.userId || (contact as any)?.id,
                            full_name: contact?.name,
                          },
                        },
                      });
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-red-500/10 transition-colors flex items-center gap-3 text-red-400"
                >
                  <Flag size={16} />
                  {chatType === 'group' ? 'Report tribe' : `Report ${contact?.name || 'user'}`}
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
              {trustLock.enabled && (
                <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                  <Shield size={11} className="text-primary" /> Trust Lock enabled
                </p>
              )}
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
      {e2eEnabled && chatType !== 'group' && contact && !contact.publicKey && (
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

      {trustLock.enabled && trustLockProtected !== true && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-10 text-center bg-background">
          <ShieldAlert size={42} className="text-primary mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-2">{trustLockProtected === null ? 'Confirming Trust Lock…' : 'Trust Lock needs the Android app'}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {trustLockProtected === null
              ? 'Your messages are hidden until screenshot blocking is confirmed.'
              : 'This chat is hidden here because screenshot blocking could not be confirmed on this device. Open it in the updated VibTribe Android app.'}
          </p>
        </div>
      )}

      {/* Messages Area */}
      {(!trustLock.enabled || trustLockProtected === true) && <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
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
                        onClick={() => startCall({ calleeId: contact.userId!, chatId: selectedChatId, type: callKind as 'voice'|'video', calleeName: contact.name, calleeAvatar: contact.avatarUrl || contact.avatar })}
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
                data-msg-id={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                onMouseEnter={() => setHoveredMsg(msg.id)}
                onMouseLeave={() => setHoveredMsg(null)}
                onClick={() => {
                  if (!selectionMode) return;
                  if (msg.deletedForEveryone || msg.messageType === 'system') return;
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
                    return next;
                  });
                }}
              >
                <div
                  className={`relative max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1 ${selectionMode && selectedIds.has(msg.id) ? 'ring-2 ring-primary rounded-2xl' : ''}`}
                  onTouchStart={() => handleLongPressStart(msg)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onContextMenu={(e) => {
                    if (msg.deletedForEveryone || msg.messageType === 'system') return;
                    e.preventDefault();
                    setActionMsg(msg);
                  }}
                >
                  <div
                    className={(() => {
                      const solo = typeof displayText === 'string' && !encMedia && !imageUrl && !msg.deletedForEveryone && isSoloEmojiText(displayText);
                      if (solo) {
                        // Sticker-style: no bubble, just the big emoji.
                        return 'px-1 py-1 text-sm leading-relaxed bg-transparent';
                      }
                      return `px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.deletedForEveryone
                          ? 'glass border border-dashed border-border text-muted-foreground italic'
                          : isMe
                            ? 'gradient-primary text-white rounded-br-sm'
                            : 'glass border border-border text-foreground rounded-bl-sm'
                      }`;
                    })()}
                  >
                    {encMedia && (encMedia.k || contactPubKeyRef.current) ? (
                      isMe && msg.mediaUrl && msg.mediaUrl.startsWith('blob:') && encMedia.type === 'image' ? (
                        <img
                          src={msg.mediaUrl}
                          alt={encMedia.name || 'Shared image'}
                          className="max-w-[200px] rounded-xl cursor-zoom-in"
                          onClick={(e) => setLightbox({ src: msg.mediaUrl!, rect: (e.currentTarget as HTMLImageElement).getBoundingClientRect(), name: encMedia.name, mime: encMedia.mime })}
                        />
                      ) : (
                        <EncryptedMedia
                          url={encMedia.url}
                          mime={encMedia.mime}
                          name={encMedia.name}
                          kind={encMedia.type}
                          theirPublicKey={contactPubKeyRef.current || undefined}
                          mediaKey={encMedia.k}
                          onImageClick={(u, r) => setLightbox({ src: u, rect: r, name: encMedia.name, mime: encMedia.mime })}
                        />
                      )
                    ) : imageUrl ? (
                      <ChatMediaImg
                        src={imageUrl}
                        alt="Shared image"
                        className="max-w-[200px] rounded-xl cursor-zoom-in"
                        onClick={(e) => setLightbox({ src: imageUrl, rect: (e.currentTarget as HTMLImageElement).getBoundingClientRect() })}
                      />
                    ) : (
                      <>
                        {typeof displayText === 'string'
                          ? <Linkified
                              text={displayText}
                              isMe={isMe}
                              boost={!msg.deletedForEveryone && isSoloEmojiText(displayText)}
                            />
                          : displayText}
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
                       {msg.reactions.map((r, i) => {
                         const vtMatch = /^:vt:([a-z0-9_-]+):$/.exec(r);
                         const vt = vtMatch ? VIBTRIBE_EMOJI_MAP[vtMatch[1]] : null;
                         return (
                           <span key={i} className="inline-flex items-center bg-muted rounded-full px-1.5 py-0.5 text-xs">
                             {vt ? (
                               <img src={vt.url} alt={vt.name} className="w-4 h-4 select-none" draggable={false} loading="lazy" decoding="async" />
                             ) : (
                               <span className="text-sm leading-none">{r}</span>
                             )}
                           </span>
                         );
                       })}
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
                      <button
                        onClick={() => setReactionPickerMsg(msg)}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                        type="button"
                        aria-label="More reactions"
                      >
                        <Plus size={12} />
                      </button>
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
      </div>}

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
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) {
            queueAttachments(files.map(file => ({
              file,
              type: file.type?.startsWith('video/') ? 'video' : 'image',
            })));
          }
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) queueAttachments(files.map(file => ({ file, type: 'file' })));
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
      {pendingAttachments.length > 0 && (
        <div
          className="fixed inset-0 z-[1800] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 5rem))',
          }}
          onClick={cancelPendingAttachment}
        >
          <div
            className="glass-strong rounded-2xl border border-border shadow-card max-w-md w-full flex flex-col overflow-hidden"
            style={{ maxHeight: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 pb-2 shrink-0">
              <h3 className="text-sm font-semibold text-foreground">
                {pendingAttachments.length === 1 ? 'Send attachment' : `Send ${pendingAttachments.length} attachments`}
              </h3>
              <button
                onClick={cancelPendingAttachment}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>

            <div className={`grid gap-2 px-4 overflow-y-auto flex-1 min-h-0 ${pendingAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {pendingAttachments.map((item, index) => (
                <div key={`${item.file.name}-${item.file.size}-${index}`} className="flex items-center justify-center bg-muted/30 rounded-xl overflow-hidden min-h-32">
                  {item.type === 'image' && item.previewUrl && (
                    <img
                      src={item.previewUrl}
                      alt="Preview"
                      className="max-h-[50vh] w-full object-contain"
                    />
                  )}
                  {item.type === 'video' && item.previewUrl && (
                    <video
                      src={item.previewUrl}
                      controls
                      playsInline
                      className="max-h-[50vh] w-full"
                    />
                  )}
                  {item.type === 'audio' && item.previewUrl && (
                    <audio src={item.previewUrl} controls className="w-full p-4" />
                  )}
                  {item.type === 'file' && (
                    <div className="flex items-center gap-3 p-4 w-full">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={24} className="text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.file.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(item.file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                  )}
                  {!item.previewUrl && item.type !== 'file' && (
                    <div className="text-sm text-muted-foreground p-4">{item.file.name}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1 px-4 pt-2 shrink-0">
              {pendingAttachments.slice(0, 4).map((item, index) => (
                <div key={`${item.file.name}-label-${index}`} className="text-xs text-muted-foreground truncate">
                  {item.file.name}
                </div>
              ))}
              {pendingAttachments.length > 4 && (
                <div className="text-xs text-muted-foreground">
                  +{pendingAttachments.length - 4} more
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 pt-3 shrink-0 border-t border-border bg-background/60">
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
                {pendingAttachments.length === 1 ? 'Send' : `Send ${pendingAttachments.length}`}
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
            {(EMOJI_CATEGORIES.find(c => c.key === emojiTab)?.emojis || []).map((emoji, i) => {
              const vtMatch = /^:vt:([a-z0-9_-]+):$/.exec(emoji);
              const vt = vtMatch ? VIBTRIBE_EMOJI_MAP[vtMatch[1]] : null;
              return (
                <button
                  key={`${emoji}-${i}`}
                  onClick={() => insertEmoji(emoji)}
                  className="aspect-square flex items-center justify-center text-2xl rounded-lg hover:bg-muted active:scale-90 transition-all p-1"
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

      {/* Input Area */}
      {(!trustLock.enabled || trustLockProtected === true) && <div className="glass border-t border-border px-2 py-2 flex items-center gap-1 flex-shrink-0 w-full max-w-full overflow-hidden">
        <button
          onClick={(e) => { e.stopPropagation(); setShowAttachMenu(v => { const next = !v; if (next) { setShowEmoji(false); setShowMoreMenu(false); setShowDisappearMenu(false); } return next; }); }}
          className={`p-2 rounded-xl transition-all flex-shrink-0 ${showAttachMenu ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          aria-label="Attach"
        >
          <Paperclip size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowEmoji(v => { const next = !v; if (next) { setShowAttachMenu(false); setShowMoreMenu(false); setShowDisappearMenu(false); } return next; }); }}
          className={`p-2 rounded-xl transition-all flex-shrink-0 ${showEmoji ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          aria-label="Emoji"
        >
          <Smile size={20} />
        </button>
        <textarea
          ref={inputRef as any}
          name="chat-message"
          rows={1}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          enterKeyHint="send"
          value={inputText}
          onChange={e => {
            setInputText(e.target.value);
            const ta = e.currentTarget;
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
              const ta = e.currentTarget;
              requestAnimationFrame(() => { ta.style.height = 'auto'; });
            }
          }}
          placeholder={e2eEnabled ? t('chat.typeEncrypted') : t('chat.type')}
          className="flex-1 min-w-0 bg-input border border-border rounded-2xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none leading-5 max-h-[140px] overflow-y-auto"
          style={{ height: 40 }}
        />
        <button
          onClick={() => {
            sendMessage();
            const ta = inputRef.current as unknown as HTMLTextAreaElement | null;
            if (ta) requestAnimationFrame(() => { ta.style.height = '40px'; });
          }}
          disabled={!inputText.trim() && pendingAttachments.length === 0}
          className="p-2.5 gradient-primary rounded-xl text-white hover:opacity-90 transition-all glow-primary flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </div>}

      {secureModalOpen && (
        <MarkSecureModal
          isOpen={secureModalOpen}
          onClose={() => setSecureModalOpen(false)}
          chatId={selectedChatId}
          chatName={contact?.name || 'Chat'}
          isTribe={chatType === 'group'}
          onSecured={() => {
            setMyChatSecured(true);
            window.dispatchEvent(new CustomEvent('vt-secure-changed'));
            setSelectedChatId(null);
          }}
        />
      )}

      {/* Themed confirm: move chat back to normal list */}
      {showUnsecureConfirm && (
        <div
          className="fixed inset-0 z-[1700] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowUnsecureConfirm(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-card float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-vt-amber/15 flex items-center justify-center">
                <ShieldOff size={20} className="text-vt-amber" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">Move chat back to normal?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              This chat will no longer require a PIN or pattern to open from your account.
              The other person is unaffected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUnsecureConfirm(false)}
                className="flex-1 py-2.5 rounded-xl glass text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error: upErr } = await supabase
                      .from('user_secure_chats')
                      .delete()
                      .eq('user_id', user!.id)
                      .eq('chat_id', selectedChatId);
                    if (upErr) throw upErr;
                    setMyChatSecured(false);
                    setShowUnsecureConfirm(false);
                    window.dispatchEvent(new CustomEvent('vt-secure-changed'));
                    toast.success('Chat moved back to your normal chats');
                    setSelectedChatId(null);
                  } catch (e: any) {
                    toast.error(e?.message || 'Could not unsecure this chat');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold"
              >
                Move back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Long-press action sheet for own messages */}
      <AnimatePresence>
      {actionMsg && (() => {
        const isMine = actionMsg.senderId === user?.id;
        const canEdit = canEditMessage(actionMsg.createdAt);
        const canDelAll = canDeleteForEveryone(actionMsg.createdAt);
        const editExpired = isMine && !canEdit;
        const delExpired = isMine && !canDelAll;

        const runReport = async () => {
          const raw = (actionMsg?.text || '').toString();
          let type: ReportType = 'message';
          let envelope: any = null;
          if (raw.startsWith('__media__:')) {
            try { envelope = JSON.parse(raw.slice('__media__:'.length)); } catch {}
            if (envelope?.type === 'image') type = 'image';
            else if (envelope?.type === 'video') type = 'video';
            else if (envelope?.type === 'audio') type = 'audio';
            else if (envelope?.type) type = 'file';
          }
          let mediaFields: { mediaBase64?: string; mediaMime?: string; mediaName?: string } = {};
          if (envelope?.url && (type === 'image' || type === 'video' || type === 'audio' || type === 'file')) {
            try {
              const signed = await signChatMediaUrl(envelope.url);
              const res = await fetch(signed);
              if (res.ok) {
                const cipher = await res.arrayBuffer();
                const plain = envelope.k
                  ? await decryptBytesWithKey(cipher, envelope.k)
                  : contactPubKeyRef.current
                    ? await decryptBytes(cipher, contactPubKeyRef.current)
                    : null;
                if (plain) {
                  const MAX = 10 * 1024 * 1024;
                  const bytes = plain.byteLength > MAX ? plain.slice(0, MAX) : plain;
                  let bin = '';
                  const view = new Uint8Array(bytes);
                  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
                  mediaFields = {
                    mediaBase64: btoa(bin),
                    mediaMime: envelope.mime || 'application/octet-stream',
                    mediaName: envelope.name || `evidence`,
                  };
                }
              }
            } catch (e) {
              console.warn('[report] media decrypt failed', e);
            }
          }
          setReportTarget({
            reportType: type,
            reportedUserId: actionMsg.senderId,
            chatId: selectedChatId || undefined,
            messageId: actionMsg.id,
            snapshot: {
              text: envelope
                ? `[${envelope.type || 'media'}] ${envelope.name || ''} (${envelope.mime || ''})`
                : raw,
              messageType: actionMsg.messageType,
              createdAt: actionMsg.createdAt,
              ...mediaFields,
            },
          });
          setActionMsg(null);
        };

        type Item = {
          key: string;
          label: string;
          icon: string;
          onClick: () => void | Promise<void>;
          tone?: 'default' | 'danger';
          gradient: string;
          hint?: string;
          disabled?: boolean;
        };
        const items: Item[] = [];
        items.push({
          key: 'react', label: 'React', icon: '😊', gradient: 'from-amber-400 to-pink-500',
          onClick: () => { setReactionPickerMsg(actionMsg); setActionMsg(null); },
        });
        items.push({
          key: 'copy', label: 'Copy', icon: '📋', gradient: 'from-sky-400 to-indigo-500',
          disabled: trustLock.enabled, hint: trustLock.enabled ? 'Trust Lock' : undefined,
          onClick: async () => {
            if (trustLock.enabled) return;
            try { await navigator.clipboard.writeText((actionMsg?.text || '').toString()); toast.success('Copied to clipboard'); }
            catch { toast.error('Copy failed'); }
            setActionMsg(null);
          },
        });
        items.push({
          key: 'forward', label: 'Forward', icon: '↪️', gradient: 'from-emerald-400 to-teal-500',
          disabled: trustLock.enabled, hint: trustLock.enabled ? 'Trust Lock' : undefined,
          onClick: () => {
            if (trustLock.enabled) return;
            const raw = (actionMsg?.text || '').toString();
            setActionMsg(null);
            if (!raw || raw.startsWith('__media__:') || raw.startsWith('[IMAGE:') || raw.startsWith('[FILE:')) {
              toast.error('Forwarding media is not supported yet'); return;
            }
            setForwardTexts([raw]);
          },
        });
        items.push({
          key: 'select', label: 'Select more', icon: '✅', gradient: 'from-violet-400 to-fuchsia-500',
          onClick: () => {
            if (!actionMsg) return;
            setSelectedIds(new Set([actionMsg.id])); setSelectionMode(true); setActionMsg(null);
          },
        });
        if (isMine) items.push({
          key: 'edit', label: 'Edit message', icon: '✏️', gradient: 'from-blue-400 to-cyan-500',
          disabled: editExpired, hint: editExpired ? 'expired' : undefined,
          onClick: () => { setEditingMsg(actionMsg); setEditText(actionMsg.text); setActionMsg(null); },
        });
        items.push({
          key: 'delme', label: 'Delete for me', icon: '🗑️', gradient: 'from-slate-400 to-slate-600',
          onClick: () => deleteForMe(actionMsg.id),
        });
        if (isMine) items.push({
          key: 'delall', label: 'Delete for everyone', icon: '🗑️', gradient: 'from-rose-500 to-red-600', tone: 'danger',
          disabled: delExpired, hint: delExpired ? 'past 1 hour' : undefined,
          onClick: () => deleteForEveryone(actionMsg.id),
        });
        if (chatType === 'group' && tribeRole === 'leader') items.push({
          key: 'delleader', label: 'Delete as Tribe Leader', icon: '🛡️', gradient: 'from-orange-500 to-red-500', tone: 'danger',
          hint: 'removes for everyone',
          onClick: () => deleteAsTribeLeader(actionMsg.id),
        });
        if (!isMine) items.push({
          key: 'report', label: 'Report', icon: '🚩', gradient: 'from-red-500 to-rose-600', tone: 'danger',
          hint: 'Trust & Safety',
          onClick: runReport,
        });

        return (
          <motion.div
            key="action-backdrop"
            className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActionMsg(null)}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
              style={{
                background: 'linear-gradient(160deg, hsl(var(--card)) 0%, color-mix(in oklab, hsl(var(--primary)) 10%, hsl(var(--card))) 100%)',
              }}
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) setActionMsg(null); }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
                <div className="w-10 h-1.5 rounded-full bg-white/25" />
              </div>
              <div className="px-5 pt-3 pb-3 border-b border-white/10">
                <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-[0.16em]">Message options</p>
                <p className="text-sm text-foreground truncate mt-1">{formatPreviewText(actionMsg.text)}</p>
              </div>
              <motion.ul
                className="py-1.5"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } } }}
              >
                {items.map((it) => (
                  <motion.li
                    key={it.key}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 28 } },
                    }}
                  >
                    <motion.button
                      type="button"
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                      onClick={() => { if (!it.disabled) it.onClick(); }}
                      disabled={it.disabled}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                        it.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5 active:bg-white/10'
                      } ${it.tone === 'danger' ? 'text-red-300' : 'text-foreground'}`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br ${it.gradient} shadow-md shrink-0`}
                        aria-hidden
                      >
                        <span className="drop-shadow-sm">{it.icon}</span>
                      </span>
                      <span className="flex-1 font-medium">{it.label}</span>
                      {it.hint && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.hint}</span>
                      )}
                    </motion.button>
                  </motion.li>
                ))}
              </motion.ul>
              <button
                onClick={() => setActionMsg(null)}
                className="w-full text-center px-4 py-3 text-sm text-muted-foreground border-t border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        );
      })()}
      </AnimatePresence>

      {reportTarget && (
        <ReportContentSheet
          open={!!reportTarget}
          onClose={() => setReportTarget(null)}
          reportType={reportTarget.reportType}
          reportedUserId={reportTarget.reportedUserId}
          chatId={reportTarget.chatId}
          messageId={reportTarget.messageId}
          snapshot={reportTarget.snapshot}
        />
      )}

      {reactionPickerMsg && (
        <div
          className="fixed inset-0 z-[1550] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4"
          onClick={() => setReactionPickerMsg(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 shadow-2xl float-up backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(160deg, color-mix(in oklab, hsl(var(--card)) 92%, transparent) 0%, color-mix(in oklab, hsl(var(--primary)) 8%, hsl(var(--card))) 100%)',
              animation: 'reactionPop 320ms cubic-bezier(.2,.9,.25,1.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Choose reaction</p>
            </div>
            <div className="flex gap-1 p-2 bg-white/[0.03] overflow-x-auto no-scrollbar">
              {EMOJI_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setEmojiTab(cat.key)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-base transition-all duration-200 ${emojiTab === cat.key ? 'bg-primary/20 text-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.6)]' : 'text-muted-foreground hover:text-foreground hover:scale-110'}`}
                  aria-label={cat.label}
                  title={cat.label}
                  type="button"
                >
                  {cat.icon}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 p-3 max-h-72 overflow-y-auto">
              {(EMOJI_CATEGORIES.find(c => c.key === emojiTab)?.emojis || []).map((emoji, i) => {
                const vtMatch = /^:vt:([a-z0-9_-]+):$/.exec(emoji);
                const vt = vtMatch ? VIBTRIBE_EMOJI_MAP[vtMatch[1]] : null;
                return (
                  <button
                    key={`${emoji}-${i}`}
                    onClick={() => addReaction(reactionPickerMsg.id, emoji)}
                    className="aspect-square flex items-center justify-center text-2xl rounded-xl hover:bg-white/10 hover:scale-125 hover:-translate-y-0.5 active:scale-90 transition-all duration-200 ease-out p-1 will-change-transform"
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

      {/* Trust Lock — enable confirmation */}
      {showTrustLockConfirm && (
        <div className="fixed inset-0 z-[1700] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !trustLockBusy && setShowTrustLockConfirm(false)}>
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-card float-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Shield size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">Turn on Trust Lock?</h3>
                <p className="text-[11px] text-muted-foreground">Extra privacy for this chat</p>
              </div>
              <button onClick={() => !trustLockBusy && setShowTrustLockConfirm(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-xs text-foreground/90 leading-relaxed mb-4">
              <p>While Trust Lock is on in this chat:</p>
              <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-1.5">
                <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> Screenshots & screen recording blocked on Android.</p>
                <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> Screenshots detected & recordings obscured on iOS.</p>
                <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> App-switcher preview is blurred on all platforms.</p>
                <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> Media download, sharing & export are disabled.</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                You will become the owner. <strong>Only you</strong> will be able to turn Trust Lock back off.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => !trustLockBusy && setShowTrustLockConfirm(false)}
                disabled={trustLockBusy}
                className="flex-1 py-2.5 rounded-lg glass text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user || !selectedChatId) return;
                  setTrustLockBusy(true);
                  try {
                    let trustLockTimer: number | undefined;
                    const protectedNow = await Promise.race([
                      TrustLockService.enableProtection(),
                      new Promise<boolean>((resolve) => {
                        trustLockTimer = window.setTimeout(() => resolve(false), 3500);
                      }),
                    ]).finally(() => {
                      if (trustLockTimer) window.clearTimeout(trustLockTimer);
                    });
                    if (!protectedNow) {
                      throw new Error('Trust Lock could not confirm screenshot blocking on this device. Please use the updated Android app.');
                    }
                    const { error } = await supabase
                      .from('trust_locks' as any)
                      .upsert(
                        {
                          chat_id: selectedChatId,
                          enabled: true,
                          owner_user_id: user.id,
                          enabled_at: new Date().toISOString(),
                        } as any,
                        { onConflict: 'chat_id' } as any,
                      );
                    if (error) throw error;
                    setTrustLock({ enabled: true, ownerUserId: user.id });
                    setShowTrustLockConfirm(false);
                    toast.success('Trust Lock enabled');
                  } catch (e: any) {
                    await TrustLockService.disableProtection().catch(() => {});
                    toast.error(e?.message || 'Could not enable Trust Lock');
                  } finally {
                    setTrustLockBusy(false);
                  }
                }}
                disabled={trustLockBusy}
                className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold disabled:opacity-60"
              >
                {trustLockBusy ? 'Enabling…' : 'Enable Trust Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trust Lock — info popover (tap badge) */}
      {showTrustLockInfo && (
        <div className="fixed inset-0 z-[1700] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTrustLockInfo(false)}>
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-card float-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Shield size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">Trust Lock is on</h3>
                <p className="text-[11px] text-muted-foreground">
                  {trustLock.ownerUserId === user?.id
                    ? 'You enabled Trust Lock. Only you can disable it.'
                    : `${contact?.name || 'The other user'} enabled Trust Lock. Only they can disable it.`}
                </p>
              </div>
              <button onClick={() => setShowTrustLockInfo(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-1.5 text-xs text-foreground/90">
              <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> The strongest privacy protection allowed by your device is active.</p>
              <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> Android blocks screenshots & recording. iOS detects screenshots and blurs recordings.</p>
              <p className="flex items-start gap-2"><ShieldAlert size={13} className="text-primary mt-0.5" /> Media download, sharing and export are disabled on every platform.</p>
              {isIOS() && (
                <p className="flex items-start gap-2 mt-2 pt-2 border-t border-primary/10 text-muted-foreground">
                  <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                  <span>Due to Apple platform limitations, screenshots cannot always be fully prevented on iOS devices. Trust Lock applies the strongest protections available, including screenshot detection, screen-recording protection, media restrictions and privacy safeguards.</span>
                </p>
              )}
            </div>
            <button
              onClick={() => setShowTrustLockInfo(false)}
              className="mt-4 w-full py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold"
            >
              Got it
            </button>
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

      {/* Premium media viewer (shared-element, zoom, drag-to-dismiss) */}
      <MediaViewer source={lightbox} onClose={() => setLightbox(null)} />

      {tribeSheetOpen && selectedChatId && chatType === 'group' && (
        <TribeDetailsSheet
          chatId={selectedChatId}
          isOpen={tribeSheetOpen}
          onClose={() => setTribeSheetOpen(false)}
          onLeft={() => { setSelectedChatId(null); }}
        />
      )}

      {(showDeleteTribeConfirm || showLeaveTribeConfirm) && (
        <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => { setShowDeleteTribeConfirm(false); setShowLeaveTribeConfirm(false); }}>
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-card float-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{showDeleteTribeConfirm ? 'Delete this tribe?' : 'Leave this tribe?'}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {showDeleteTribeConfirm
                    ? 'All chats, media, members and history of this tribe will be permanently deleted for everyone. This cannot be undone.'
                    : 'You will no longer receive messages from this tribe. You can be re-invited later.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowDeleteTribeConfirm(false); setShowLeaveTribeConfirm(false); }}
                disabled={deletingTribe}
                className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedChatId) return;
                  setDeletingTribe(true);
                  try {
                    if (showDeleteTribeConfirm) {
                      const { error } = await supabase.rpc('tribe_delete' as any, { _chat_id: selectedChatId } as any);
                      if (error) throw error;
                      toast.success('Tribe deleted');
                    } else {
                      const { error } = await supabase.rpc('tribe_leave' as any, { _chat_id: selectedChatId } as any);
                      if (error) throw error;
                      toast.success('Left tribe');
                    }
                    setShowDeleteTribeConfirm(false);
                    setShowLeaveTribeConfirm(false);
                    // Notify chat list to remove this chat immediately without
                    // waiting for realtime (post-delete the user is no longer
                    // a member so realtime may not deliver the DELETE row).
                    try {
                      window.dispatchEvent(new CustomEvent('vt-chat-removed', { detail: { chatId: selectedChatId } }));
                    } catch {}
                    setSelectedChatId(null);
                  } catch (e: any) {
                    toast.error(e?.message || 'Action failed');
                  } finally {
                    setDeletingTribe(false);
                  }
                }}
                disabled={deletingTribe}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {deletingTribe ? 'Working…' : showDeleteTribeConfirm ? 'Yes, delete' : 'Yes, leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <ForwardMessageModal
      isOpen={!!forwardTexts}
      messages={forwardTexts || []}
      onClose={() => setForwardTexts(null)}
    />
    {selectionMode && (
      <div className="fixed left-0 right-0 z-[1450] bg-card border-t border-border px-3 py-2 flex items-center gap-2 shadow-2xl" style={{ bottom: 'var(--mobile-bottom-nav-offset, 0px)' }}>
        <span className="text-xs text-foreground font-semibold">{selectedIds.size} selected</span>
        <div className="flex-1" />
        <button
          onClick={async () => {
            if (trustLock.enabled) { toast.error('Disabled by Trust Lock'); return; }
            const texts = messages.filter(m => selectedIds.has(m.id)).map(m => m.text || '').filter(t => t && !t.startsWith('__media__:') && !t.startsWith('[IMAGE:') && !t.startsWith('[FILE:'));
            if (texts.length === 0) { toast.error('No text messages selected'); return; }
            try { await navigator.clipboard.writeText(texts.join('\n\n')); toast.success('Copied'); } catch { toast.error('Copy failed'); }
          }}
          disabled={selectedIds.size === 0 || trustLock.enabled}
          className="px-3 py-1.5 rounded-lg text-xs bg-muted text-foreground disabled:opacity-40"
        >📋 Copy</button>
        <button
          onClick={() => {
            if (trustLock.enabled) { toast.error('Disabled by Trust Lock'); return; }
            const texts = messages.filter(m => selectedIds.has(m.id)).map(m => m.text || '').filter(t => t && !t.startsWith('__media__:') && !t.startsWith('[IMAGE:') && !t.startsWith('[FILE:'));
            if (texts.length === 0) { toast.error('Forwarding media is not supported yet'); return; }
            setForwardTexts(texts);
            setSelectionMode(false);
            setSelectedIds(new Set());
          }}
          disabled={selectedIds.size === 0 || trustLock.enabled}
          className="px-3 py-1.5 rounded-lg text-xs bg-primary text-white font-semibold disabled:opacity-40"
        >↪️ Forward</button>
        <button
          onClick={async () => {
            const count = selectedIds.size;
            const ok = await appConfirm({
              title: `Delete ${count} message${count > 1 ? 's' : ''} for me?`,
              message: 'These messages will be removed from your view only. Other participants will still see them.',
              confirmLabel: 'Delete for me',
              variant: 'destructive',
            });
            if (!ok) return;
            for (const id of Array.from(selectedIds)) {
              try { await supabase.rpc('delete_message_for_me' as any, { _msg_id: id } as any); } catch {}
            }
            setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            setSelectionMode(false);
          }}
          disabled={selectedIds.size === 0}
          className="px-3 py-1.5 rounded-lg text-xs bg-red-500/15 text-red-400 disabled:opacity-40"
        >🗑️</button>
        <button
          onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
          className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground"
        ><X size={14} /></button>
      </div>
    )}
    </TrustLockProvider>
  );
}