import React, { createContext, useContext } from 'react';

/**
 * Trust Lock context — exposes the active chat's Trust Lock state to nested
 * components (chat header badge, media renderer, etc.) without prop drilling.
 *
 * When `enabled` is true:
 *   - media download / share buttons must be hidden
 *   - on native Android, FLAG_SECURE is applied by the chat panel
 */
export interface TrustLockState {
  enabled: boolean;
  ownerUserId: string | null;
  isOwner: boolean;
}

const TrustLockCtx = createContext<TrustLockState>({
  enabled: false,
  ownerUserId: null,
  isOwner: false,
});

export function TrustLockProvider({
  value,
  children,
}: {
  value: TrustLockState;
  children: React.ReactNode;
}) {
  return <TrustLockCtx.Provider value={value}>{children}</TrustLockCtx.Provider>;
}

export function useTrustLock(): TrustLockState {
  return useContext(TrustLockCtx);
}