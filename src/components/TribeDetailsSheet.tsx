// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { X, Users, Lock, Globe, Copy, Trash2, UserPlus, Crown, LogOut, AtSign, Edit2, Link as LinkIcon, RefreshCw, Check, ShieldX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onLeft?: () => void;
}

interface Tribe {
  id: string;
  name: string | null;
  handle: string | null;
  privacy: 'public' | 'private';
  description: string | null;
  avatar_url: string | null;
  created_at: string;
  created_by: string;
}

interface Member {
  user_id: string;
  role: 'leader' | 'member';
  full_name: string;
  avatar_url: string | null;
}

interface InviteRow {
  id: string;
  code: string;
  revoked_at: string | null;
}

interface RequestRow {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
}

function randomCode(len = 10) {
  const alpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

export default function TribeDetailsSheet({ chatId, isOpen, onClose, onLeft }: Props) {
  const supabase = createClient();
  const { user } = useAuth();
  const [tribe, setTribe] = useState<Tribe | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [founderName, setFounderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState('');
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleInput, setHandleInput] = useState('');

  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const isLeader = myRole === 'leader' || (tribe && tribe.created_by === user?.id);
  const isFounder = tribe && tribe.created_by === user?.id;

  const load = async () => {
    const { data: t } = await supabase
      .from('chats')
      .select('id, name, handle, privacy, description, avatar_url, created_at, created_by')
      .eq('id', chatId)
      .single();
    if (t) {
      setTribe(t as any);
      setNameInput((t as any).name || '');
      setDescInput((t as any).description || '');
      setHandleInput((t as any).handle || '');
    }
    const { data: ms } = await supabase
      .from('chat_members')
      .select('user_id, role')
      .eq('chat_id', chatId);
    const ids = (ms || []).map((m: any) => m.user_id);
    let profiles: any[] = [];
    if (ids.length) {
      const { data: p } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      profiles = p || [];
    }
    const merged: Member[] = (ms || []).map((m: any) => {
      const p = profiles.find(pp => pp.id === m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        full_name: p?.full_name || 'Unknown',
        avatar_url: p?.avatar_url || null,
      };
    }).sort((a, b) => (a.role === b.role ? 0 : a.role === 'leader' ? -1 : 1));
    setMembers(merged);
    if (t && (t as any).created_by) {
      const f = profiles.find(p => p.id === (t as any).created_by);
      setFounderName(f?.full_name || 'Founder');
    }
    const { data: inv } = await supabase
      .from('tribe_invites')
      .select('id, code, revoked_at')
      .eq('chat_id', chatId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    setInvites((inv as any) || []);
    const { data: rq } = await supabase
      .from('tribe_join_requests')
      .select('id, user_id, status')
      .eq('chat_id', chatId)
      .eq('status', 'pending');
    if (rq && rq.length) {
      const { data: rp } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', rq.map((r: any) => r.user_id));
      setRequests(rq.map((r: any) => {
        const p = (rp || []).find(pp => pp.id === r.user_id);
        return { id: r.id, user_id: r.user_id, status: r.status, full_name: p?.full_name || 'Someone', avatar_url: p?.avatar_url || null };
      }));
    } else setRequests([]);
  };

  useEffect(() => { if (isOpen && chatId) load(); }, [isOpen, chatId]);

  if (!isOpen || !tribe) return null;

  const saveName = async () => {
    const n = nameInput.trim();
    if (!n) return;
    const { error } = await supabase.from('chats').update({ name: n }).eq('id', chatId);
    if (error) toast.error(error.message); else { toast.success('Tribe name updated'); setEditingName(false); load(); }
  };
  const saveDesc = async () => {
    const { error } = await supabase.from('chats').update({ description: descInput }).eq('id', chatId);
    if (error) toast.error(error.message); else { toast.success('Description updated'); setEditingDesc(false); load(); }
  };
  const saveHandle = async () => {
    const h = handleInput.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,30}$/.test(h)) { toast.error('Handle: 3-30 chars, lowercase letters/numbers/_'); return; }
    const { error } = await supabase.rpc('tribe_set_handle', { _chat_id: chatId, _handle: h });
    if (error) toast.error(error.message); else { toast.success('Handle set (permanent)'); setEditingHandle(false); load(); }
  };
  const togglePrivacy = async () => {
    const next = tribe.privacy === 'public' ? 'private' : 'public';
    if (!confirm(`Switch tribe to ${next}? ${next === 'public' ? 'Anyone can join without approval. Pending requests will be auto-approved.' : 'New members will need an invite or to request to join.'}`)) return;
    const { error } = await supabase.rpc('tribe_change_privacy', { _chat_id: chatId, _privacy: next });
    if (error) toast.error(error.message); else { toast.success(`Now ${next}`); load(); }
  };
  const generateInvite = async () => {
    setBusy(true);
    try {
      const code = randomCode(10);
      const { error } = await supabase.from('tribe_invites').insert({ chat_id: chatId, code, created_by: user!.id });
      if (error) throw error;
      toast.success('Invite link generated');
      load();
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
  };
  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from('tribe_invites').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Invite revoked'); load(); }
  };
  const copyInvite = (code: string) => {
    const url = `${window.location.origin}/tribe/join/${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  };
  const promote = async (uid: string) => {
    const { error } = await supabase.rpc('tribe_promote_member', { _chat_id: chatId, _user_id: uid });
    if (error) toast.error(error.message); else { toast.success('Promoted to Tribe Leader'); load(); }
  };
  const demote = async (uid: string) => {
    const { error } = await supabase.rpc('tribe_demote_member', { _chat_id: chatId, _user_id: uid });
    if (error) toast.error(error.message); else { toast.success('Demoted'); load(); }
  };
  const removeMember = async (uid: string) => {
    if (!confirm('Remove this member?')) return;
    const { error } = await supabase.rpc('tribe_remove_member', { _chat_id: chatId, _user_id: uid });
    if (error) toast.error(error.message); else { toast.success('Removed'); load(); }
  };
  const leaveTribe = async () => {
    if (!confirm('Leave this tribe?')) return;
    const { error } = await supabase.rpc('tribe_leave', { _chat_id: chatId });
    if (error) toast.error(error.message); else { toast.success('Left tribe'); onLeft?.(); onClose(); }
  };
  const decideRequest = async (rid: string, approve: boolean) => {
    const { error } = await supabase.rpc('tribe_decide_request', { _request_id: rid, _approve: approve });
    if (error) toast.error(error.message); else { toast.success(approve ? 'Approved' : 'Declined'); load(); }
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-background border-l border-border h-full overflow-y-auto float-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">Tribe info</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>

        <div className="p-4 flex flex-col items-center gap-3 border-b border-border">
          {tribe.avatar_url ? (
            <img src={tribe.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-24 h-24 gradient-primary rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {(tribe.name || 'T')[0]?.toUpperCase()}
            </div>
          )}
          {editingName && isLeader ? (
            <div className="flex gap-1 w-full">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} className="flex-1 px-2 py-1 bg-input border border-border rounded-lg text-sm text-foreground" />
              <button onClick={saveName} className="px-2 py-1 bg-primary text-white rounded-lg text-xs">Save</button>
              <button onClick={() => setEditingName(false)} className="px-2 py-1 bg-muted rounded-lg text-xs">×</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{tribe.name || 'Tribe'}</h3>
              {isLeader && <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>}
            </div>
          )}

          {/* Handle */}
          {editingHandle && isLeader ? (
            <div className="flex gap-1 w-full">
              <input value={handleInput} onChange={e => setHandleInput(e.target.value)} placeholder="tribehandle" className="flex-1 px-2 py-1 bg-input border border-border rounded-lg text-sm text-foreground" />
              <button onClick={saveHandle} className="px-2 py-1 bg-primary text-white rounded-lg text-xs">Save</button>
              <button onClick={() => setEditingHandle(false)} className="px-2 py-1 bg-muted rounded-lg text-xs">×</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AtSign size={12} />
              <span>{tribe.handle || (isLeader ? 'Set a permanent handle' : 'no handle')}</span>
              {isLeader && !tribe.handle && (
                <button onClick={() => setEditingHandle(true)} className="ml-1 text-primary text-xs">Set</button>
              )}
            </div>
          )}

          {/* Privacy */}
          <button
            disabled={!isLeader}
            onClick={togglePrivacy}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${tribe.privacy === 'public' ? 'bg-vt-green/10 text-vt-green' : 'bg-muted text-foreground'} ${isLeader ? 'hover:opacity-80' : 'cursor-default'}`}
          >
            {tribe.privacy === 'public' ? <Globe size={12} /> : <Lock size={12} />}
            {tribe.privacy === 'public' ? 'Public tribe' : 'Private tribe'}
          </button>

          <div className="text-[11px] text-muted-foreground text-center">
            Created {new Date(tribe.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} by Tribe Leader {founderName}
          </div>
        </div>

        {/* Description */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Description</p>
            {isLeader && !editingDesc && <button onClick={() => setEditingDesc(true)} className="text-muted-foreground hover:text-foreground"><Edit2 size={12} /></button>}
          </div>
          {editingDesc && isLeader ? (
            <div className="flex flex-col gap-2">
              <textarea value={descInput} onChange={e => setDescInput(e.target.value)} rows={3} className="w-full bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-foreground" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingDesc(false)} className="px-2 py-1 bg-muted text-xs rounded-lg">Cancel</button>
                <button onClick={saveDesc} className="px-2 py-1 bg-primary text-white text-xs rounded-lg">Save</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{tribe.description || <span className="text-muted-foreground italic">No description</span>}</p>
          )}
        </div>

        {/* Invite */}
        {isLeader && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Invite link</p>
            {invites.length === 0 ? (
              <button onClick={generateInvite} disabled={busy} className="w-full flex items-center justify-center gap-2 py-2 gradient-primary rounded-xl text-white text-sm font-semibold">
                <LinkIcon size={14} /> Generate invite link
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-2 py-2 bg-input border border-border rounded-lg text-xs text-muted-foreground truncate">
                  {window.location.origin}/tribe/join/{invites[0].code}
                </div>
                <button onClick={() => copyInvite(invites[0].code)} className="p-2 bg-primary text-white rounded-lg" title="Copy"><Copy size={14} /></button>
                <button onClick={() => revokeInvite(invites[0].id)} className="p-2 bg-muted rounded-lg text-red-400" title="Revoke"><RefreshCw size={14} /></button>
              </div>
            )}
          </div>
        )}

        {/* Join requests */}
        {isLeader && requests.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Pending join requests</p>
            <div className="flex flex-col gap-2">
              {requests.map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  {r.avatar_url ? <img src={r.avatar_url} className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-xs font-bold">{r.full_name[0]?.toUpperCase()}</div>}
                  <span className="flex-1 text-sm text-foreground truncate">{r.full_name}</span>
                  <button onClick={() => decideRequest(r.id, true)} className="p-1.5 bg-vt-green/20 text-vt-green rounded-lg"><Check size={14} /></button>
                  <button onClick={() => decideRequest(r.id, false)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Users size={12} /> {members.length} member{members.length === 1 ? '' : 's'}</p>
          <div className="flex flex-col gap-1">
            {members.map(m => {
              const isMeRow = m.user_id === user?.id;
              const memberIsFounder = m.user_id === tribe.created_by;
              return (
                <div key={m.user_id} className="flex items-center gap-2 py-1.5">
                  {m.avatar_url ? <img src={m.avatar_url} className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold">{m.full_name[0]?.toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate flex items-center gap-1.5">{m.full_name}{isMeRow && <span className="text-[10px] text-muted-foreground">(you)</span>}</p>
                    {m.role === 'leader' && <p className="text-[10px] text-primary flex items-center gap-1"><Crown size={10} /> Tribe Leader{memberIsFounder ? ' · Founder' : ''}</p>}
                  </div>
                  {isLeader && !isMeRow && !memberIsFounder && (
                    <div className="flex items-center gap-1">
                      {m.role === 'member' ? (
                        <button onClick={() => promote(m.user_id)} className="p-1.5 bg-muted rounded-lg text-foreground" title="Promote to Leader"><Crown size={12} /></button>
                      ) : (
                        <button onClick={() => demote(m.user_id)} className="p-1.5 bg-muted rounded-lg text-foreground" title="Demote"><ShieldX size={12} /></button>
                      )}
                      <button onClick={() => removeMember(m.user_id)} className="p-1.5 bg-red-500/15 rounded-lg text-red-400" title="Remove"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave */}
        {!isFounder && (
          <div className="p-4">
            <button onClick={leaveTribe} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/15 text-red-400 rounded-xl text-sm font-semibold">
              <LogOut size={14} /> Leave tribe
            </button>
          </div>
        )}
        {isFounder && (
          <div className="p-4 text-center text-[11px] text-muted-foreground">
            As the founder, you cannot leave. Delete the tribe to disband it.
          </div>
        )}
      </div>
    </div>
  );
}