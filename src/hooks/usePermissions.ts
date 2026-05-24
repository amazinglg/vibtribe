import { useState, useCallback } from 'react';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'idle';

export interface PermissionsState {
  microphone: PermissionStatus;
  camera: PermissionStatus;
  notifications: PermissionStatus;
  storage: PermissionStatus;
  contacts: PermissionStatus;
  photos: PermissionStatus;
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
    contacts: 'idle',
    photos: 'idle',
  });

  const requestMicrophone = useCallback(async (): Promise<PermissionRequestResult> => {
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
    // Storage quota / persistent storage API
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

  const requestContacts = useCallback(async (): Promise<PermissionRequestResult> => {
    // Web Contact Picker API — only available on Android Chrome over HTTPS.
    // There is no persistent grant; each call opens the native picker.
    const ContactsManager = (navigator as unknown as { contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<unknown[]> } }).contacts;
    if (!ContactsManager || typeof ContactsManager.select !== 'function') {
      setPermissions(p => ({ ...p, contacts: 'unsupported' }));
      return { granted: false, status: 'unsupported' };
    }
    try {
      await ContactsManager.select(['name'], { multiple: false });
      setPermissions(p => ({ ...p, contacts: 'granted' }));
      return { granted: true, status: 'granted' };
    } catch {
      setPermissions(p => ({ ...p, contacts: 'denied' }));
      return { granted: false, status: 'denied' };
    }
  }, []);

  const requestPhotos = useCallback(async (): Promise<PermissionRequestResult> => {
    // Web has no persistent "photos" permission. We trigger a one-time
    // <input type="file" accept="image/*"> picker; the user choosing a file
    // counts as granting access for that selection.
    return new Promise<PermissionRequestResult>((resolve) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.style.display = 'none';
        let settled = false;
        const settle = (granted: boolean) => {
          if (settled) return;
          settled = true;
          const status: PermissionStatus = granted ? 'granted' : 'denied';
          setPermissions(p => ({ ...p, photos: status }));
          try { document.body.removeChild(input); } catch { /* ignore */ }
          resolve({ granted, status });
        };
        input.onchange = () => settle(!!input.files && input.files.length > 0);
        input.oncancel = () => settle(false);
        document.body.appendChild(input);
        input.click();
        // Fallback if neither event fires within 60s
        setTimeout(() => settle(false), 60000);
      } catch {
        setPermissions(p => ({ ...p, photos: 'denied' }));
        resolve({ granted: false, status: 'denied' });
      }
    });
  }, []);

  const checkAllPermissions = useCallback(async () => {
    const [mic, cam, notif] = await Promise.all([
      queryPermission('microphone' as PermissionName),
      queryPermission('camera' as PermissionName),
      queryPermission('notifications' as PermissionName),
    ]);
    const storagePersisted = navigator?.storage?.persisted
      ? await navigator.storage.persisted().catch(() => false)
      : false;
    const ContactsManager = (navigator as unknown as { contacts?: { select?: unknown } }).contacts;
    const contactsSupported = !!(ContactsManager && typeof ContactsManager.select === 'function');
    setPermissions(prev => ({
      microphone: mic,
      camera: cam,
      notifications: notif,
      storage: storagePersisted ? 'granted' : 'prompt',
      contacts: contactsSupported ? (prev.contacts === 'granted' ? 'granted' : 'prompt') : 'unsupported',
      photos: prev.photos === 'granted' ? 'granted' : 'prompt',
    }));
  }, []);

  return {
    permissions,
    requestMicrophone,
    requestCamera,
    requestMicAndCamera,
    requestNotifications,
    requestStorage,
    requestContacts,
    requestPhotos,
    checkAllPermissions,
  };
}
