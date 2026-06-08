// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Type, Sparkles, Globe, Users, UserCheck, ChevronDown, X, Send, Trash2, Pencil, Check, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StatusViewer from './StatusViewer';
import { useT } from '@/contexts/LanguageContext';

type VisibilityOption = 'all' | 'contacts' | 'selected';

const VISIBILITY_OPTIONS: { value: VisibilityOption; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All Users', desc: 'Everyone on VibTribe', icon: Globe },
  { value: 'contacts', label: 'My Contacts', desc: 'Only people in your contacts', icon: Users },
  { value: 'selected', label: 'Specific Contacts', desc: 'Choose specific people', icon: UserCheck },
];

export default function StatusHero() {
  const { t } = useT();
  const [uploading, setUploading] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityOption>('all');
  const [textPrompt, setTextPrompt] = useState<null | string>(null);
  const [textValue, setTextValue] = useState('');
  const { profile, user } = useAuth();
  // Media compose modal (preview + caption)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  // My status viewer
  const [myViewerOpen, setMyViewerOpen] = useState(false);
  const [myStatuses, setMyStatuses] = useState<any[]>([]);
  // Selected viewers picker
  const [selectedViewers, setSelectedViewers] = useState<string[]>([]);
  const [viewerPickerOpen, setViewerPickerOpen] = useState(false);
  const [contactsList, setContactsList] = useState<{ id: string; name: string; avatar_url?: string | null }[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  const displayName = profile?.full_name || 'You';
  const avatarLetter = displayName[0]?.toUpperCase() || 'V';

  const loadMyStatuses = useCallback(async () => {
    if (!user?.id) return [];
    try { await supabase.rpc('cleanup_expired_statuses'); } catch {}
    const { data } = await supabase
      .from('statuses')
      .select('id, content, media_url, media_type, background_color, created_at, expires_at, view_count')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    const rows = data || [];
    setMyStatuses(rows);
    return rows;
  }, [user?.id]);

  // Load persisted visibility preference
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_profiles').select('status_visibility').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.status_visibility) setVisibility(data.status_visibility as VisibilityOption); });
    // Load latest selected_viewers list from most recent status
    supabase.from('statuses').select('selected_viewers').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (Array.isArray(data?.selected_viewers)) setSelectedViewers(data.selected_viewers); });
    loadMyStatuses();
  }, [user?.id, loadMyStatuses]);

  const loadContacts = useCallback(async () => {
    if (!user?.id) return;
    const { data: saved } = await supabase.from('contacts').select('contact_id, contact_name').eq('user_id', user.id);
    const ids = [...new Set((saved || []).map((s: any) => s.contact_id).filter(Boolean))];
    if (ids.length === 0) { setContactsList([]); return; }
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', ids);
    const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    setContactsList((saved || []).map((s: any) => ({
      id: s.contact_id,
      name: s.contact_name || pMap.get(s.contact_id)?.full_name || 'Contact',
      avatar_url: pMap.get(s.contact_id)?.avatar_url,
    })));
  }, [user?.id]);

  const persistVisibility = async (next: VisibilityOption) => {
    setShowVisibility(false);
    if (next === 'selected') {
      await loadContacts();
      setViewerPickerOpen(true);
    }
    setVisibility(next);
    if (!user?.id) return;
    try { await supabase.from('user_profiles').update({ status_visibility: next }).eq('id', user.id); } catch {}
  };

  const insertStatus = async (row: { content?: string; media_url?: string; media_type: string; background_color?: string }) => {
    if (!user?.id) return;
    if (visibility === 'selected' && selectedViewers.length === 0) {
      throw new Error('Please pick at least one contact for "Specific Contacts" visibility.');
    }
    const { error } = await supabase.from('statuses').insert({
      user_id: user.id,
      visibility,
      selected_viewers: visibility === 'selected' ? selectedViewers : [],
      ...row,
    });
    if (error) { console.error('status insert', error); throw error; }
  };

  const statusStoragePath = (url?: string | null) => {
    if (!url) return null;
    const marker = '/status-media/';
    const idx = url.indexOf(marker);
    return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length).split('?')[0]) : null;
  };

  const deleteStatus = async (status: any) => {
    if (!status?.id || !user?.id) return;
    if (!window.confirm('Delete this status?')) return;
    try {
      const path = statusStoragePath(status.media_url);
      if (path) await supabase.storage.from('status-media').remove([path]).catch(() => {});
      const { error } = await supabase.from('statuses').delete().eq('id', status.id).eq('user_id', user.id);
      if (error) throw error;
      setMyStatuses(prev => prev.filter(s => s.id !== status.id));
    } catch (err: any) {
      alert(err?.message || 'Could not delete status');
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!user?.id) { alert('Please sign in again before posting a status.'); return; }
    // Open preview + caption modal instead of posting immediately
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setMediaCaption('');
  };

  const getMediaExtension = (file: File) => {
    const namedExt = file.name?.split('.').pop()?.toLowerCase();
    if (namedExt && namedExt !== file.name.toLowerCase()) return namedExt;
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif') return 'gif';
    if (file.type === 'video/mp4') return 'mp4';
    if (file.type === 'video/webm') return 'webm';
    return file.type.startsWith('video') ? 'mp4' : 'jpg';
  };

  const handleMediaPost = async () => {
    if (!mediaFile || !user?.id) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${getMediaExtension(mediaFile)}`;
      const { error: upErr } = await supabase.storage.from('status-media').upload(path, mediaFile, {
        contentType: mediaFile.type || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) throw upErr;
      // Store the storage path (not a public URL). Renderers create signed URLs on demand.
      await insertStatus({
        media_url: path,
        media_type: mediaFile.type.startsWith('video') ? 'video' : 'image',
        content: mediaCaption.trim() || undefined,
      });
      await loadMyStatuses();
      setMediaFile(null);
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
      setMediaPreviewUrl(null);
      setMediaCaption('');
    } catch (err: any) {
      console.error(err); alert('Upload failed: ' + (err?.message || 'unknown'));
    } finally { setUploading(false); }
  };

  const closeMediaModal = () => {
    setMediaFile(null);
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaPreviewUrl(null);
    setMediaCaption('');
  };

  const openMyStatuses = async () => {
    if (!user?.id) return;
    const data = await loadMyStatuses();
    if (!data || data.length === 0) { alert("You haven't posted any status in the last 24 hours."); return; }
    setMyViewerOpen(true);
  };

  const handleTextPost = async () => {
    if (!textValue.trim()) { setTextPrompt(null); return; }
    setUploading(true);
    try {
      await insertStatus({ content: textValue.trim(), media_type: 'text', background_color: '#7C3AED' });
      await loadMyStatuses();
      setTextValue(''); setTextPrompt(null);
    } catch (err: any) {
      console.error(err); alert('Status failed: ' + (err?.message || 'unknown'));
    } finally { setUploading(false); }
  };

  const currentVisibility = VISIBILITY_OPTIONS.find(o => o.value === visibility)!;
  const VisibilityIcon = currentVisibility.icon;

  const mediaComposer = mediaFile && mediaPreviewUrl ? createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/95 flex flex-col" onClick={closeMediaModal}>
      <div
        className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closeMediaModal} className="p-2"><X size={20} /></button>
        <span className="text-sm font-medium">{t('status.new')}</span>
        <span className="w-9" />
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {mediaFile.type.startsWith('video') ? (
          <video src={mediaPreviewUrl} controls className="max-h-full max-w-full object-contain" />
        ) : (
          <img src={mediaPreviewUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <div
        className="flex-shrink-0 p-3 flex items-center gap-2 bg-black/80 border-t border-white/10"
        style={{ paddingBottom: 'max(0.75rem, var(--safe-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text" value={mediaCaption} maxLength={200}
          onChange={(e) => setMediaCaption(e.target.value)}
          placeholder={t('status.caption')}
          className="flex-1 px-4 py-2.5 rounded-full bg-white/10 text-white placeholder-white/60 border border-white/20 text-sm focus:outline-none"
        />
        <button onClick={handleMediaPost} disabled={uploading}
          className="relative z-10 p-3 rounded-full gradient-primary text-white disabled:opacity-50 shadow-lg">
          <Send size={18} />
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative px-4 lg:px-8 pt-6 pb-4">
      {/* Subheading */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">Stories disappear after 24 hours</p>
        <div className="px-2.5 py-1 glass rounded-full flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles size={11} className="text-primary" />
          <span>{t('status.active')}</span>
        </div>
      </div>

      {/* My Status Card */}
      <div className="glass rounded-3xl border border-border p-4 sm:p-5 mb-6 card-3d relative">
        {/* Background gradient blob */}
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 gradient-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 gradient-cyan rounded-full blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3 sm:gap-4">
          {/* My Status Ring — tap to view your own statuses */}
          <button onClick={openMyStatuses} className="relative flex-shrink-0 focus:outline-none">
            <div className="status-ring-active p-0.5 rounded-full">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="me"
                     className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-background" />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl border-2 border-background">
                  {avatarLetter}
                </div>
              )}
            </div>
          </button>

          <button onClick={openMyStatuses} className="flex-1 min-w-0 text-left">
            <h3 className="font-bold text-sm sm:text-base text-foreground truncate">{t('status.my')}</h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Tap to view · Add a new story</p>
          </button>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <label className={`relative overflow-hidden gradient-primary text-white px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs hover:opacity-90 transition-all glow-primary ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
              {uploading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : <Camera size={14} />}
              <span>{uploading ? 'Posting...' : 'Photo'}</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFile}
                disabled={uploading}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              onClick={() => setTextPrompt('')}
              disabled={uploading}
              className="px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90 glow-primary"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #ec4899 100%)' }}
            >
              <Type size={14} />
              Text
            </button>
          </div>
        </div>

        {/* Visibility Selector — full width, below */}
        <div className="relative mt-3 pt-3 border-t border-border/40">
          <div className="relative">
              <button
                onClick={() => setShowVisibility(!showVisibility)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 glass rounded-xl border border-border hover:border-primary/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <VisibilityIcon size={13} className="text-primary" />
                  <span className="text-foreground font-medium">Visible to: {currentVisibility.label}</span>
                </div>
                <ChevronDown size={13} className="text-muted-foreground" />
              </button>

              {showVisibility && (
                <>
                  {/* Click-blocking backdrop so taps don't pass through to status cards behind */}
                  <div
                    className="fixed inset-0 z-[95]"
                    onClick={(e) => { e.stopPropagation(); setShowVisibility(false); }}
                  />
                <div className="absolute left-0 right-0 bottom-full mb-1 max-h-[60vh] overflow-y-auto glass-strong rounded-xl border border-border shadow-card py-1 z-[100] float-up"
                     onClick={(e) => e.stopPropagation()}>
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Who can see this status?
                  </p>
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <div key={opt.value} className="flex items-center">
                      <button
                        onClick={() => persistVisibility(opt.value)}
                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors ${
                          visibility === opt.value ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        <Icon size={15} className={visibility === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                        <div className="text-left">
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {opt.value === 'selected' && selectedViewers.length > 0
                              ? `${selectedViewers.length} selected`
                              : opt.desc}
                          </p>
                        </div>
                        {visibility === opt.value && (
                          <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                        )}
                      </button>
                        {opt.value === 'selected' && (
                          <button
                            onClick={async (e) => { e.stopPropagation(); await loadContacts(); setShowVisibility(false); setViewerPickerOpen(true); }}
                            className="px-2 py-2 mr-1 text-primary hover:text-primary/80"
                            title="Edit specific contacts list"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/40 mt-1">
                    Statuses are <strong className="text-vt-amber">not end-to-end encrypted</strong>. Media is auto-deleted from our servers 24 hours after posting.
                  </p>
                </div>
                </>
              )}
          </div>

          {/* Always-visible privacy banner about status retention & encryption */}
          <div className="mt-2 p-2.5 rounded-xl bg-vt-amber/10 border border-vt-amber/30 flex gap-2">
            <Sparkles size={12} className="text-vt-amber flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-vt-amber leading-relaxed">
              <strong>Heads up:</strong> Statuses are <strong>not end-to-end encrypted</strong> (so anyone visible can view the media). We <strong>auto-delete</strong> the file and entry from our servers <strong>24 hours after posting</strong> — nothing is kept after that.
            </p>
          </div>
        </div>

        {/* My uploaded statuses */}
        <div className="relative mt-3 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-foreground">My uploads</p>
            <button onClick={loadMyStatuses} className="text-[11px] text-primary hover:text-primary/80">Refresh</button>
          </div>
          {myStatuses.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No active status uploads.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {myStatuses.map((status) => (
                <div key={status.id} className="relative w-20 h-24 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  <button onClick={() => { setMyViewerOpen(true); }} className="absolute inset-0 text-left">
                    {status.media_type === 'image' && status.media_url ? (
                      <StatusMedia value={status.media_url} kind="image" alt="My status" className="w-full h-full object-cover" />
                    ) : status.media_type === 'video' && status.media_url ? (
                      <StatusMedia value={status.media_url} kind="video" className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <div className="w-full h-full gradient-primary flex items-center justify-center p-2 text-center text-[11px] font-semibold text-white line-clamp-4">
                        {status.content || 'Text status'}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-1 text-[9px] text-white">
                      {Math.max(0, Math.ceil((new Date(status.expires_at).getTime() - Date.now()) / 3600000))}h left
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStatus(status); }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    title="Delete status"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {textPrompt !== null && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={() => setTextPrompt(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground mb-3">{t('status.text')}</h3>
            <textarea autoFocus value={textValue} onChange={(e) => setTextValue(e.target.value)} maxLength={280}
              placeholder={t('status.placeholder')}
              className="w-full h-28 px-3 py-2 rounded-lg bg-muted text-foreground border border-border focus:outline-none focus:border-primary text-sm" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setTextPrompt(null); setTextValue(''); }} className="px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
              <button disabled={uploading || !textValue.trim()} onClick={handleTextPost}
                className="px-3 py-1.5 text-sm rounded-lg gradient-primary text-white disabled:opacity-50">
                {uploading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mediaComposer}

      {viewerPickerOpen && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-end sm:items-center justify-center" onClick={() => setViewerPickerOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Specific contacts</h3>
                <p className="text-[11px] text-muted-foreground">Only selected contacts will see your future statuses</p>
              </div>
              <button onClick={() => setViewerPickerOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted text-foreground text-sm border border-border focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {contactsList.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  No saved contacts yet. Add contacts from a chat first (3-dot menu → Add to contacts).
                </p>
              ) : (
                contactsList
                  .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
                  .map(c => {
                    const checked = selectedViewers.includes(c.id);
                    return (
                      <button key={c.id}
                        onClick={() => setSelectedViewers(prev => checked ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${checked ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-semibold">
                            {c.name[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="flex-1 text-left text-sm text-foreground truncate">{c.name}</span>
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${checked ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                          {checked && <Check size={13} />}
                        </span>
                      </button>
                    );
                  })
              )}
            </div>
            <div className="px-3 py-3 border-t border-border flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{selectedViewers.length} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedViewers([])} className="px-3 py-1.5 text-xs text-muted-foreground">Clear</button>
                <button onClick={() => setViewerPickerOpen(false)}
                        className="px-4 py-1.5 text-xs rounded-lg gradient-primary text-white font-semibold">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {myViewerOpen && myStatuses.length > 0 && (
        <StatusViewer
          contact={{
            id: `status-${user?.id}`,
            name: 'My Status',
            userId: user?.id,
            avatar: avatarLetter,
            avatarUrl: profile?.avatar_url || null,
            color: 'gradient-primary',
            stories: myStatuses.map((s: any) => ({
              id: s.id,
              type: s.media_type || 'text',
              content: s.content || '',
              media_url: s.media_url || null,
              bg: s.background_color ? '' : 'gradient-primary',
              time: new Date(s.created_at).toLocaleString(),
            })),
          }}
          onClose={() => setMyViewerOpen(false)}
        />
      )}
    </div>
  );
}