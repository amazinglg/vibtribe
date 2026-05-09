import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import AppLayout from '@/components/AppLayout';
import ChatListPanel from './components/ChatListPanel';
import ChatWindowPanel from './components/ChatWindowPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/store/chatStore';

export default function ChatsPage() {
  const { user, loading } = useAuth();
  const router = useNavigate();
  const { selectedChatId, setSelectedChatId } = useChatStore();

  // Always start on the chat list (right panel blank) when entering Home
  useEffect(() => {
    setSelectedChatId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('[VT-HOME] state', { loading, hasUser: !!user });
    if (!loading && !user) {
      console.warn('[VT-HOME] no user — redirecting to /sign-in');
      router?.({ to: '/sign-in', replace: true });
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
      <div className="gradient-bg-page h-[calc(100vh-64px)] flex overflow-hidden pb-16 lg:pb-0 w-full max-w-full">
        <div className={`${selectedChatId ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto flex-shrink-0 min-w-0`}>
          <ChatListPanel />
        </div>
        <div className={`${selectedChatId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          <ChatWindowPanel />
        </div>
      </div>
    </AppLayout>
  );
}