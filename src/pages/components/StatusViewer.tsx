// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Send, MoreVertical, Pause, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Story {
  id: string;
  type: string;
  content: string;
  media_url?: string | null;
  bg: string;
  time: string;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  color: string;
  stories: Story[];
  userId?: string; // owner's user_id
}

interface StatusViewerProps {
  contact: Contact;
  onClose: () => void;
}

const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏', '💜'];

export default function StatusViewer({ contact, onClose }: StatusViewerProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const isOwner = !!user?.id && !!contact.userId && contact.userId === user.id;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; name: string; viewed_at: string }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000;

  const story = contact.stories[currentIdx];

  useEffect(() => {
    if (paused) return;
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(intervalRef.current!);
          if (currentIdx < contact.stories.length - 1) {
            setCurrentIdx(i => i + 1);
          } else {
            onClose();
          }
          return 100;
        }
        return prev + 100 / (DURATION / 100);
      });
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentIdx, paused, contact.stories.length, onClose]);

  // Record a view when a story is shown (non-owner only)
  useEffect(() => {
    if (!user?.id || !story?.id || isOwner) return;
    supabase.from('status_views')
      .upsert({ status_id: story.id, viewer_id: user.id }, { onConflict: 'status_id,viewer_id' })
      .then(() => {});
  }, [story?.id, user?.id, isOwner]);

  // Load viewers list for owner
  useEffect(() => {
    if (!isOwner || !story?.id) return;
    (async () => {
      const { data } = await supabase
        .from('status_views')
        .select('viewer_id, viewed_at, user_profiles!status_views_viewer_id_fkey(full_name)')
        .eq('status_id', story.id)
        .order('viewed_at', { ascending: false });
      setViewers((data || []).map((v: any) => ({
        id: v.viewer_id,
        name: v.user_profiles?.full_name || 'Someone',
        viewed_at: v.viewed_at,
      })));
    })();
  }, [story?.id, isOwner]);

  const handleReply = async () => {
    if (!reply.trim() || sending) return;
    if (!user?.id || !contact.userId) { toast.error('Cannot reply to this status'); return; }
    if (isOwner) { toast.error("You can't reply to your own status"); return; }
    setSending(true);
    try {
      // Find or create a 1:1 chat between user and the status owner
      const { data: existing } = await supabase
        .from('chats')
        .select('id')
        .or(`and(participant_one.eq.${user.id},participant_two.eq.${contact.userId}),and(participant_one.eq.${contact.userId},participant_two.eq.${user.id})`)
        .maybeSingle();
      let chatId = existing?.id as string | undefined;
      if (!chatId) {
        const { data: created, error: cErr } = await supabase
          .from('chats')
          .insert({ participant_one: user.id, participant_two: contact.userId, chat_type: 'normal' })
          .select('id').single();
        if (cErr) throw cErr;
        chatId = created!.id;
      }
      // Build a quoted reply payload so chat UI can show "Replying to your status"
      const quote = (story?.content || (story?.media_url ? '[media]' : '')).slice(0, 80);
      const body = `↪️ Reply to status${quote ? ` ("${quote}")` : ''}:\n${reply.trim()}`;
      const { error: mErr } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: user.id, content: body, message_status: 'sent' });
      if (mErr) throw mErr;
      toast.success(`Reply sent to ${contact.name}`);
      setReply('');
      setPaused(false);
    } catch (err: any) {
      toast.error(err?.message || 'Could not send reply');
    } finally {
      setSending(false);
    }
  };

  const handleReaction = (emoji: string) => {
    setReply((r) => (r ? r + ' ' : '') + emoji);
    setShowReactions(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 glass rounded-full text-foreground hover:bg-muted transition-all"
      >
        <X size={20} />
      </button>

      {/* Story Card */}
      <div className="relative w-full max-w-sm mx-4 h-[80vh] max-h-[700px] rounded-3xl overflow-hidden shadow-card">
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-3 pt-3">
          {contact.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 pt-7 px-4 pb-3 flex items-center gap-3">
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt={contact.name}
                 className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className={`w-9 h-9 ${contact.color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
              {contact.avatar}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm text-white">{contact.name}</p>
            <p className="text-[10px] text-white/70">{story.time}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => { setShowViewers(v => !v); setPaused(true); }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-black/40 text-white border border-white/20"
              >
                <Eye size={13} />
                <span>{viewers.length}</span>
              </button>
            )}
            <button
              onClick={() => setPaused(!paused)}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button className="p-1.5 text-white/80 hover:text-white transition-colors">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Story Content */}
        {story.type === 'image' && story.media_url ? (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />
            {story.content && (
              <div className="absolute bottom-20 left-0 right-0 px-6 text-center">
                <p className="text-base text-white bg-black/50 inline-block px-3 py-1.5 rounded-lg">{story.content}</p>
              </div>
            )}
          </div>
        ) : story.type === 'video' && story.media_url ? (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <video src={story.media_url} autoPlay playsInline controls className="max-h-full max-w-full" />
            {story.content && (
              <div className="absolute bottom-20 left-0 right-0 px-6 text-center">
                <p className="text-base text-white bg-black/50 inline-block px-3 py-1.5 rounded-lg">{story.content}</p>
              </div>
            )}
          </div>
        ) : (
          <div className={`absolute inset-0 ${story.bg || 'gradient-primary'} flex items-center justify-center`}>
            <div className="text-center px-6">
              <p className="text-3xl font-bold text-white leading-tight">{story.content}</p>
            </div>
          </div>
        )}

        {/* Navigation Zones */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          onClick={() => { if (currentIdx > 0) setCurrentIdx(i => i - 1); else onClose(); }}
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
          onClick={() => { if (currentIdx < contact.stories.length - 1) setCurrentIdx(i => i + 1); else onClose(); }}
        />

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
          {isOwner ? (
            <div className="text-center text-xs text-white/80 bg-black/40 rounded-full px-3 py-2 backdrop-blur-sm">
              {viewers.length === 0 ? 'No views yet' : `${viewers.length} view${viewers.length === 1 ? '' : 's'} — tap eye to see who`}
            </div>
          ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => { if (!reply) setPaused(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                placeholder={`Reply to ${contact.name}...`}
                className="w-full px-4 py-2.5 bg-black/40 border border-white/20 rounded-full text-sm text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setShowReactions(!showReactions); }}
              className="p-2.5 bg-black/40 border border-white/20 rounded-full text-white hover:bg-white/10 transition-all backdrop-blur-sm"
            >
              <Heart size={18} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleReply(); }}
              disabled={sending || !reply.trim()}
              className="p-2.5 gradient-primary rounded-full text-white hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
          )}

          {/* Reaction Picker */}
          {showReactions && (
            <div className="flex justify-center gap-3 mt-3 float-up" onClick={(e) => e.stopPropagation()}>
              {REACTIONS.map((emoji) => (
                <button
                  key={`viewer-react-${emoji}`}
                  onClick={() => handleReaction(emoji)}
                  className="text-2xl hover:scale-125 transition-transform bg-black/40 rounded-full p-1.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Owner viewers panel */}
        {isOwner && showViewers && (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto bg-black/85 backdrop-blur-md border-t border-white/15 rounded-t-2xl p-4"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white flex items-center gap-2"><Eye size={14}/> Viewed by {viewers.length}</p>
              <button onClick={() => { setShowViewers(false); setPaused(false); }} className="p-1.5 text-white/70 hover:text-white"><X size={16} /></button>
            </div>
            {viewers.length === 0 ? (
              <p className="text-xs text-white/60">No one has viewed this story yet.</p>
            ) : (
              <ul className="space-y-2">
                {viewers.map(v => (
                  <li key={v.id} className="flex items-center justify-between text-xs text-white/90">
                    <span>{v.name}</span>
                    <span className="text-white/50">{new Date(v.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}