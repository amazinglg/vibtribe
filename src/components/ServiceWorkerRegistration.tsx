import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function ServiceWorkerRegistration() {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Request notification permission after SW is registered
      if ('Notification' in window && Notification.permission === 'default') {
        // Small delay to not overwhelm user on first load
        setTimeout(() => {
          Notification.requestPermission().then((permission) => {
            setNotifPermission(permission);
          });
        }, 3000);
      } else if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    }).catch(() => {});
  }, []);

  // Listen for new messages and show local notification if app is in background
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-messages-notif')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=neq.${user.id}`,
      }, async (payload) => {
        const msg = payload.new as any;

        // Check if this message is in a chat the user participates in
        const { data: chat } = await supabase
          .from('chats')
          .select('participant_one, participant_two')
          .eq('id', msg.chat_id)
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
          .single();

        if (!chat) return;

        // Get sender name
        const { data: sender } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', msg.sender_id)
          .single();

        const senderName = sender?.full_name || 'Someone';
        const messageText = msg.content || 'Sent you a message';

        // Show notification if permission granted and document is hidden
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(`${senderName} — VibeTribe`, {
            body: messageText,
            icon: '/favicon.ico',
            tag: `msg-${msg.chat_id}`,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return null;
}
