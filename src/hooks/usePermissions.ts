import { useState, useCallback } from 'react';

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

  const checkAllPermissions = useCallback(async () => {
    const [mic, cam, notif] = await Promise.all([
      queryPermission('microphone' as PermissionName),
      queryPermission('camera' as PermissionName),
      queryPermission('notifications' as PermissionName),
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
  };
}
