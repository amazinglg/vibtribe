// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Users, Phone, UserPlus, MessageSquare, X, Share2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/LanguageContext';

interface Contact {
  name: string;
  phone: string;
  onPlatform: boolean;
  userId?: string;
  avatar?: string;
  avatarUrl?: string | null;
}

interface ContactsPanelProps {
  onClose: () => void;
  onStartChat?: (userId: string, name: string) => void;
}

const getPlatformUrl = () =>
  typeof window !== 'undefined' ? window.location.origin : 'https://vibtribe.in';
const getInviteMsg = () =>
  `Hey! I'm using VibTribe — a secure messaging app. Join me here: ${getPlatformUrl()}/sign-up 🚀`;

export default function ContactsPanel({ onClose, onStartChat }: ContactsPanelProps) {
  const { t } = useT();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [loading, setLoading] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Contact | null>(null);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const supabase = createClient();

  const requestContacts = async () => {
    setPermissionState('requesting');
    try {
      // Use Contacts API if available (Android Chrome)
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const rawContacts = await (navigator as any).contacts.select(props, opts);
        setPermissionState('granted');
        await matchContactsWithPlatform(rawContacts);
      } else {
        // Fallback: show manual entry or demo contacts
        setPermissionState('granted');
        await loadDemoContacts();
      }
    } catch (err: any) {
      if (err?.name === 'SecurityError' || err?.name === 'NotAllowedError') {
        setPermissionState('denied');
      } else {
        // API not supported — show demo
        setPermissionState('granted');
        await loadDemoContacts();
      }
    }
  };

  // Always load the saved contacts from the user's account once the panel opens
  // so that anyone added via "Add to contacts" from a chat appears here too.
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const { data: saved, error } = await supabase
          .from('contacts')
          .select('contact_id, contact_name, created_at')
          .eq('user_id', user.id);
        if (error) throw error;
        const ids = [...new Set((saved || []).map((s: any) => s.contact_id).filter(Boolean))];
        const profileMap = new Map<string, any>();
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, full_name, mobile_number, avatar_url, profile_photo_visibility')
            .in('id', ids);
          for (const p of (profiles || [])) profileMap.set(p.id, p);
        }
        const savedContacts: Contact[] = (saved || []).map((s: any) => ({
          name: s.contact_name || profileMap.get(s.contact_id)?.full_name || 'Saved contact',
          phone: profileMap.get(s.contact_id)?.mobile_number || '',
          onPlatform: true,
          userId: s.contact_id,
          avatar: (s.contact_name || profileMap.get(s.contact_id)?.full_name || '?')[0]?.toUpperCase(),
          avatarUrl: (profileMap.get(s.contact_id)?.profile_photo_visibility ?? 'all') === 'all' ? (profileMap.get(s.contact_id)?.avatar_url || null) : null,
        }));
        if (savedContacts.length > 0) {
          setPermissionState('granted');
          setContacts(prev => {
            const byId = new Map<string, Contact>();
            for (const c of [...savedContacts, ...prev]) {
              const key = c.userId || c.phone;
              if (!byId.has(key)) byId.set(key, c);
            }
            return Array.from(byId.values());
          });
        }
      } catch { /* silent */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const matchContactsWithPlatform = async (rawContacts: any[]) => {
    setLoading(true);
    // Normalise. Each raw contact may have multiple numbers — keep them all but tied to one display name.
    const normalized: { name: string; phone: string }[] = [];
    for (const c of rawContacts) {
      const name = Array.isArray(c.name) ? c.name[0] : c.name || 'Unknown';
      const phones: string[] = Array.isArray(c.tel) ? c.tel : [c.tel].filter(Boolean);
      // Dedupe phones within the same contact card (a contact may list home+mobile that resolve to the same digits)
      const seenForContact = new Set<string>();
      for (const phone of phones) {
        const clean = phone.replace(/\D/g, '');
        if (clean.length < 7 || seenForContact.has(clean)) continue;
        seenForContact.add(clean);
        normalized.push({ name, phone: clean });
      }
    }

    // Match against platform users — also try last-10-digit match (handles country-code mismatches like +91)
    const allPhones = normalized.map(c => c.phone);
    const { data: platformUsers } = await supabase
      .from('user_profiles')
      .select('id, full_name, mobile_number, avatar_url, profile_photo_visibility')
      .or(allPhones.length ? allPhones.map(p => `mobile_number.ilike.%${p.slice(-10)}%`).join(',') : 'id.eq.00000000-0000-0000-0000-000000000000');

    const platformByLast10 = new Map<string, any>();
    for (const u of (platformUsers || [])) {
      const digits = (u.mobile_number || '').replace(/\D/g, '');
      if (digits.length >= 10) platformByLast10.set(digits.slice(-10), u);
    }

    // Build cards: one per unique person. Prefer matched platform user; otherwise unique by phone.
    const platformSeen = new Set<string>();
    const phoneSeen = new Set<string>();
    const result: Contact[] = [];
    for (const c of normalized) {
      const match = platformByLast10.get(c.phone.slice(-10));
      if (match) {
        if (platformSeen.has(match.id)) continue;
        platformSeen.add(match.id);
        result.push({
          name: c.name,
          phone: c.phone,
          onPlatform: true,
          userId: match.id,
          avatar: match.full_name?.[0]?.toUpperCase(),
          avatarUrl: (match.profile_photo_visibility ?? 'all') === 'all' ? (match.avatar_url || null) : null,
        });
      } else {
        if (phoneSeen.has(c.phone)) continue;
        phoneSeen.add(c.phone);
        result.push({ name: c.name, phone: c.phone, onPlatform: false });
      }
    }

    setContacts(result);
    setLoading(false);
  };

  const loadDemoContacts = async () => {
    setLoading(true);
    // Load actual platform users as "contacts"
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, full_name, mobile_number, avatar_url, profile_photo_visibility')
      .neq('id', user?.id || '')
      .limit(20);

    const result: Contact[] = (users || []).map(u => ({
      name: u.full_name || 'Unknown',
      phone: u.mobile_number || '',
      onPlatform: true,
      userId: u.id,
      avatar: u.full_name?.[0]?.toUpperCase(),
      avatarUrl: (u.profile_photo_visibility ?? 'all') === 'all' ? (u.avatar_url || null) : null,
    }));

    // Add some demo non-platform contacts
    result.push(
      { name: 'Rahul Sharma', phone: '9876543210', onPlatform: false },
      { name: 'Priya Patel', phone: '9123456789', onPlatform: false },
    );

    setContacts(result);
    setLoading(false);
  };

  const handleStartChat = async (contact: Contact) => {
    if (!contact.userId || !user) return;
    // Check if chat already exists
    const { data: existing } = await supabase
      .from('chats')
      .select('id')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${contact.userId}),and(participant_one.eq.${contact.userId},participant_two.eq.${user.id})`)
      .single();

    if (existing) {
      onStartChat?.(existing.id, contact.name);
    } else {
      const { data: newChat } = await supabase
        .from('chats')
        .insert({ participant_one: user.id, participant_two: contact.userId, chat_type: 'normal' })
        .select()
        .single();
      if (newChat) onStartChat?.(newChat.id, contact.name);
    }
    onClose();
  };

  const handleInviteWhatsApp = (contact: Contact) => {
    const phone = contact.phone.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(getInviteMsg())}`;
    window.open(url, '_blank');
    setInviteTarget(null);
  };

  const handleInviteSMS = (contact: Contact) => {
    const url = `sms:${contact.phone}?body=${encodeURIComponent(getInviteMsg())}`;
    window.location.href = url;
    setInviteTarget(null);
  };

  const handleInviteCopy = async () => {
    await navigator.clipboard.writeText(getInviteMsg());
    setInviteTarget(null);
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const platformContacts = filtered.filter(c => c.onPlatform);
  const nonPlatformContacts = filtered.filter(c => !c.onPlatform);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 sm:pb-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md glass-strong rounded-3xl border border-border shadow-card overflow-hidden float-up max-h-[calc(100dvh-7rem)] sm:max-h-[85vh] flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Contacts</h2>
              <p className="text-xs text-muted-foreground">Find friends on VibTribe</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {permissionState === 'idle' && (
            <div className="p-6 text-center">
              <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 glow-primary">
                <Phone size={28} className="text-white" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">Find Your Contacts</h3>
              <p className="text-sm text-muted-foreground mb-3">
                VibTribe needs access to your contacts to find your friends on the platform and let you invite the rest.
              </p>
              <p className="text-[11px] text-muted-foreground/80 mb-6 leading-relaxed">
                Note: Web apps can only read contacts you tap to select in the picker — your browser will not allow a one-tap "all contacts" import. To pick everyone, tap the contact list header in the picker (Android Chrome supports this). For a true single-tap import we'd need a native app build.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={requestContacts}
                  className="w-full gradient-primary text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all glow-primary"
                >
                  Allow access to all contacts
                </button>
                <button
                  onClick={() => setPermissionState('denied')}
                  className="w-full py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          {permissionState === 'requesting' && (
            <div className="p-6 text-center">
              <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Phone size={22} className="text-white" />
              </div>
              <p className="text-sm text-muted-foreground">Requesting contact access...</p>
            </div>
          )}

          {permissionState === 'denied' && (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <X size={22} className="text-red-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Access Denied</h3>
              <p className="text-sm text-muted-foreground mb-4">Contact access was denied. To find friends on VibTribe, allow contact access from your browser/app settings, or use the global search to add people by username or phone.</p>
              <button
                onClick={onClose}
                className="gradient-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
              >
                Close
              </button>
            </div>
          )}

          {(permissionState === 'granted') && (
            <div className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-4 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-muted" />
                      <div className="flex-1">
                        <div className="h-3 bg-muted rounded w-24 mb-1.5" />
                        <div className="h-2 bg-muted rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* On Platform */}
                  {platformContacts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                        On VibTribe ({platformContacts.length})
                      </p>
                      <div className="space-y-2">
                        {platformContacts.map((c, i) => (
                          <div key={`platform-${i}`} className="flex items-center gap-3 p-3 glass rounded-xl border border-border hover:border-primary/30 transition-all">
                            {c.avatarUrl ? (
                              <img
                                src={c.avatarUrl}
                                alt={c.name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {c.avatar || c.name[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Check size={10} className="text-vt-green" />
                                <span className="text-[11px] text-vt-green font-medium">On VibTribe</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleStartChat(c)}
                              className="p-2 gradient-primary rounded-xl text-white hover:opacity-90 transition-all"
                              title="Start Chat"
                            >
                              <MessageSquare size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not on Platform */}
                  {nonPlatformContacts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                        Invite to VibTribe ({nonPlatformContacts.length})
                      </p>
                      <div className="space-y-2">
                        {nonPlatformContacts.map((c, i) => (
                          <div key={`invite-${i}`} className="flex items-center gap-3 p-3 glass rounded-xl border border-border transition-all">
                            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-bold text-sm flex-shrink-0">
                              {c.name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground">Not on VibTribe yet</p>
                            </div>
                            <button
                              onClick={() => setInviteTarget(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                            >
                              <UserPlus size={12} />
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filtered.length === 0 && (
                    <div className="text-center py-8">
                      <Users size={32} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No contacts found</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Options Modal */}
      {inviteTarget && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-strong rounded-3xl border border-border shadow-card overflow-hidden float-up">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-foreground">Invite {inviteTarget.name}</h3>
                <p className="text-xs text-muted-foreground">Choose how to invite</p>
              </div>
              <button onClick={() => setInviteTarget(null)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Pre-draft message preview */}
            <div className="mx-4 mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Message Preview</p>
              <p className="text-xs text-foreground leading-relaxed">{getInviteMsg()}</p>
            </div>

            <div className="p-4 space-y-2">
              <button
                onClick={() => handleInviteWhatsApp(inviteTarget)}
                className="w-full flex items-center gap-3 p-3.5 glass rounded-xl border border-border hover:border-green-500/40 hover:bg-green-500/5 transition-all"
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">💬</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Send via WhatsApp message</p>
                </div>
              </button>

              <button
                onClick={() => handleInviteSMS(inviteTarget)}
                className="w-full flex items-center gap-3 p-3.5 glass rounded-xl border border-border hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={20} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">SMS / Text Message</p>
                  <p className="text-xs text-muted-foreground">Send via regular text message</p>
                </div>
              </button>

              <button
                onClick={handleInviteCopy}
                className="w-full flex items-center gap-3 p-3.5 glass rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Share2 size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Copy Link</p>
                  <p className="text-xs text-muted-foreground">Copy invite message to clipboard</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
