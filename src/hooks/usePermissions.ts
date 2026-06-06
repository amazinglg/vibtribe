import { useState, useCallback } from 'react';
import {
  isNativeWrapper,
  requestNativeCameraPermission,
  requestNativeContactsPermission,
  registerNativePushNotifications,
  requestNativeMicrophonePermission,
  requestNativeStoragePermission,
} from '@/lib/native-bridge';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'idle';

export interface PermissionsState {
  microphone: PermissionStatus;
  camera: PermissionStatus;
  notifications: PermissionStatus;
  storage: PermissionStatus;
}

export interface PermissionRequestResult {
  granted: boolean;
  status: PermissionStatus;
}

async function queryPermission(name: PermissionName): Promise<PermissionStatus> {
  if (!navigator?.permissions) return 'unsupported';
  try {
    const result = await navigator.permissions.query({ name });
    return result.state as PermissionStatus;
  } catch {
    return 'unsupported';
  }
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionsState>({
    microphone: 'idle',
    camera: 'idle',
    notifications: 'idle',
    storage: 'idle',
  });

  const requestMicrophone = useCallback(async (): Promise<PermissionRequestResult> => {
    if (isNativeWrapper()) {
      const native = await requestNativeMicrophonePermission();
      const status: PermissionStatus = native === 'granted' ? 'granted' : 'denied';
      setPermissions(p => ({ ...p, microphone: status }));
      return { granted: status === 'granted', status };
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissions(p => ({ ...p, microphone: 'unsupported' }));
      return { granted: false, status: 'unsupported' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setPermissions(p => ({ ...p, microphone: 'granted' }));
      return { granted: true, status: 'granted' };
    } catch (err: unknown) {
      const status: PermissionStatus =
        err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'denied';
      setPermissions(p => ({ ...p, microphone: status }));
      return { granted: false, status };
    }
  }, []);

  const requestCamera = useCallback(async (): Promise<PermissionRequestResult> => {
    // Inside Capacitor, fire the native Android camera dialog first so the
    // OS-level permission is actually granted. The WebView's getUserMedia
    // call below will then succeed silently.
    if (isNativeWrapper()) {
      const native = await requestNativeCameraPermission();
      if (native !== 'granted') {
        setPermissions(p => ({ ...p, camera: 'denied' }));
        return { granted: false, status: 'denied' };
      }
      // Native OS permission granted — that is the source of truth on Android.
      // The WebView's getUserMedia may still fail without an explicit
      // onPermissionRequest bridge, which would incorrectly flip the toggle
      // back to "denied". Trust the native grant.
      setPermissions(p => ({ ...p, camera: 'granted' }));
      return { granted: true, status: 'granted' };
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissions(p => ({ ...p, camera: 'unsupported' }));
      return { granted: false, status: 'unsupported' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setPermissions(p => ({ ...p, camera: 'granted' }));
      return { granted: true, status: 'granted' };
    } catch (err: unknown) {
      const status: PermissionStatus =
        err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'denied';
      setPermissions(p => ({ ...p, camera: status }));
      return { granted: false, status };
    }
  }, []);

  const requestMicAndCamera = useCallback(async (): Promise<PermissionRequestResult> => {
    if (isNativeWrapper()) {
      // Request camera (OS) and mic (via getUserMedia → WebView delegation) together.
      const [camNative, micNative] = await Promise.all([
        requestNativeCameraPermission(),
        requestNativeMicrophonePermission(),
      ]);
      const camStatus: PermissionStatus = camNative === 'granted' ? 'granted' : 'denied';
      const micStatus: PermissionStatus = micNative === 'granted' ? 'granted' : 'denied';
      setPermissions(p => ({ ...p, microphone: micStatus, camera: camStatus }));
      if (camStatus !== 'granted' || micStatus !== 'granted') {
        return { granted: false, status: 'denied' };
      }
      return { granted: true, status: 'granted' };
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissions(p => ({ ...p, microphone: 'unsupported', camera: 'unsupported' }));
      return { granted: false, status: 'unsupported' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(t => t.stop());
      setPermissions(p => ({ ...p, microphone: 'granted', camera: 'granted' }));
      return { granted: true, status: 'granted' };
    } catch (err: unknown) {
      const status: PermissionStatus =
        err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'denied';
      setPermissions(p => ({ ...p, microphone: status, camera: status }));
      return { granted: false, status };
    }
  }, []);

  const requestNotifications = useCallback(async (): Promise<PermissionRequestResult> => {
    // On Android 13+, the WebView's Notification.requestPermission() does
    // NOT trigger the OS-level POST_NOTIFICATIONS dialog. We must call the
    // native PushNotifications plugin so the user sees the system prompt.
    if (isNativeWrapper()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        const status: PermissionStatus = perm.receive === 'granted' ? 'granted' : 'denied';
        setPermissions(p => ({ ...p, notifications: status }));
        return { granted: status === 'granted', status };
      } catch (e) {
        console.warn('[VibTribe] native notification permission failed', e);
      }
    }
    if (!('Notification' in window)) {
      setPermissions(p => ({ ...p, notifications: 'unsupported' }));
      return { granted: false, status: 'unsupported' };
    }
    if (Notification.permission === 'granted') {
      setPermissions(p => ({ ...p, notifications: 'granted' }));
      return { granted: true, status: 'granted' };
    }
    try {
      const result = await Notification.requestPermission();
      const status: PermissionStatus = result === 'granted' ? 'granted' : 'denied';
      setPermissions(p => ({ ...p, notifications: status }));
      return { granted: result === 'granted', status };
    } catch {
      setPermissions(p => ({ ...p, notifications: 'denied' }));
      return { granted: false, status: 'denied' };
    }
  }, []);

  const requestStorage = useCallback(async (): Promise<PermissionRequestResult> => {
    // On Android, surface the real READ_MEDIA_IMAGES (or legacy
    // READ_EXTERNAL_STORAGE) prompt so users can pick photos/files from the
    // gallery. The Capacitor Camera plugin's `photos` permission triggers
    // the correct OS dialog for each Android version.
    if (isNativeWrapper()) {
      const native = await requestNativeStoragePermission();
      const status: PermissionStatus = native === 'granted' ? 'granted' : 'denied';
      setPermissions(p => ({ ...p, storage: status }));
      return { granted: status === 'granted', status };
    }
    if (!navigator?.storage?.persist) {
      setPermissions(p => ({ ...p, storage: 'unsupported' }));
      return { granted: false, status: 'unsupported' };
    }
    try {
      const persisted = await navigator.storage.persist();
      const status: PermissionStatus = persisted ? 'granted' : 'denied';
      setPermissions(p => ({ ...p, storage: status }));
      return { granted: persisted, status };
    } catch {
      setPermissions(p => ({ ...p, storage: 'denied' }));
      return { granted: false, status: 'denied' };
    }
  }, []);

  const checkAllPermissions = useCallback(async () => {
    // On native Android the WebView's navigator.permissions API is decoupled
    // from the real OS-level POST_NOTIFICATIONS grant — it keeps reporting
    // 'denied' even after the user grants the system dialog. Read the real
    // status from the PushNotifications plugin instead.
    let notif: PermissionStatus;
    if (isNativeWrapper()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.checkPermissions();
        notif = perm.receive === 'granted' ? 'granted'
          : perm.receive === 'denied' ? 'denied'
          : 'prompt';
      } catch {
        notif = await queryPermission('notifications' as PermissionName);
      }
    } else {
      notif = await queryPermission('notifications' as PermissionName);
    }
    // On native Android, read the real OS-level Camera plugin permissions
    // for camera + photos (storage) so the toggles reflect the actual grant
    // even after the user changes them in system Settings and returns.
    if (isNativeWrapper()) {
      let camStatus: PermissionStatus = 'prompt';
      let storageStatus: PermissionStatus = 'prompt';
      try {
        const { Camera } = await import('@capacitor/camera');
        const perms = await Camera.checkPermissions();
        camStatus = perms.camera === 'granted' ? 'granted'
          : perms.camera === 'denied' ? 'denied' : 'prompt';
        const photos = (perms as { photos?: string }).photos;
        storageStatus = (photos === 'granted' || photos === 'limited') ? 'granted'
          : photos === 'denied' ? 'denied' : 'prompt';
      } catch {}
      setPermissions(prev => ({
        ...prev,
        notifications: notif,
        camera: camStatus,
        storage: storageStatus,
        // Microphone has no Capacitor checkPermissions API — preserve the
        // last value set by requestMicrophone() / a successful getUserMedia.
      }));
      return;
    }
    const [mic, cam] = await Promise.all([
      queryPermission('microphone' as PermissionName),
      queryPermission('camera' as PermissionName),
    ]);
    const storagePersisted = navigator?.storage?.persisted
      ? await navigator.storage.persisted().catch(() => false)
      : false;
    setPermissions({
      microphone: mic,
      camera: cam,
      notifications: notif,
      storage: storagePersisted ? 'granted' : 'prompt',
    });
  }, []);

  return {
    permissions,
    requestMicrophone,
    requestCamera,
    requestMicAndCamera,
    requestNotifications,
    requestStorage,
    checkAllPermissions,
    requestContacts: async (): Promise<PermissionRequestResult> => {
      // Contacts only exists natively. On the web it's a no-op surface.
      if (!isNativeWrapper()) return { granted: false, status: 'unsupported' };
      const status = await requestNativeContactsPermission();
      return { granted: status === 'granted', status };
    },
  };
}
