import React, { useEffect } from 'react';
import { useNavigate as _useNavigate } from '@tanstack/react-router';
import AppLayout from '@/components/AppLayout';
import ChatListPanel from './components/ChatListPanel';
import ChatWindowPanel from './components/ChatWindowPanel';
import { useAuth } from '@/contexts/AuthContext';

function useRouter() {
  const navigate = _useNavigate();
  return {
    push: (to: string) => navigate({ to: to as any }),
    replace: (to: string) => navigate({ to: to as any, replace: true }),
    back: () => { if (typeof window !== 'undefined') window.history.back(); },
    refresh: () => {},
  };
}


export default function ChatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router?.replace('/sign-in');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="gradient-bg-page min-h-screen flex items-center justify-center">
        <div className="text-center float-up">
          <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 glow-primary animate-pulse">
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-muted-foreground text-sm">Loading VibeTribe...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="gradient-bg-page h-[calc(100vh-64px)] flex overflow-hidden pb-16 lg:pb-0">
        <ChatListPanel />
        <ChatWindowPanel />
      </div>
    </AppLayout>
  );
}