import React, { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, Lock, Globe } from 'lucide-react';

export const Route = createFileRoute('/tribe/join/$code')({
  component: TribeJoinPage,
  head: () => ({
    meta: [
      { title: 'Join a Tribe — VibTribe' },
      { name: 'description', content: 'You have been invited to join a Tribe on VibTribe.' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
});

function TribeJoinPage() {
  const { code } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = createClient();
  const [tribe, setTribe] = useState<{ id: string; name: string | null; handle: string | null; privacy: string; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: inv } = await supabase
          .from('tribe_invites')
          .select('chat_id, revoked_at, expires_at')
          .eq('code', code)
          .maybeSingle();
        if (!inv || (inv as any).revoked_at) { setNotFound(true); return; }
        const { data: c } = await supabase
          .from('chats')
          .select('id, name, handle, privacy, avatar_url')
          .eq('id', (inv as any).chat_id)
          .maybeSingle();
        if (!c) { setNotFound(true); return; }
        setTribe(c as any);
      } finally { setLoading(false); }
    })();
  }, [code]);

  const join = async () => {
    if (!user) { navigate({ to: '/sign-in', search: { redirect: `/tribe/join/${code}` } as any }); return; }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('tribe_join_via_invite', { _code: code });
      if (error) throw error;
      toast.success('Joined tribe');
      navigate({ to: '/' });
    } catch (e: any) { toast.error(e?.message || 'Could not join'); } finally { setJoining(false); }
  };

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3">
      <h1 className="text-xl font-bold text-foreground">Invite not found</h1>
      <p className="text-sm text-muted-foreground">This invite link is invalid, expired, or has been revoked.</p>
      <Link to="/" className="mt-2 px-4 py-2 gradient-primary rounded-xl text-white text-sm font-semibold">Back home</Link>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full glass-strong border border-border rounded-2xl p-6 text-center flex flex-col items-center gap-4">
        {tribe?.avatar_url ? (
          <img src={tribe.avatar_url} className="w-24 h-24 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-24 h-24 gradient-primary rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {(tribe?.name || 'T')[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">{tribe?.name || 'Tribe'}</h1>
          {tribe?.handle && <p className="text-sm text-muted-foreground">@{tribe.handle}</p>}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full text-xs text-foreground">
          {tribe?.privacy === 'public' ? <Globe size={12} /> : <Lock size={12} />}
          {tribe?.privacy === 'public' ? 'Public tribe' : 'Private tribe'}
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Users size={14} /> You're invited to join</p>
        <div className="flex flex-col gap-2 w-full">
          <button onClick={join} disabled={joining} className="w-full py-2.5 gradient-primary rounded-xl text-white font-semibold disabled:opacity-50">
            {joining ? 'Joining…' : user ? 'Join Tribe' : 'Sign in to join'}
          </button>
          <Link to="/" className="w-full py-2 text-sm text-muted-foreground hover:text-foreground text-center">Ignore</Link>
        </div>
      </div>
    </div>
  );
}