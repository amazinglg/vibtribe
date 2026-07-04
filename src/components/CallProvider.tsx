// @ts-nocheck
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Bluetooth, Ear, Headphones, Minimize2, Maximize2, AlertTriangle } from 'lucide-react';
import { SwitchCamera } from 'lucide-react';
import { acquireCallWakeLock, setCallAudioRoute } from '@/lib/native-bridge';
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
  const [callDuration, setCallDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [audioRoute, setAudioRoute] = useState<'earpiece' | 'speaker' | 'bluetooth'>('speaker');
  const [bluetoothAvailable, setBluetoothAvailable] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
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

  // Detect whether a Bluetooth audio device is currently connected so we can
  // show the Bluetooth option only when it's actually available.
  useEffect(() => {
    if (!activeCall) return;
    let cancelled = false;
    const check = async () => {
      try {
        const md: any = navigator.mediaDevices;
        if (!md?.enumerateDevices) return;
        const devices = await md.enumerateDevices();
        const bt = devices.some((d: MediaDeviceInfo) =>
          d.kind === 'audiooutput' && /bluetooth|bt|airpod|headset|handsfree/i.test(d.label || '')
        );
        if (!cancelled) setBluetoothAvailable(bt);
      } catch {}
    };
    check();
    const md: any = navigator.mediaDevices;
    md?.addEventListener?.('devicechange', check);
    return () => { cancelled = true; md?.removeEventListener?.('devicechange', check); };
  }, [activeCall]);

  // Apply the selected audio route to the remote audio/video elements
  // (setSinkId on web) and to the native bridge (Android WebView).
  const applyAudioRoute = useCallback(async (route: 'earpiece' | 'speaker' | 'bluetooth') => {
    setAudioRoute(route);
    setCallAudioRoute(route);
    try {
      const md: any = navigator.mediaDevices;
      if (!md?.enumerateDevices) return;
      const devices = await md.enumerateDevices();
      const outs = devices.filter((d: MediaDeviceInfo) => d.kind === 'audiooutput');
      let target: MediaDeviceInfo | undefined;
      if (route === 'bluetooth') {
        target = outs.find((d: MediaDeviceInfo) => /bluetooth|bt|airpod|headset|handsfree/i.test(d.label || ''));
      } else if (route === 'speaker') {
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
    setMicMuted(false); setSpeakerOff(false); setVideoOff(false);
    setShowAudioMenu(false);
    setMinimized(false);
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
      setRemoteAvatar((opts.calleeAvatar || opts.calleeName?.[0] || 'U').slice(0, 1).toUpperCase());

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
    try {
      const { data: p } = await supabase
        .from('user_profiles').select('full_name, avatar_url').eq('id', row.caller_id).maybeSingle();
      if (p?.full_name) { callerName = p.full_name; callerAvatar = p.full_name[0]?.toUpperCase() || 'U'; }
    } catch {}
    setActiveCall(row);
    setRole('callee');
    setCallState('ringing');
    setRemoteName(callerName);
    setRemoteAvatar(callerAvatar);
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
      const callId = params.get('call') || params.get('answerCall');
      const declineId = params.get('declineCall');
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
    if (!callId) return;
    supabase.from('calls').select('*').eq('id', callId).eq('callee_id', user.id).eq('status', 'ringing').maybeSingle()
      .then(({ data }) => {
        if (data) handleIncomingCall(data);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('call');
          url.searchParams.delete('answerCall');
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

  // Callee accept handler
  const acceptCall = async () => {
    if (!activeCall || role !== 'callee') return;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    if (ringtoneRef.current) { try { ringtoneRef.current.pause(); } catch {} ringtoneRef.current = null; }
    setCallState('connecting');

    // Set up channel and peer
    const channel = supabase.channel(`call:${activeCall.id}`, { config: { broadcast: { ack: false } } });
    channelRef.current = channel;
    const pc = setupPeerConnection(activeCall, false);
    const stream = await acquireMedia(activeCall.call_type).catch(() => null);
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
    await supabase.from('calls').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', activeCall.id);

    // Listen for hangup
    const statusChan = supabase
      .channel(`call-status:${activeCall.id}:callee`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${activeCall.id}` }, ({ new: r }: any) => {
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
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2"
            aria-label="Expand call"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${callState === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
            <span className="text-xs font-medium max-w-[110px] truncate">{remoteName}</span>
            <span className="text-xs text-white/70 tabular-nums">
              {callState === 'connected' ? fmt(callDuration) : callState === 'connecting' ? '...' : 'ring'}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
               style={{ background: 'linear-gradient(135deg, #0a0a1f 0%, #1a0a2e 50%, #0a1a2e 100%)' }}>
            {/* Minimize button — lets the user access chat while the call keeps running */}
            {(role === 'caller' || callState !== 'ringing') && (
              <button
                onClick={() => setMinimized(true)}
                aria-label="Minimize call"
                className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md"
              >
                <Minimize2 size={16} />
              </button>
            )}
            {activeCall.call_type === 'video' ? (
              <div className="relative h-72 bg-black/60">
                {/* Remote video — large */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  muted={speakerOff}
                />
                {callState !== 'connected' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                    <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-3xl mb-3 border-4 border-white/20">{remoteAvatar}</div>
                  </div>
                )}
                {/* Local self-view */}
                {!videoOff && (
                  <div className="absolute bottom-3 right-3 w-20 h-28 rounded-xl overflow-hidden border-2 border-white/30 bg-black/60">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-12 pb-6 flex flex-col items-center">
                <div className={`w-24 h-24 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-4xl mb-4 ${callState === 'ringing' ? 'pulse-ring' : ''}`}>
                  {remoteAvatar}
                </div>
                <audio ref={remoteAudioRef} autoPlay muted={speakerOff} />
              </div>
            )}

            <div className="px-6 pb-4 text-center">
              <h3 className="font-bold text-xl text-white mb-1">{remoteName}</h3>
              <p className="text-sm text-white/70">
                {callState === 'ringing' && (role === 'caller' ? `${activeCall.call_type === 'video' ? 'Video' : 'Voice'} calling...` : `Incoming ${activeCall.call_type} call`)}
                {callState === 'connecting' && 'Connecting...'}
                {callState === 'connected' && fmt(callDuration)}
              </p>
            </div>

            <div className="px-6 pb-8 flex items-center justify-center gap-3">
              {role === 'callee' && callState === 'ringing' ? (
                <>
                  <button
                    onClick={() => { playEndCallClick(); declineCall(); }}
                    className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg"
                    aria-label="Decline">
                    <PhoneOff size={22} />
                  </button>
                  <button
                    onClick={acceptCall}
                    className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white hover:bg-green-600 shadow-lg"
                    aria-label="Accept">
                    <Phone size={22} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={toggleMic}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowAudioMenu(v => !v)}
                      aria-label="Audio output"
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${audioRoute === 'speaker' ? 'bg-white/20 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      {audioRoute === 'bluetooth' ? <Bluetooth size={20} /> : audioRoute === 'earpiece' ? <Ear size={20} /> : <Volume2 size={20} />}
                    </button>
                    {showAudioMenu && (
                      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-40 rounded-2xl bg-neutral-900/95 border border-white/10 shadow-2xl backdrop-blur-md p-1 z-10">
                        {[
                          { id: 'earpiece' as const, label: 'Phone', icon: <Ear size={16} /> },
                          { id: 'speaker' as const, label: 'Speaker', icon: <Volume2 size={16} /> },
                          ...(bluetoothAvailable ? [{ id: 'bluetooth' as const, label: 'Bluetooth', icon: <Bluetooth size={16} /> }] : []),
                        ].map(opt => (
                          <button key={opt.id}
                            onClick={() => { applyAudioRoute(opt.id); setShowAudioMenu(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${audioRoute === opt.id ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                            {opt.icon}<span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSpeakerOff(s => !s)}
                    aria-label={speakerOff ? 'Unmute speaker' : 'Mute speaker'}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${speakerOff ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {speakerOff ? <VolumeX size={20} /> : <Headphones size={20} />}
                  </button>
                  {activeCall.call_type === 'video' && (
                    <button onClick={toggleVideo}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${videoOff ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>
                  )}
                  {activeCall.call_type === 'video' && !videoOff && (
                    <button onClick={switchCamera}
                      aria-label="Switch camera"
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all">
                      <SwitchCamera size={20} />
                    </button>
                  )}
                  <button onClick={() => { playEndCallClick(); endCall('ended'); }}
                    className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg">
                    <PhoneOff size={22} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}