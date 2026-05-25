// @ts-nocheck
import React, { useState, useEffect } from 'react';
import StatusViewer from './StatusViewer';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CircleDot } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

interface ContactStatus {
  id: string;
  name: string;
  userId: string;
  avatar: string;
  avatarUrl?: string | null;
  color: string;
  updates: number;
  seen: boolean;
  time: string;
  views: number;
  stories: { id: string; type: string; content: string; media_url?: string | null; bg: string; time: string }[];
}

export default function StatusGrid() {
  const { t } = useT();
  const { user } = useAuth();
  const supabase = createClient();
  const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContact, setViewerContact] = useState<ContactStatus | null>(null);

  useEffect(() => {
    if (user) loadContactStatuses();
  }, [user]);

  const loadContactStatuses = async () => {
    setLoading(true);
    try {
      try { await supabase.rpc('cleanup_expired_statuses'); } catch {}
      // Get user's contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_id')
        .eq('user_id', user?.id);

      const contactIds = (contacts || []).map(c => c.contact_id);
      // Always include self so "My Updates" shows up too
      const userIds = Array.from(new Set([...(contactIds || []), user?.id].filter(Boolean) as string[]));
      if (userIds.length === 0) { setContactStatuses([]); setLoading(false); return; }

      // Get statuses from contacts only
      const { data: statuses } = await supabase
        .from('statuses')
        .select(`
          id,
          user_id,
          content,
          media_url,
          media_type,
          background_color,
          created_at,
          expires_at,
          view_count,
          user_profiles!statuses_user_id_fkey(full_name, avatar_url, profile_photo_visibility)
        `)
        .in('user_id', userIds)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!statuses || statuses.length === 0) {
        setContactStatuses([]);
        setLoading(false);
        return;
      }

      // Group by user
      const grouped: Record<string, ContactStatus> = {};
      const COLORS = ['gradient-primary', 'gradient-cyan', 'gradient-pink', 'gradient-tri'];
      let colorIdx = 0;

      for (const s of statuses) {
        const profile = s.user_profiles as any;
        const isMe = s.user_id === user?.id;
        const name = isMe ? 'My Status' : (profile?.full_name || 'Unknown');
        const showAvatar = isMe || (profile?.profile_photo_visibility ?? 'all') === 'all';
        if (!grouped[s.user_id]) {
          grouped[s.user_id] = {
            id: `status-${s.user_id}`,
            name,
            userId: s.user_id,
            avatar: name[0]?.toUpperCase() || '?',
            avatarUrl: showAvatar ? (profile?.avatar_url || null) : null,
            color: COLORS[colorIdx++ % COLORS.length],
            updates: 0,
            seen: false,
            time: formatTime(s.created_at),
            views: s.view_count || 0,
            stories: [],
          };
        }
        grouped[s.user_id].updates += 1;
        grouped[s.user_id].stories.push({
          id: s.id,
          type: s.media_type || 'text',
          content: s.content || '',
          media_url: s.media_url || null,
          bg: s.background_color ? '' : COLORS[colorIdx % COLORS.length],
          time: formatTime(s.created_at),
        });
      }

      // Put own status first
      const all = Object.values(grouped);
      all.sort((a, b) => (a.id.endsWith(user?.id || '') ? -1 : b.id.endsWith(user?.id || '') ? 1 : 0));
      setContactStatuses(all);
    } catch {
      setContactStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const unseen = contactStatuses.filter(c => !c.seen);
  const seen = contactStatuses.filter(c => c.seen);

  const openViewer = (contact: ContactStatus) => {
    setViewerContact(contact);
    setViewerOpen(true);
  };

  if (loading) {
    return (
      <div className="px-4 lg:px-8 pb-8 flex items-center justify-center py-16">
        <div className="text-center">
          <CircleDot size={32} className="text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading statuses...</p>
        </div>
      </div>
    );
  }

  if (contactStatuses.length === 0) {
    return (
      <div className="px-4 lg:px-8 pb-8">
        <div className="glass rounded-2xl border border-border p-10 flex flex-col items-center justify-center text-center">
          <CircleDot size={40} className="text-muted-foreground mb-4" />
          <p className="text-base font-semibold text-foreground mb-1">No status updates</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Status updates from your contacts will appear here. Add contacts to see their stories.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 pb-8">
      {/* Recent Updates */}
      {unseen.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Recent Updates ({unseen.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {unseen.map((contact) => (
              <StatusCard key={contact.id} contact={contact} onClick={() => openViewer(contact)} />
            ))}
          </div>
        </div>
      )}

      {/* Viewed Updates */}
      {seen.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Viewed ({seen.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {seen.map((contact) => (
              <StatusCard key={contact.id} contact={contact} onClick={() => openViewer(contact)} seen />
            ))}
          </div>
        </div>
      )}

      {/* Status Viewer */}
      {viewerOpen && viewerContact && (
        <StatusViewer
          contact={viewerContact}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

function StatusCard({
  contact,
  onClick,
  seen = false,
}: {
  contact: ContactStatus;
  onClick: () => void;
  seen?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 glass rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 card-3d group"
    >
      {/* Ring + Avatar */}
      <div className={`relative ${seen ? 'status-ring-seen' : 'status-ring-active'} p-0.5 rounded-full`}>
        {contact.avatarUrl ? (
          <img src={contact.avatarUrl} alt={contact.name}
               className="w-14 h-14 rounded-full object-cover border-2 border-background" />
        ) : (
          <div className={`w-14 h-14 ${contact.color} rounded-full flex items-center justify-center text-white font-bold text-base border-2 border-background`}>
            {contact.avatar}
          </div>
        )}
        {contact.updates > 1 && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 gradient-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-background">
            {contact.updates}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground truncate max-w-[80px]">{contact.name.split(' ')[0]}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{contact.time}</p>
      </div>

      {/* View count */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>👁</span>
        <span>{contact.views}</span>
      </div>
    </button>
  );
}