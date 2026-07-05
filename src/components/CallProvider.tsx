// @ts-nocheck
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, Ear, ShieldCheck, ChevronDown, MoreVertical, Maximize2, AlertTriangle, SwitchCamera } from 'lucide-react';
import { acquireCallWakeLock, setCallAudioRoute, startOngoingCallNotification, updateOngoingCallNotification, stopOngoingCallNotification } from '@/lib/native-bridge';
import { sendCallPush } from '@/lib/fcm-push.functions';

type CallType = 'voice' | 'video';
type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  chat_id: string | null;
  call_type: CallType;
  status: 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended';
};

interface CallContextValue {
  startCall: (opts: { calleeId: string; chatId?: string | null; type: CallType; calleeName?: string; calleeAvatar?: string }) => Promise<CallRow | null>;
}

const CallContext = createContext<CallContextValue>({ startCall: async () => null });
export const useCall = () => useContext(CallContext);

// STUN for direct connections + free TURN relay for restrictive NATs (CGNAT, symmetric NAT, mobile carriers).
// Without TURN, ~20% of calls fail or freeze mid-call when network conditions change.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
const RING_TIMEOUT_MS = 30_000;

export default function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeCall, setActiveCall] = useState<CallRow | null>(null);
  const [role, setRole] = useState<'caller' | 'callee' | null>(null);
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
  const wakeLockReleaseRef = useRef<(() => void) | null>(null);

  // Acquire the screen wake-lock while a call is active so Android does not
  // suspend the WebView; release it when the call ends.
  useEffect(() => {
    if (activeCall) {
      acquireCallWakeLock().then((release) => { wakeLockReleaseRef.current = release; });
      // Route audio: video calls → speaker, voice → earpiece (initial default).
      const initial = activeCall.call_type === 'video' ? 'speaker' : 'earpiece';
      setAudioRoute(initial);
      setCallAudioRoute(initial);
    } else if (wakeLockReleaseRef.current) {
      wakeLockReleaseRef.current();
      wakeLockReleaseRef.current = null;
    }
    return () => {
      if (wakeLockReleaseRef.current) {
        wakeLockReleaseRef.current();
        wakeLockReleaseRef.current = null;
      }
    };
  }, [activeCall]);

  const [remoteName, setRemoteName] = useState('User');
  const [remoteAvatar, setRemoteAvatar] = useState('U');
  const [remoteAvatarUrl, setRemoteAvatarUrl] = useState<string | null>(null);
  // Video-call view swap: false = remote in main, self in PiP; true = swapped.
  const [viewSwapped, setViewSwapped] = useState(false);
  // Whether the remote peer has an active video track (used to decide when
  // to show the avatar backdrop instead of a black rectangle).
  const [remoteVideoLive, setRemoteVideoLive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [audioRoute, setAudioRoute] = useState<'earpiece' | 'speaker'>('earpiece');
  // When true, the call collapses to a small floating pill so the user can
  // interact with the chat / rest of the app while the call keeps running.
  const [minimized, setMinimized] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const activeCallRef = useRef<CallRow | null>(null);
  const callDurationRef = useRef(0);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sendersRef = useRef<{ audio: RTCRtpSender | null; video: RTCRtpSender | null }>({ audio: null, video: null });
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  // iOS PWA workaround: keep a silent audio element playing throughout the
  // call. Safari suspends WebRTC audio (including the outbound microphone)
  // when the PWA loses foreground / screen locks. Any actively playing
  // <audio> element keeps the audio session alive so the mic keeps flowing.
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // iOS-only mic-recovery UX. On installed iOS PWAs, WebKit can suspend or
  // end the outbound microphone track when the audio session is preempted
  // (screen lock, cellular call, app switch, route change). We try to
  // recover silently via replaceTrack; if that fails we surface a one-tap
  // "Restore microphone" banner.
  const [micStatus, setMicStatus] = useState<'ok' | 'recovering' | 'failed'>('ok');
  const micStatusRef = useRef<'ok' | 'recovering' | 'failed'>('ok');
  useEffect(() => { micStatusRef.current = micStatus; }, [micStatus]);
  const isIos = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  };

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  // Post / update the persistent Android ongoing-call notification whenever
  // the call reaches the connected state (with mute + end actions), so the
  // user can control the call from the notification tray and Android keeps
  // the WebView alive (paired with the OngoingCallService foreground service).
  useEffect(() => {
    if (!activeCall) return;
    if (callState !== 'connected') return;
    startOngoingCallNotification({
      callId: activeCall.id,
      chatId: activeCall.chat_id,
      callerName: remoteName,
      callType: activeCall.call_type,
      muted: micMuted,
    });
  }, [activeCall, callState, remoteName, micMuted]);
  useEffect(() => {
    if (!activeCall || callState !== 'connected') return;
    updateOngoingCallNotification({ muted: micMuted });
  }, [micMuted, activeCall, callState]);

  // iOS PWA background-audio keep-alive.
  // On installed iOS PWAs, once the screen locks or the app leaves the
  // foreground, Safari suspends the WebRTC audio graph — the microphone
  // effectively goes silent to the remote peer even though the peer
  // connection stays "connected". Keeping any HTMLMediaElement actively
  // playing (even inaudible silence) keeps the audio session hot so both
  // capture and playback continue. Media Session API also tells iOS this
  // is an active call, which further discourages suspension.
  useEffect(() => {
    if (!activeCall) {
      if (silentAudioRef.current) {
        try { silentAudioRef.current.pause(); } catch {}
        silentAudioRef.current.src = '';
        silentAudioRef.current = null;
      }
      if ('mediaSession' in navigator) {
        try {
          (navigator as any).mediaSession.playbackState = 'none';
          (navigator as any).mediaSession.metadata = null;
        } catch {}
      }
      return;
    }

    // ~1s of true silence (44.1kHz mono, 16-bit PCM) inside a WAV container.
    // Loops seamlessly; totally inaudible.
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAFAAA' + 'A'.repeat(1600);
    try {
      const audio = new Audio(SILENT_WAV);
      audio.loop = true;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      (audio as any).playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.volume = 0.0001; // effectively silent but non-zero keeps sessions alive
      audio.play().catch(() => {});
      silentAudioRef.current = audio;
    } catch {}

    if ('mediaSession' in navigator) {
      try {
        const ms: any = (navigator as any).mediaSession;
        ms.metadata = new (window as any).MediaMetadata({
          title: 'VibTribe Call',
          artist: remoteName || 'In call',
          album: 'VibTribe',
        });
        ms.playbackState = 'playing';
        const noop = () => {};
        try { ms.setActionHandler('play', noop); } catch {}
        try { ms.setActionHandler('pause', noop); } catch {}
        try { ms.setActionHandler('stop', () => endCall('ended')); } catch {}
      } catch {}
    }

    // If iOS pauses the silent element when the tab is backgrounded, restart
    // it as soon as we regain any lifecycle signal.
    const kick = () => { silentAudioRef.current?.play().catch(() => {}); };
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('focus', kick);
    window.addEventListener('pageshow', kick);
    return () => {
      document.removeEventListener('visibilitychange', kick);
      window.removeEventListener('focus', kick);
      window.removeEventListener('pageshow', kick);
    };
  }, [activeCall, remoteName]);

  // Apply the selected audio route to the remote audio/video elements
  // (setSinkId on web) and to the native bridge (Android WebView).
  const applyAudioRoute = useCallback(async (route: 'earpiece' | 'speaker') => {
    setAudioRoute(route);
    setCallAudioRoute(route);
    try {
      const md: any = navigator.mediaDevices;
      if (!md?.enumerateDevices) return;
      const devices = await md.enumerateDevices();
      const outs = devices.filter((d: MediaDeviceInfo) => d.kind === 'audiooutput');
      let target: MediaDeviceInfo | undefined;
      if (route === 'speaker') {
        target = outs.find((d: MediaDeviceInfo) => /speaker|loud/i.test(d.label || '')) || outs.find((d: MediaDeviceInfo) => d.deviceId === 'default');
      } else {
        target = outs.find((d: MediaDeviceInfo) => /earpiece|receiver|phone/i.test(d.label || '')) || outs.find((d: MediaDeviceInfo) => d.deviceId === 'default');
      }
      const sinkId = target?.deviceId || 'default';
      const setSink = async (el: HTMLMediaElement | null) => {
        if (!el) return;
        const anyEl = el as any;
        if (typeof anyEl.setSinkId === 'function') { try { await anyEl.setSinkId(sinkId); } catch {} }
      };
      await setSink(remoteAudioRef.current);
      await setSink(remoteVideoRef.current as unknown as HTMLMediaElement);
    } catch {}
  }, []);

  const toggleAudioRoute = useCallback(() => {
    applyAudioRoute(audioRoute === 'speaker' ? 'earpiece' : 'speaker');
  }, [audioRoute, applyAudioRoute]);

  // When the call overlay mounts AFTER media was already acquired (we now
  // acquire mic/camera inside the click gesture, before the dialog renders),
  // wire the existing stream into the freshly-mounted local <video>.
  useEffect(() => {
    if (!activeCall) return;
    const stream = localStreamRef.current;
    if (stream && localVideoRef.current && activeCall.call_type === 'video') {
      localVideoRef.current.srcObject = stream;
    }
  }, [activeCall]);

  // Re-attach the local stream every time the self-preview element re-mounts
  // (e.g. after the user toggles camera off and back on). The <video> ref
  // becomes a brand-new node, so its srcObject must be rebound or the
  // preview stays black even though the camera/track is live.
  useEffect(() => {
    if (!activeCall || activeCall.call_type !== 'video') return;
    if (videoOff) return;
    const stream = localStreamRef.current;
    const el = localVideoRef.current;
    if (stream && el && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play?.().catch(() => {});
    }
  }, [videoOff, activeCall]);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    sendersRef.current = { audio: null, video: null };
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (channelRef.current) {
      const ref = channelRef.current as any;
      if (ref?._chans) ref._chans.forEach((c: any) => { try { supabase.removeChannel(c); } catch {} });
      else { try { supabase.removeChannel(ref); } catch {} }
      channelRef.current = null;
    }
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    ringTimerRef.current = null;
    durationTimerRef.current = null;
    if (ringtoneRef.current) { try { ringtoneRef.current.pause(); } catch {} ringtoneRef.current = null; }
    setCallDuration(0);
    setMicMuted(false); setVideoOff(false);
    setMinimized(false);
    setMicStatus('ok');
    setRemoteAvatarUrl(null);
    setRemoteVideoLive(false);
    setViewSwapped(false);
    try { stopOngoingCallNotification(); } catch {}
  }, [supabase]);

  const endCall = useCallback(async (finalStatus: 'ended' | 'declined' | 'missed' = 'ended') => {
    const call = activeCallRef.current || activeCall;
    const finalDuration = callDurationRef.current || callDuration;
    if (call) {
      try {
        await supabase
          .from('calls')
          .update({ status: finalStatus, ended_at: new Date().toISOString() })
          .eq('id', call.id)
          .in('status', ['ringing', 'accepted']);
      } catch {}
      // Log a system message in chat for both missed and completed calls
      if (call.chat_id && user?.id) {
        try {
          if (finalStatus === 'missed') {
            await supabase.from('messages').insert({
              chat_id: call.chat_id,
              sender_id: user.id,
              content: `__missed_call__:${call.call_type}:${call.id}`,
            });
          } else if (finalStatus === 'ended' && finalDuration > 0) {
            await supabase.from('messages').insert({
              chat_id: call.chat_id,
              sender_id: user.id,
              content: `__call_log__:${call.call_type}:${finalDuration}:${call.id}`,
            });
          }
        } catch {}
      }
    }
    cleanup();
    setActiveCall(null);
    setRole(null);
    setCallState('ended');
  }, [activeCall, role, supabase, user?.id, cleanup, callDuration]);

  const playRingtone = (kind: 'outgoing' | 'incoming') => {
    try {
      const audio = new Audio(
        kind === 'incoming'
          ? 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
          : 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      );
      audio.loop = true;
      audio.play().catch(() => {});
      ringtoneRef.current = audio;
    } catch {}
  };

  const setupPeerConnection = (call: CallRow, asCaller: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 4,
      // Prefer relay fallback when direct paths fail (more reliable on mobile)
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    pcRef.current = pc;
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
      // Attach to elements (re-attach in case ref mounts later)
      requestAnimationFrame(() => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
      });
      // Track whether the remote has a video track so we can hide the
      // avatar backdrop the moment their camera comes through.
      const hasVideo = remoteStream.getVideoTracks().some(t => t.readyState === 'live');
      setRemoteVideoLive(hasVideo);
      remoteStream.getVideoTracks().forEach((t) => {
        try {
          t.addEventListener('ended', () => setRemoteVideoLive(remoteStream.getVideoTracks().some(v => v.readyState === 'live')));
          t.addEventListener('mute', () => setRemoteVideoLive(false));
          t.addEventListener('unmute', () => setRemoteVideoLive(true));
        } catch {}
      });
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice',
          payload: { candidate: e.candidate, from: user?.id },
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCallState('connected');
      // Auto-recover transient drops via ICE restart instead of dropping the call.
      // Wait briefly to ride out very short Wi-Fi hiccups before kicking ICE restart.
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        const wait = pc.connectionState === 'failed' ? 0 : 1500;
        setTimeout(() => {
          if (!pcRef.current || pcRef.current !== pc) return;
          const s = pc.connectionState;
          if (s !== 'disconnected' && s !== 'failed') return;
          try {
            if (asCaller && pc.restartIce) {
              pc.restartIce();
              pc.createOffer({ iceRestart: true })
                .then((offer) => pc.setLocalDescription(offer).then(() => {
                  channelRef.current?.send?.({
                    type: 'broadcast', event: 'offer',
                    payload: { sdp: offer, from: user?.id, restart: true },
                  });
                }))
                .catch(() => {});
            }
          } catch {}
        }, wait);
      }
    };
    pc.oniceconnectionstatechange = () => {
      // Mirror state — some browsers update iceConnectionState earlier than connectionState
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('connected');
      }
    };
    return pc;
  };

  const acquireMedia = async (type: CallType) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Media devices are not available on this device.');
    }
    const mediaPromise = navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: cameraFacing } : false,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Media permission request timed out.')), 8000);
    });
    const stream = await Promise.race([mediaPromise, timeoutPromise]);
    localStreamRef.current = stream;
    if (localVideoRef.current && type === 'video') {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  // Switch between front and back camera mid-call without dropping
  // the peer connection. We acquire a new video track with the opposite
  // facingMode, replace the existing sender's track, and swap the local
  // self-preview source so the user sees the new feed instantly.
  const switchCamera = useCallback(async () => {
    if (!activeCall || activeCall.call_type !== 'video') return;
    const next: 'user' | 'environment' = cameraFacing === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: next } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      // Replace the outgoing track so the remote peer sees the new camera
      // without renegotiation.
      const sender = sendersRef.current.video;
      if (sender) {
        try { await sender.replaceTrack(newTrack); } catch {}
      }
      // Update the local MediaStream: stop the old video track and add the
      // new one so the self-preview reflects the swap.
      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getVideoTracks().forEach((t) => { try { t.stop(); } catch {} localStream.removeTrack(t); });
        localStream.addTrack(newTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play?.().catch(() => {});
        }
      }
      setCameraFacing(next);
    } catch (e) {
      console.warn('[Call] camera switch failed', e);
    }
  }, [activeCall, cameraFacing]);

  // Short local UI sound played when the user taps End Call. Plays only on
  // this device (Web Audio → local speaker), never sent over the PeerConnection.
  const playEndCallClick = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.24);
      setTimeout(() => { try { ctx.close(); } catch {} }, 400);
    } catch {}
  };

  // Add tracks to peer, tracking senders so we can replaceTrack later
  // (avoids duplicate senders / frozen-video bugs when media is re-acquired).
  const addTracksToPC = (pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((t) => {
      const existing = t.kind === 'audio' ? sendersRef.current.audio : sendersRef.current.video;
      if (existing) {
        try { existing.replaceTrack(t); } catch { try { pc.addTrack(t, stream); } catch {} }
      } else {
        try {
          const sender = pc.addTrack(t, stream);
          if (t.kind === 'audio') sendersRef.current.audio = sender;
          else sendersRef.current.video = sender;
        } catch {}
      }
    });
  };

  // Attach lifecycle watchers to the outbound audio track so we can react
  // when iOS suspends/ends it. Idempotent — safe to call whenever a fresh
  // audio track is installed.
  const watchAudioTrack = useCallback((track: MediaStreamTrack | null) => {
    if (!track || !isIos()) return;
    const onMute = () => {
      console.warn('[Call][iOS] audio track muted by system — attempting recovery');
      void recoverMicrophone('auto:mute');
    };
    const onEnded = () => {
      console.warn('[Call][iOS] audio track ended by system — attempting recovery');
      void recoverMicrophone('auto:ended');
    };
    try { track.addEventListener('mute', onMute); } catch { (track as any).onmute = onMute; }
    try { track.addEventListener('ended', onEnded); } catch { (track as any).onended = onEnded; }
  }, []);

  // Re-acquire the microphone and swap it into the existing sender without
  // renegotiating the peer connection. Also restarts the silent keep-alive
  // element in case iOS paused it during the interruption. Returns true on
  // success. Best-effort: swallows failures and sets status='failed' so the
  // UI can offer manual retry.
  const recoverMicrophone = useCallback(async (reason: string): Promise<boolean> => {
    const call = activeCallRef.current;
    const sender = sendersRef.current.audio;
    if (!call || !sender) return false;
    if (micStatusRef.current === 'recovering') return false;
    console.info('[Call] mic recovery started', { reason });
    setMicStatus('recovering');
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const newTrack = fresh.getAudioTracks()[0];
      if (!newTrack) throw new Error('no audio track');
      // Preserve current mute state before swapping in.
      newTrack.enabled = !micMutedRef.current;
      await sender.replaceTrack(newTrack);
      // Merge the fresh audio track into the persistent local stream so any
      // downstream consumers (e.g. camera-switch, mute toggle) stay coherent.
      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => { try { t.stop(); } catch {} localStream.removeTrack(t); });
        localStream.addTrack(newTrack);
      } else {
        localStreamRef.current = fresh;
      }
      watchAudioTrack(newTrack);
      // Kick the silent keep-alive so the iOS audio session stays hot.
      silentAudioRef.current?.play().catch(() => {});
      setMicStatus('ok');
      console.info('[Call] mic recovery succeeded', { reason });
      return true;
    } catch (err) {
      console.error('[Call] mic recovery failed', { reason, err: String((err as any)?.message || err) });
      setMicStatus('failed');
      return false;
    }
  }, [watchAudioTrack]);

  // Track ref for current mute state (so recovery preserves it).
  const micMutedRef = useRef(false);
  useEffect(() => { micMutedRef.current = micMuted; }, [micMuted]);

  // When the app returns to foreground, proactively verify the mic track is
  // still healthy. iOS often leaves the track object alive but muted after a
  // screen-lock interruption, and the mute event doesn't always fire.
  useEffect(() => {
    if (!activeCall || !isIos()) return;
    const verify = () => {
      if (document.visibilityState !== 'visible') return;
      const sender = sendersRef.current.audio;
      const track = sender?.track;
      if (!track) return;
      if (track.readyState === 'ended' || track.muted) {
        console.warn('[Call][iOS] mic track unhealthy on foreground', {
          readyState: track.readyState,
          muted: track.muted,
        });
        void recoverMicrophone('auto:foreground');
      }
    };
    document.addEventListener('visibilitychange', verify);
    window.addEventListener('focus', verify);
    window.addEventListener('pageshow', verify);
    return () => {
      document.removeEventListener('visibilitychange', verify);
      window.removeEventListener('focus', verify);
      window.removeEventListener('pageshow', verify);
    };
  }, [activeCall, recoverMicrophone]);

  // Attach the watcher to whatever audio track is currently in flight
  // whenever the active call changes.
  useEffect(() => {
    if (!activeCall) return;
    const track = localStreamRef.current?.getAudioTracks?.()[0] || sendersRef.current.audio?.track || null;
    watchAudioTrack(track);
  }, [activeCall, watchAudioTrack]);

  const startCall: CallContextValue['startCall'] = async (opts) => {
    if (!user) return null;
    if (activeCall) return null;
    try {
      // CRITICAL: Acquire mic/camera FIRST, while we're still inside the user
      // gesture from the click handler. Any earlier `await` (DB insert, RPC)
      // consumes the gesture and causes getUserMedia to silently hang on
      // Android WebView / iOS Safari — which presents as "the caller's screen
      // freezes the moment they tap call".
      try {
        await acquireMedia(opts.type);
      } catch (mediaErr) {
        console.error('[Call] getUserMedia failed', mediaErr);
        // Surface a clear message instead of silently freezing.
        if (typeof window !== 'undefined') {
          alert(opts.type === 'video'
            ? 'Camera/microphone access is required for video calls. Please allow access in your browser settings.'
            : 'Microphone access is required for voice calls. Please allow access in your browser settings.');
        }
        return null;
      }

      const { data: callRow, error } = await supabase
        .from('calls')
        .insert({
          caller_id: user.id,
          callee_id: opts.calleeId,
          chat_id: opts.chatId ?? null,
          call_type: opts.type,
          status: 'ringing',
        })
        .select()
        .single();
      if (error || !callRow) {
        // Tear down the media we just acquired so the camera light doesn't
        // stay on after a failed call setup.
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        throw error;
      }

      setActiveCall(callRow);
      setRole('caller');
      setCallState('ringing');
      setRemoteName(opts.calleeName || 'User');
      {
        const av = opts.calleeAvatar || '';
        const isUrl = /^(https?:|data:|blob:)/i.test(av);
        setRemoteAvatarUrl(isUrl ? av : null);
        setRemoteAvatar(((opts.calleeName?.[0] || 'U')).slice(0, 1).toUpperCase());
      }

      // Fire native push so the callee's phone rings even when the app is killed.
      // Fire-and-forget — never block call setup on push delivery.
      sendCallPush({ data: {
        callId: callRow.id,
        calleeId: opts.calleeId,
        callType: opts.type,
        chatId: opts.chatId ?? null,
      } }).catch((e) => console.warn('[Call] push failed', e));

      playRingtone('outgoing');

      // Set up signaling channel
      const channel = supabase.channel(`call:${callRow.id}`, { config: { broadcast: { ack: false } } });
      channelRef.current = channel;

      channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!pcRef.current) return;
        try { await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch {}
      });
      channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (!pcRef.current || payload.from === user.id) return;
        try { await pcRef.current.addIceCandidate(payload.candidate); } catch {}
      });
      await channel.subscribe();

      // Subscribe to status changes for this call
      const statusChan = supabase
        .channel(`call-status:${callRow.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callRow.id}` }, async ({ new: newRow }: any) => {
          if (newRow.status === 'accepted' && pcRef.current === null) {
            // Callee accepted — create offer
            setCallState('connecting');
            // CRITICAL: clear the ring timeout so it doesn't fire mid-call
            // and force-end an active call after 30s.
            if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
            if (ringtoneRef.current) { try { ringtoneRef.current.pause(); } catch {} ringtoneRef.current = null; }
            const pc = setupPeerConnection(callRow, true);
            const stream = localStreamRef.current || await acquireMedia(opts.type);
            addTracksToPC(pc, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer, from: user.id } });
            // Start duration timer when connected
            durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
          } else if (['declined', 'ended', 'missed'].includes(newRow.status)) {
            cleanup();
            setActiveCall(null);
            setRole(null);
          }
        })
        .subscribe();
      // Stash for cleanup via channelRef wrapper
      const origCh = channelRef.current;
      channelRef.current = {
        send: origCh.send.bind(origCh),
        _chans: [origCh, statusChan],
      };

      // Ringing timeout → missed
      ringTimerRef.current = setTimeout(() => {
        // Defensive: only mark missed if the call is still ringing.
        // Prevents accidental termination of an already-connected call.
        const current = activeCallRef.current;
        if (!current) return;
        if (pcRef.current) return; // already negotiating/connected
        endCall('missed');
      }, RING_TIMEOUT_MS);
      return callRow;
    } catch (e) {
      console.error('startCall failed', e);
      cleanup();
      setActiveCall(null);
      setRole(null);
      return null;
    }
  };

  // Listen for incoming calls (callee side)
  const handleIncomingCall = useCallback(async (row: any) => {
    if (!user?.id || activeCall) return;
    if (!row || row.status !== 'ringing' || row.callee_id !== user.id) return;

    let callerName = 'Unknown'; let callerAvatar = 'U';
    let callerAvatarUrl: string | null = null;
    try {
      const { data: p } = await supabase
        .from('user_profiles').select('full_name, avatar_url').eq('id', row.caller_id).maybeSingle();
      if (p?.full_name) { callerName = p.full_name; callerAvatar = p.full_name[0]?.toUpperCase() || 'U'; }
      if (p?.avatar_url) callerAvatarUrl = p.avatar_url;
    } catch {}
    setActiveCall(row);
    setRole('callee');
    setCallState('ringing');
    setRemoteName(callerName);
    setRemoteAvatar(callerAvatar);
    setRemoteAvatarUrl(callerAvatarUrl);
    playRingtone('incoming');
    ringTimerRef.current = setTimeout(async () => {
      try {
        await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() })
          .eq('id', row.id).eq('status', 'ringing');
      } catch {}
      cleanup(); setActiveCall(null); setRole(null);
    }, RING_TIMEOUT_MS);
  }, [user?.id, activeCall, supabase, cleanup]);

  useEffect(() => {
    if (!user?.id) return;
    const chan = supabase
      .channel(`incoming-calls:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}`,
      }, async ({ new: row }: any) => handleIncomingCall(row))
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch {} };
  }, [user?.id, supabase, handleIncomingCall]);

  useEffect(() => {
    if (!user?.id || activeCall || typeof window === 'undefined') return;
    const handleCallUrl = () => {
      if (activeCallRef.current) return;
      const params = new URLSearchParams(window.location.search);
      const answerId = params.get('answerCall');
      const callId = params.get('call');
      const declineId = params.get('declineCall');
      const muteId = params.get('muteCall');
      const endId = params.get('endCall');
    if (endId) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('endCall');
        window.history.replaceState({}, '', url.toString());
      } catch {}
      const cur = activeCallRef.current;
      if (cur && cur.id === endId) { void endCall('ended'); }
      return;
    }
    if (muteId) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('muteCall');
        window.history.replaceState({}, '', url.toString());
      } catch {}
      const cur = activeCallRef.current;
      if (cur && cur.id === muteId) {
        // Force toggle mic
        setMicMuted((m) => {
          const next = !m;
          localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
          return next;
        });
      }
      return;
    }
    if (declineId) {
      // Lockscreen ringer "Decline" tapped — mark the call declined and clear the param.
      supabase.from('calls')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', declineId)
        .eq('callee_id', user.id)
        .eq('status', 'ringing')
        .then(() => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('declineCall');
            window.history.replaceState({}, '', url.toString());
          } catch {}
        });
      return;
    }
    if (answerId) {
      // Lockscreen ringer "Accept" tapped — auto-answer the call without
      // requiring a second tap inside the app.
      supabase.from('calls').select('*').eq('id', answerId).eq('callee_id', user.id)
        .in('status', ['ringing', 'accepted']).maybeSingle()
        .then(({ data }) => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('answerCall');
            window.history.replaceState({}, '', url.toString());
          } catch {}
          if (!data) return;
          // Populate remote-party display info, then join immediately.
          supabase.from('user_profiles').select('full_name, avatar_url').eq('id', data.caller_id).maybeSingle()
            .then(({ data: p }) => {
              const name = p?.full_name || 'Unknown';
              setRemoteName(name);
              setRemoteAvatar((name[0] || 'U').toUpperCase());
              void acceptCall(data);
            });
        });
      return;
    }
    if (!callId) return;
    supabase.from('calls').select('*').eq('id', callId).eq('callee_id', user.id).eq('status', 'ringing').maybeSingle()
      .then(({ data }) => {
        if (data) handleIncomingCall(data);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('call');
          window.history.replaceState({}, '', url.toString());
        } catch {}
      });
    };
    handleCallUrl();
    window.addEventListener('popstate', handleCallUrl);
    window.addEventListener('vt-call-url', handleCallUrl as EventListener);
    return () => {
      window.removeEventListener('popstate', handleCallUrl);
      window.removeEventListener('vt-call-url', handleCallUrl as EventListener);
    };
  }, [user?.id, activeCall, supabase, handleIncomingCall]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const onIncomingPush = ((event: CustomEvent<{ callId?: string; chatId?: string | null }>) => {
      const callId = event.detail?.callId;
      if (!callId || activeCallRef.current) return;
      supabase.from('calls').select('*').eq('id', callId).eq('callee_id', user.id).eq('status', 'ringing').maybeSingle()
        .then(({ data }) => { if (data) handleIncomingCall(data); });
    }) as EventListener;
    window.addEventListener('vt-incoming-call', onIncomingPush);
    return () => window.removeEventListener('vt-incoming-call', onIncomingPush);
  }, [user?.id, supabase, handleIncomingCall]);

  // Callee accept handler. Accepts either the current activeCall from state
  // (user tapped Accept in the in-app sheet) or an explicit row (auto-answer
  // from the native full-screen incoming-call notification).
  const acceptCall = async (row?: CallRow) => {
    const call = row || activeCall;
    if (!call) return;
    if (!row && role !== 'callee') return;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    if (ringtoneRef.current) { try { ringtoneRef.current.pause(); } catch {} ringtoneRef.current = null; }
    if (row) {
      // Auto-answer path: ensure state reflects the accepted call.
      setActiveCall(call);
      setRole('callee');
    }
    setCallState('connecting');

    // Set up channel and peer
    const channel = supabase.channel(`call:${call.id}`, { config: { broadcast: { ack: false } } });
    channelRef.current = channel;
    const pc = setupPeerConnection(call, false);
    const stream = await acquireMedia(call.call_type).catch(() => null);
    if (stream) addTracksToPC(pc, stream);

    channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer, from: user?.id } });
        durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      } catch (e) { console.error('answer failed', e); }
    });
    channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
      if (payload.from === user?.id) return;
      try { await pc.addIceCandidate(payload.candidate); } catch {}
    });
    await channel.subscribe();

    // Mark accepted (this triggers caller to send offer)
    await supabase.from('calls').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', call.id);

    // Listen for hangup
    const statusChan = supabase
      .channel(`call-status:${call.id}:callee`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${call.id}` }, ({ new: r }: any) => {
        if (['ended', 'declined', 'missed'].includes(r.status)) {
          cleanup(); setActiveCall(null); setRole(null);
        }
      })
      .subscribe();
    channelRef.current = { send: channel.send.bind(channel), _chans: [channel, statusChan] };
  };

  const declineCall = async () => {
    await endCall('declined');
  };

  // Mute/video toggles
  const toggleMic = () => {
    setMicMuted(m => {
      const next = !m;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  };
  const toggleVideo = () => {
    setVideoOff(v => {
      const next = !v;
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  };

  // Override removeChannel-aware cleanup for wrapped channelRef
  useEffect(() => {
    return () => {
      const ref = channelRef.current as any;
      if (ref?._chans) ref._chans.forEach((c: any) => { try { supabase.removeChannel(c); } catch {} });
    };
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      {activeCall && minimized && (
        <div className="fixed top-3 right-3 z-[100] flex items-center gap-2 rounded-full bg-neutral-900/95 text-white shadow-2xl border border-white/10 backdrop-blur-md pl-3 pr-1 py-1">
          <button
            onClick={() => {
              setMinimized(false);
              if (micStatus === 'failed') void recoverMicrophone('user:pill');
            }}
            className="flex items-center gap-2"
            aria-label="Expand call"
          >
            {micStatus === 'failed' ? (
              <AlertTriangle size={14} className="text-amber-400" />
            ) : micStatus === 'recovering' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            ) : (
              <span className={`w-2.5 h-2.5 rounded-full ${callState === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
            )}
            <span className="text-xs font-medium max-w-[110px] truncate">{remoteName}</span>
            <span className="text-xs text-white/70 tabular-nums">
              {micStatus === 'failed' ? 'mic' : micStatus === 'recovering' ? '…' : callState === 'connected' ? fmt(callDuration) : callState === 'connecting' ? '...' : 'ring'}
            </span>
            <span className="ml-1 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <Maximize2 size={13} />
            </span>
          </button>
          <button
            onClick={() => { playEndCallClick(); endCall('ended'); }}
            aria-label="End call"
            className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
          >
            <PhoneOff size={14} />
          </button>
          {/* Keep the remote audio element mounted while minimized so the
              call keeps flowing even with the full UI hidden. */}
          {activeCall.call_type === 'voice' && (
            <audio ref={remoteAudioRef} autoPlay playsInline muted={speakerOff} className="hidden" />
          )}
          {activeCall.call_type === 'video' && (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline muted={speakerOff} className="hidden" />
              <video ref={localVideoRef} autoPlay muted playsInline className="hidden" />
            </>
          )}
        </div>
      )}
      {activeCall && !minimized && (
        <div
          className="fixed inset-0 z-[100] flex flex-col text-white"
          style={{
            background:
              activeCall.call_type === 'video'
                ? '#000'
                : 'radial-gradient(ellipse at center, #1a0333 0%, #0a0118 60%, #050010 100%)',
          }}
        >
          {/* Full-bleed remote video for video calls */}
          {activeCall.call_type === 'video' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {activeCall.call_type === 'video' && callState !== 'connected' && (
            <div className="absolute inset-0 bg-black/60" />
          )}

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-6 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
            <button
              onClick={() => setMinimized(true)}
              aria-label="Minimize call"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              <ChevronDown size={22} />
            </button>
            <div className="flex-1 flex flex-col items-center min-w-0 px-2">
              <h3 className="font-bold text-xl truncate max-w-full">{remoteName}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={13} className="text-purple-400" />
                <span className="text-[11px] font-medium text-purple-300">End-to-end encrypted</span>
              </div>
              <p className="text-sm text-white/70 mt-1 tabular-nums">
                {callState === 'ringing' && (role === 'caller' ? `${activeCall.call_type === 'video' ? 'Video' : 'Voice'} calling…` : `Incoming ${activeCall.call_type} call`)}
                {callState === 'connecting' && 'Connecting…'}
                {callState === 'connected' && fmt(callDuration)}
              </p>
            </div>
            <button
              aria-label="More"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center opacity-70"
            >
              <MoreVertical size={20} />
            </button>
          </div>

          {micStatus !== 'ok' && (
            <button
              onClick={() => { if (micStatus === 'failed') void recoverMicrophone('user:banner'); }}
              disabled={micStatus === 'recovering'}
              className="relative z-10 mx-auto mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/95 text-neutral-900 text-xs font-medium shadow-lg disabled:opacity-80"
            >
              <AlertTriangle size={13} />
              <span className="truncate">
                {micStatus === 'recovering' ? 'Restoring microphone…' : 'Microphone interrupted. Tap to restore'}
              </span>
            </button>
          )}

          {/* Main content area */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
            {activeCall.call_type === 'voice' ? (
              <>
                {/* Concentric purple pulse rings behind the avatar */}
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-64 h-64 rounded-full border border-purple-500/20 animate-vt-ring" style={{ animationDelay: '0s' }} />
                  <span className="absolute w-52 h-52 rounded-full border border-purple-500/30 animate-vt-ring" style={{ animationDelay: '0.4s' }} />
                  <span className="absolute w-40 h-40 rounded-full border border-purple-500/40 animate-vt-ring" style={{ animationDelay: '0.8s' }} />
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center text-4xl font-bold shadow-[0_0_60px_rgba(168,85,247,0.5)]">
                    {remoteAvatar}
                  </div>
                </div>
                {/* Waveform */}
                <div className="mt-16 flex items-center justify-center gap-[3px] h-16 w-full max-w-xs">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-purple-500"
                      style={{
                        height: `${20 + Math.abs(Math.sin(i * 0.6)) * 40 + Math.abs(Math.cos(i * 0.9)) * 15}%`,
                        opacity: callState === 'connected' ? 0.9 : 0.35,
                        animation: callState === 'connected' ? `vt-wave 1.1s ease-in-out ${i * 0.05}s infinite` : undefined,
                        boxShadow: '0 0 8px rgba(168, 85, 247, 0.6)',
                      }}
                    />
                  ))}
                </div>
                <audio ref={remoteAudioRef} autoPlay />
              </>
            ) : (
              // Video: PiP self-view bottom-right
              !videoOff && (
                <div className="absolute bottom-6 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/40 bg-black shadow-2xl">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                </div>
              )
            )}
          </div>

          {/* Bottom control bar */}
          <div
            className="relative z-10 px-6 pt-4 pb-8 flex items-center justify-center gap-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            {role === 'callee' && callState === 'ringing' ? (
              <>
                <button
                  onClick={() => { playEndCallClick(); declineCall(); }}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
                  aria-label="Decline"
                >
                  <PhoneOff size={26} />
                </button>
                <button
                  onClick={() => acceptCall()}
                  className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 shadow-lg"
                  aria-label="Accept"
                >
                  <Phone size={26} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleMic}
                  aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500/30 text-red-300' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {micMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                <button
                  onClick={toggleAudioRoute}
                  aria-label={audioRoute === 'speaker' ? 'Switch to earpiece' : 'Switch to speaker'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${audioRoute === 'speaker' ? 'bg-white text-purple-900' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {audioRoute === 'speaker' ? <Volume2 size={22} /> : <Ear size={22} />}
                </button>
                {activeCall.call_type === 'video' && (
                  <button
                    onClick={toggleVideo}
                    aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${videoOff ? 'bg-red-500/30 text-red-300' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                )}
                {activeCall.call_type === 'video' && !videoOff && (
                  <button
                    onClick={switchCamera}
                    aria-label="Switch camera"
                    className="w-14 h-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <SwitchCamera size={22} />
                  </button>
                )}
                <button
                  onClick={() => { playEndCallClick(); endCall('ended'); }}
                  aria-label="End call"
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
                >
                  <PhoneOff size={26} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}