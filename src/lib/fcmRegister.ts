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

    await PushNotifications.register();
  } catch (e) {
    console.warn('[FCM] init failed', e);
  }
}