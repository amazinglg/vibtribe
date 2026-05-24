import React, { useEffect, lazy, Suspense, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import AppLayout from '@/components/AppLayout';
import ChatListPanel from './components/ChatListPanel';
const ChatWindowPanel = lazy(() => import('./components/ChatWindowPanel'));
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/store/chatStore';
import TermsAcceptanceGate from '@/components/TermsAcceptanceGate';

export default function ChatsPage() {
  const { user, loading } = useAuth();
  const router = useNavigate();
  const { selectedChatId, setSelectedChatId } = useChatStore();

  // Open a chat directly when launched from a notification; otherwise start on the list.
  useEffect(() => {
    const chatId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('chat') : null;
    setSelectedChatId(chatId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intercept hardware/browser back button while a chat is open: close it instead of leaving the app.
  const pushedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedChatId) {
      if (!pushedRef.current) {
        window.history.pushState({ vtChatOpen: true }, '');
        pushedRef.current = true;
      }
    } else {
      // Selection cleared via UI — pop our sentinel state so history stays clean.
      if (pushedRef.current && window.history.state?.vtChatOpen) {
        pushedRef.current = false;
        window.history.back();
      } else {
        pushedRef.current = false;
      }
    }
  }, [selectedChatId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      if (useChatStore.getState().selectedChatId) {
        pushedRef.current = false;
        useChatStore.getState().setSelectedChatId(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
          <p className="text-muted-foreground text-sm">Loading VibTribe...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div
        className="gradient-bg-page flex overflow-hidden w-full max-w-full pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0"
        style={{ height: 'calc(100dvh - 64px - env(safe-area-inset-top))' }}
      >
        <div className={`${selectedChatId ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto flex-shrink-0 min-w-0`}>
          <ChatListPanel />
        </div>
        <div className={`${selectedChatId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          <Suspense fallback={<div className="flex-1 flex items-center justify-center gradient-bg-page"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <ChatWindowPanel />
          </Suspense>
        </div>
      </div>
    </AppLayout>
  );
}