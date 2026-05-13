// @ts-nocheck
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

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

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const RING_TIMEOUT_MS = 30_000;

export default function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeCall, setActiveCall] = useState<CallRow | null>(null);
  const [role, setRole] = useState<'caller' | 'callee' | null>(null);
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
  const [remoteName, setRemoteName] = useState('User');
  const [remoteAvatar, setRemoteAvatar] = useState('U');
  const [callDuration, setCallDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
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
  }, [supabase]);

  const endCall = useCallback(async (finalStatus: 'ended' | 'declined' | 'missed' = 'ended') => {
    const call = activeCall;
    const finalDuration = callDuration;
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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        // do nothing — let user end manually
      }
    };
    return pc;
  };

  const acquireMedia = async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current && type === 'video') {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  const startCall: CallContextValue['startCall'] = async (opts) => {
    if (!user) return null;
    if (activeCall) return null;
    try {
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
      if (error || !callRow) throw error;

      setActiveCall(callRow);
      setRole('caller');
      setCallState('ringing');
      setRemoteName(opts.calleeName || 'User');
      setRemoteAvatar((opts.calleeAvatar || opts.calleeName?.[0] || 'U').slice(0, 1).toUpperCase());

      // Pre-acquire local media (so user sees themselves while ringing)
      try { await acquireMedia(opts.type); } catch {}
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
            if (ringtoneRef.current) { try { ringtoneRef.current.pause(); } catch {} ringtoneRef.current = null; }
            const pc = setupPeerConnection(callRow, true);
            const stream = localStreamRef.current || await acquireMedia(opts.type);
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
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
  const handleIncomingCall = useCallback(async (row: any, autoAccept = false) => {
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
    if (autoAccept) setTimeout(() => acceptCall(), 250);
  }, [user?.id, activeCall, supabase, cleanup]);

  useEffect(() => {
    if (!user?.id) return;
    const chan = supabase
      .channel(`incoming-calls:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}`,
      }, async ({ new: row }: any) => {
        if (activeCall) return; // already in a call
        if (row.status !== 'ringing') return;
        // Fetch caller profile for name/avatar
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
        // Auto-mark missed if not answered
        ringTimerRef.current = setTimeout(async () => {
          try {
            await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() })
              .eq('id', row.id).eq('status', 'ringing');
          } catch {}
          cleanup(); setActiveCall(null); setRole(null);
        }, RING_TIMEOUT_MS);
      })
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch {} };
  }, [user?.id, supabase, activeCall, cleanup]);

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
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

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
      {activeCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
               style={{ background: 'linear-gradient(135deg, #0a0a1f 0%, #1a0a2e 50%, #0a1a2e 100%)' }}>
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
                    onClick={declineCall}
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
                  <button onClick={() => setSpeakerOff(s => !s)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${speakerOff ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {speakerOff ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  {activeCall.call_type === 'video' && (
                    <button onClick={toggleVideo}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${videoOff ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>
                  )}
                  <button onClick={() => endCall('ended')}
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