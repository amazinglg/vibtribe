import React, { useEffect, lazy, Suspense, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ChatListPanel from './components/ChatListPanel';
const ChatWindowPanel = lazy(() => import('./components/ChatWindowPanel'));
import BroadcastChatPanel, { BROADCAST_CHAT_ID } from './components/BroadcastChatPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/store/chatStore';
import TermsAcceptanceGate from '@/components/TermsAcceptanceGate';
import LandingPage from './LandingPage';
import { useT } from '@/contexts/LanguageContext';

export default function ChatsPage() {
  const { t } = useT();
  const { user, profile, loading } = useAuth();
  const router = useNavigate();
  const { selectedChatId, setSelectedChatId } = useChatStore();
  const [dobBannerDismissed, setDobBannerDismissed] = useState(false);
  const needsDob = !!user && !!profile && !(profile as any).dob;

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
    // Unauthenticated visitors now see the public landing page (rendered below)
    // instead of being force-redirected to /sign-in.
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="gradient-bg-page min-h-screen flex items-center justify-center">
        <div className="text-center float-up">
          <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 glow-primary animate-pulse">
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-muted-foreground text-sm">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  // Public marketing landing page for non-authenticated visitors.
  if (!user) return <LandingPage />;

  return (
    <AppLayout>
      <TermsAcceptanceGate />
      {needsDob && !dobBannerDismissed && !selectedChatId && (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-200 flex-1 leading-snug">
              Please add your <strong>Date of Birth</strong> in{' '}
              <Link to="/profile-screen" className="underline font-semibold">My Profile</Link>{' '}
              to continue using VibTribe (18+ only).
            </p>
            <button onClick={() => setDobBannerDismissed(true)} className="p-1 text-amber-300 hover:text-amber-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <div
        className="gradient-bg-page flex overflow-hidden w-full max-w-full pb-[calc(64px+var(--safe-bottom))] lg:pb-0"
        style={{ height: 'calc(100dvh - 64px - min(var(--safe-top), 2.25rem))' }}
      >
        <div className={`${selectedChatId ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto flex-shrink-0 min-w-0`}>
          <ChatListPanel />
        </div>
        <div className={`${selectedChatId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          {selectedChatId === BROADCAST_CHAT_ID ? (
            <BroadcastChatPanel />
          ) : (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center gradient-bg-page"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <ChatWindowPanel />
            </Suspense>
          )}
        </div>
      </div>
    </AppLayout>
  );
}