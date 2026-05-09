import React, { useState } from 'react';
import StatusViewer from './StatusViewer';

const STATUS_CONTACTS = [
  {
    id: 'status-001',
    name: 'Priya Sharma',
    avatar: 'P',
    color: 'gradient-primary',
    updates: 3,
    seen: false,
    time: '2m ago',
    views: 45,
    stories: [
      { id: 'story-001-1', type: 'text', content: 'New beginnings ✨', bg: 'gradient-primary', time: '2m ago' },
      { id: 'story-001-2', type: 'text', content: 'Feeling amazing today 🌟', bg: 'gradient-cyan', time: '1h ago' },
      { id: 'story-001-3', type: 'text', content: 'Coffee + code = 💜', bg: 'gradient-pink', time: '3h ago' },
    ],
  },
  {
    id: 'status-002',
    name: 'Arjun Mehta',
    avatar: 'A',
    color: 'gradient-cyan',
    updates: 1,
    seen: false,
    time: '15m ago',
    views: 23,
    stories: [
      { id: 'story-002-1', type: 'text', content: 'Shipped a feature today 🚀', bg: 'gradient-cyan', time: '15m ago' },
    ],
  },
  {
    id: 'status-003',
    name: 'Zara Khan',
    avatar: 'Z',
    color: 'gradient-pink',
    updates: 2,
    seen: true,
    time: '45m ago',
    views: 67,
    stories: [
      { id: 'story-003-1', type: 'text', content: 'Saturday vibes 🎵', bg: 'gradient-pink', time: '45m ago' },
      { id: 'story-003-2', type: 'text', content: 'Making memories 📸', bg: 'gradient-primary', time: '2h ago' },
    ],
  },
  {
    id: 'status-004',
    name: 'Dev Kapoor',
    avatar: 'D',
    color: 'gradient-tri',
    updates: 4,
    seen: false,
    time: '1h ago',
    views: 89,
    stories: [
      { id: 'story-004-1', type: 'text', content: 'Team lunch was 🔥', bg: 'gradient-tri', time: '1h ago' },
      { id: 'story-004-2', type: 'text', content: 'Productive day 💪', bg: 'gradient-primary', time: '3h ago' },
      { id: 'story-004-3', type: 'text', content: 'New project incoming!', bg: 'gradient-cyan', time: '5h ago' },
      { id: 'story-004-4', type: 'text', content: 'Grateful for this team 🙏', bg: 'gradient-pink', time: '8h ago' },
    ],
  },
  {
    id: 'status-005',
    name: 'Nisha Patel',
    avatar: 'N',
    color: 'gradient-primary',
    updates: 1,
    seen: true,
    time: '2h ago',
    views: 34,
    stories: [
      { id: 'story-005-1', type: 'text', content: 'Sunsets and serenity 🌅', bg: 'gradient-pink', time: '2h ago' },
    ],
  },
  {
    id: 'status-006',
    name: 'Rohan Verma',
    avatar: 'R',
    color: 'gradient-cyan',
    updates: 2,
    seen: false,
    time: '3h ago',
    views: 12,
    stories: [
      { id: 'story-006-1', type: 'text', content: 'Gym done ✅', bg: 'gradient-cyan', time: '3h ago' },
      { id: 'story-006-2', type: 'text', content: 'Meal prep Sunday 🥗', bg: 'gradient-primary', time: '5h ago' },
    ],
  },
  {
    id: 'status-007',
    name: 'Sneha Gupta',
    avatar: 'S',
    color: 'gradient-pink',
    updates: 3,
    seen: true,
    time: '4h ago',
    views: 56,
    stories: [
      { id: 'story-007-1', type: 'text', content: 'Art is life 🎨', bg: 'gradient-pink', time: '4h ago' },
      { id: 'story-007-2', type: 'text', content: 'New painting WIP', bg: 'gradient-primary', time: '6h ago' },
      { id: 'story-007-3', type: 'text', content: 'Inspired by everything', bg: 'gradient-tri', time: '9h ago' },
    ],
  },
  {
    id: 'status-008',
    name: 'Kavya Reddy',
    avatar: 'K',
    color: 'gradient-tri',
    updates: 1,
    seen: false,
    time: '5h ago',
    views: 28,
    stories: [
      { id: 'story-008-1', type: 'text', content: 'Exploring new places 🗺️', bg: 'gradient-tri', time: '5h ago' },
    ],
  },
  {
    id: 'status-009',
    name: 'Vikram Singh',
    avatar: 'V',
    color: 'gradient-primary',
    updates: 2,
    seen: true,
    time: '8h ago',
    views: 19,
    stories: [
      { id: 'story-009-1', type: 'text', content: 'Cricket match tonight 🏏', bg: 'gradient-primary', time: '8h ago' },
      { id: 'story-009-2', type: 'text', content: 'Weekend plans sorted!', bg: 'gradient-cyan', time: '10h ago' },
    ],
  },
  {
    id: 'status-010',
    name: 'Ananya Iyer',
    avatar: 'AI',
    color: 'gradient-cyan',
    updates: 1,
    seen: false,
    time: '10h ago',
    views: 41,
    stories: [
      { id: 'story-010-1', type: 'text', content: 'Dance practice 💃', bg: 'gradient-cyan', time: '10h ago' },
    ],
  },
];

export default function StatusGrid() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContact, setViewerContact] = useState<typeof STATUS_CONTACTS[0] | null>(null);

  const unseen = STATUS_CONTACTS.filter(c => !c.seen);
  const seen = STATUS_CONTACTS.filter(c => c.seen);

  const openViewer = (contact: typeof STATUS_CONTACTS[0]) => {
    setViewerContact(contact);
    setViewerOpen(true);
  };

  return (
    <div className="px-4 lg:px-8 pb-8">
      {/* Recent Updates */}
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
  contact: typeof STATUS_CONTACTS[0];
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
        <div className={`w-14 h-14 ${contact.color} rounded-full flex items-center justify-center text-white font-bold text-base border-2 border-background`}>
          {contact.avatar}
        </div>
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