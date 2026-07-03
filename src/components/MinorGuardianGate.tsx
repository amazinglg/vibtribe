// @ts-nocheck
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

/**
 * When the signed-in user's saved DOB makes them a minor (<18), or the
 * account_status is 'pending_guardian', route them to /guardian-setup so
 * they complete guardian consent before continuing.
 *
 * Never interrupt the guardian flow itself or auth routes.
 */
export default function MinorGuardianGate() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  useEffect(() => {
    if (!user || !profile) return;
    const path = pathname || '/';
    // Do not redirect from guardian pages, auth, or public consent link.
    if (
      path.startsWith('/guardian-setup') ||
      path.startsWith('/guardian-consent') ||
      path.startsWith('/auth') ||
      path.startsWith('/reset-password')
    ) return;

    let isMinor = false;
    const dob = (profile as any).dob;
    if (dob) {
      const d = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
      isMinor = age < 18;
    }
    const pending = (profile as any).account_status === 'pending_guardian';
    if (!isMinor && !pending) return;

    toast.info("You're under 18 — please complete guardian consent to keep using VibTribe.");
    navigate({ to: '/guardian-setup' as any });
  }, [user?.id, (profile as any)?.dob, (profile as any)?.account_status, pathname]);

  return null;
}