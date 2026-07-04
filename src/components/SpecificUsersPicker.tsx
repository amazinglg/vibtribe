// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Contact = { id: string; name: string; avatar_url?: string | null };

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  ownerId: string;
  initialSelected: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void> | void;
}

export default function SpecificUsersPicker({
  open, title = 'Select specific users', description, ownerId, initialSelected, onClose, onSave,
}: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setSelected(new Set(initialSelected)); }, [initialSelected, open]);

  useEffect(() => {
    if (!open || !ownerId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: saved } = await supabase
          .from('contacts')
          .select('contact_id, contact_name')
          .eq('user_id', ownerId);
        const ids = [...new Set((saved || []).map((s: any) => s.contact_id).filter(Boolean))];
        if (ids.length === 0) { setContacts([]); return; }
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', ids);
        const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const list: Contact[] = (saved || []).map((s: any) => ({
          id: s.contact_id,
          name: s.contact_name || pMap.get(s.contact_id)?.full_name || 'Contact',
          avatar_url: pMap.get(s.contact_id)?.avatar_url,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setContacts(list);
      } finally { setLoading(false); }
    })();
  }, [open, ownerId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? contacts.filter(c => c.name.toLowerCase().includes(s)) : contacts;
  }, [q, contacts]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave([...selected]);
      onClose();
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl glass border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
            {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your contacts"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {selected.size} selected {contacts.length ? `· ${contacts.length} contacts` : ''}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading contacts…</p>
          ) : contacts.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              You don't have any saved contacts yet. Add contacts first to select specific users.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No contacts match "{q}".</p>
          ) : filtered.map(c => {
            const isSel = selected.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors ${isSel ? 'bg-primary/5' : ''}`}
              >
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full gradient-primary text-white text-sm font-bold flex items-center justify-center">
                    {c.name[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="flex-1 min-w-0 text-sm text-foreground truncate">{c.name}</span>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSel ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                  {isSel && <Check size={12} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl hover:bg-muted">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-xl gradient-primary text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}