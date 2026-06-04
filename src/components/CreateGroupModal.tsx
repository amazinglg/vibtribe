// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { X, Users, Search, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (chatId: string) => void;
}

interface UserRow {
  id: string;
  full_name: string;
  mobile_number?: string;
}

export default function CreateGroupModal({ isOpen, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, mobile_number')
        .neq('id', user.id)
        .limit(100);
      setUsers(data || []);
    })();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (u.full_name || '').toLowerCase().includes(q) || (u.mobile_number || '').includes(q);
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) { setError('Group name is required'); return; }
    if (selected.size < 1) { setError('Add at least one member'); return; }
    if (!user) return;
    setCreating(true);
    try {
      const { data: chat, error: chatErr } = await supabase
        .from('chats')
        .insert({
          is_group: true,
          name: name.trim(),
          chat_type: 'normal',
          created_by: user.id,
          participant_one: user.id,
          disappear_mode: '24h',
        })
        .select()
        .single();
      if (chatErr || !chat) throw chatErr;

      const members = [user.id, ...Array.from(selected)].map(uid => ({
        chat_id: chat.id,
        user_id: uid,
      }));
      const { error: memErr } = await supabase.from('chat_members').insert(members);
      if (memErr) throw memErr;

      onCreated?.(chat.id);
      onClose();
      setName('');
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.message || 'Failed to create tribe');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-2xl border border-border shadow-card overflow-hidden float-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center"><Users size={16} className="text-white" /></div>
            <h2 className="font-bold text-foreground">New Tribe</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tribe name"
            className="bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="text-[11px] text-muted-foreground">{selected.size} selected</div>
          <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
            {filtered.map(u => {
              const checked = selected.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted'}`}
                >
                  <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {(u.full_name || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">{u.full_name || 'Unknown'}</p>
                    {u.mobile_number && <p className="text-[11px] text-muted-foreground">{u.mobile_number}</p>}
                  </div>
                  {checked && <Check size={16} className="text-primary" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No contacts found</p>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            disabled={creating}
            onClick={handleCreate}
            className="mt-2 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Tribe'}
          </button>
        </div>
      </div>
    </div>
  );
}