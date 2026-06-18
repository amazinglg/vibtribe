/**
 * Register the device's FCM push token with Supabase. Only runs inside the
 * Capacitor Android wrapper — no-op in the browser/PWA (web push is handled
 * separately by pushNotifications.ts).
 */
import { supabase } from '@/integrations/supabase/client';

export async function registerFcmToken(userId: string): Promise<void> {
  if (!userId || typeof window === 'undefined') return;
  const w = window as any;
  const isCapacitor = !!w.Capacitor?.isNativePlatform?.();
  if (!isCapacitor) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    await PushNotifications.removeAllListeners().catch(() => {});
    await PushNotifications.addListener('registration', async ({ value: token }) => {
      try {
        await supabase.from('fcm_tokens').upsert({
          user_id: userId,
          token,
          platform: 'android',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,token' });
      } catch (e) {
        console.warn('[FCM] save token failed', e);
      }
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[FCM] registration error', err);
    });
    // When the user taps an FCM notification (background/killed-state),
    // route them to the right chat/call. The notification payload includes
    // either { url, chatId, callId } in `data`.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      try {
        const data: any = action?.notification?.data || {};
        const chatId = data.chatId || data.chat_id || null;
        const callId = data.callId || data.call_id || null;
        const url = (data.url as string) || (chatId ? `/?chat=${encodeURIComponent(chatId)}${callId ? `&call=${encodeURIComponent(callId)}` : ''}` : '/');
        // Update the URL so deep-link handlers in the app pick it up.
        try {
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch {}
        // Fire a custom event the chat store listens for — this works even
        // when the SPA is already on `/` and history.pushState alone would
        // not re-render the chat panel.
        if (chatId) {
          window.dispatchEvent(new CustomEvent('vt-open-chat', { detail: { chatId, callId } }));
        }
        if (callId) {
          window.dispatchEvent(new CustomEvent('vt-incoming-call', { detail: { callId, chatId } }));
        }
      } catch (e) {
        console.warn('[FCM] action handler failed', e);
      }
    });

    await PushNotifications.register();
  } catch (e) {
    console.warn('[FCM] init failed', e);
  }
}