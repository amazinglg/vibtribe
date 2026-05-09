// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Send, MoreVertical, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';

interface Story {
  id: string;
  type: string;
  content: string;
  bg: string;
  time: string;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  color: string;
  stories: Story[];
}

interface StatusViewerProps {
  contact: Contact;
  onClose: () => void;
}

const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏', '💜'];

export default function StatusViewer({ contact, onClose }: StatusViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [showReactions, setShowReactions] = useState(false);
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

  const handleReply = () => {
    if (!reply.trim()) return;
    // Backend: POST /api/status/:storyId/reply — { message: reply }
    toast.success(`Replied to ${contact.name}'s status`);
    setReply('');
  };

  const handleReaction = (emoji: string) => {
    // Backend: POST /api/status/:storyId/react — { emoji }
    toast.success(`Reacted with ${emoji}`);
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
          <div className={`w-9 h-9 ${contact.color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {contact.avatar}
          </div>
          <div>
            <p className="font-semibold text-sm text-white">{contact.name}</p>
            <p className="text-[10px] text-white/70">{story.time}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
        <div className={`absolute inset-0 ${story.bg} flex items-center justify-center`}>
          <div className="text-center px-6">
            <p className="text-3xl font-bold text-white leading-tight">{story.content}</p>
          </div>
        </div>

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
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
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
              className="p-2.5 gradient-primary rounded-full text-white hover:opacity-90 transition-all"
            >
              <Send size={18} />
            </button>
          </div>

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
      </div>
    </div>
  );
}