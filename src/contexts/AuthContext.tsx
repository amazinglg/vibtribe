// @ts-nocheck
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    // Safety net — never let the loading screen hang forever even if
    // getSession() stalls due to network / SW issues.
    const safety = setTimeout(() => setLoading(false), 3500);

    // Get initial session — persists across browser restarts
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safety);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Start polling for force-logout signal
        startForceLogoutPolling(session.user.id);
        startPresenceHeartbeat(session.user.id);
        // Register this device + start a session-row heartbeat for the Devices tab.
        import('@/lib/sessions').then(({ registerSession }) =>
          registerSession(session.user.id).then(() => startSessionHeartbeat(session.user.id)),
        ).catch(() => {});
        // Register FCM token (Capacitor / Android only, no-op in browser)
        import('@/lib/fcmRegister').then(({ registerFcmToken }) =>
          registerFcmToken(session.user.id),
        ).catch(() => {});
      }
      setLoading(false);
    }).catch(() => {
      clearTimeout(safety);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        startPresenceHeartbeat(session.user.id);
        import('@/lib/sessions').then(({ registerSession }) =>
          registerSession(session.user.id).then(() => startSessionHeartbeat(session.user.id)),
        ).catch(() => {});
        import('@/lib/fcmRegister').then(({ registerFcmToken }) =>
          registerFcmToken(session.user.id),
        ).catch(() => {});
      } else {
        setProfile(null);
        stopPresenceHeartbeat();
        stopSessionHeartbeat();
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safety);
      subscription.unsubscribe();
      stopPresenceHeartbeat();
      stopSessionHeartbeat();
    };
  }, []);

  // Keep the session warm: when the tab becomes visible (esp. on mobile
  // where the OS aggressively suspends JS) refresh the access token so
  // the user is not silently logged out on a stale JWT.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.getSession().then(({ data }) => {
        const exp = data.session?.expires_at ? data.session.expires_at * 1000 : 0;
        // Refresh proactively if token expires within 5 minutes
        if (exp && exp - Date.now() < 5 * 60 * 1000) {
          supabase.auth.refreshSession().catch(() => {});
        }
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // Presence heartbeat: ping last_seen + is_online every 30s while tab is visible.
  const startPresenceHeartbeat = (userId: string) => {
    if (typeof window === 'undefined') return;
    stopPresenceHeartbeat();
    const ping = async (online: boolean) => {
      try {
        await supabase.from('user_profiles')
          .update({ is_online: online, last_seen: new Date().toISOString() })
          .eq('id', userId);
      } catch {}
    };
    ping(true);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') ping(true);
    }, 30000);
    const visHandler = () => { ping(document.visibilityState === 'visible'); };
    const unloadHandler = () => { ping(false); };
    document.addEventListener('visibilitychange', visHandler);
    window.addEventListener('beforeunload', unloadHandler);
    window.addEventListener('pagehide', unloadHandler);
    (window as any).__vtPresence = { interval, visHandler, unloadHandler };
  };

  const stopPresenceHeartbeat = () => {
    if (typeof window === 'undefined') return;
    const p = (window as any).__vtPresence;
    if (!p) return;
    clearInterval(p.interval);
    document.removeEventListener('visibilitychange', p.visHandler);
    window.removeEventListener('beforeunload', p.unloadHandler);
    window.removeEventListener('pagehide', p.unloadHandler);
    (window as any).__vtPresence = null;
  };

  // Poll for force-logout tokens every 30 seconds
  const startForceLogoutPolling = (userId: string) => {
    const checkForceLogout = async () => {
      try {
        const { getCurrentSessionId, deleteCurrentSession } = await import('@/lib/sessions');
        const mySessionId = getCurrentSessionId();
        // Match tokens targeting this device specifically OR all devices (session_id null).
        const { data } = await supabase
          .from('force_logout_tokens')
          .select('id, session_id')
          .eq('user_id', userId);
        const match = (data ?? []).find(
          (t: any) => t.session_id === null || (mySessionId && t.session_id === mySessionId),
        );
        if (match) {
          // Delete only the matched token (leave per-device tokens for other devices)
          await supabase.from('force_logout_tokens').delete().eq('id', match.id);
          await deleteCurrentSession(userId);
          await supabase.auth.signOut({ scope: 'global' });
          setUser(null);
          setSession(null);
          setProfile(null);
          if (typeof window !== 'undefined') {
            window.location.href = '/sign-in';
          }
        }
      } catch {}
    };

    // Check immediately then every 30s
    checkForceLogout();
    const interval = setInterval(checkForceLogout, 30000);
    // Store interval id so we can clear it
    if (typeof window !== 'undefined') {
      (window as any).__forceLogoutInterval = interval;
    }
  };

  // Heartbeat: bump user_sessions.last_seen_at every 5 minutes while signed in.
  const startSessionHeartbeat = (userId: string) => {
    if (typeof window === 'undefined') return;
    stopSessionHeartbeat();
    const tick = () => {
      import('@/lib/sessions').then(({ heartbeatSession }) =>
        heartbeatSession(userId),
      ).catch(() => {});
    };
    const interval = setInterval(tick, 5 * 60 * 1000);
    (window as any).__sessionHeartbeat = interval;
  };
  const stopSessionHeartbeat = () => {
    if (typeof window === 'undefined') return;
    const i = (window as any).__sessionHeartbeat;
    if (i) clearInterval(i);
    (window as any).__sessionHeartbeat = null;
  };

  const fetchProfile = async (userId: string) => {
    try {
      // Use SECURITY DEFINER RPC so we still receive owner-only columns
      // (real_email, login_attempts, encryption material) that are no
      // longer readable via direct SELECT for security reasons.
      const { data } = await supabase.rpc('get_my_full_profile');
      const row = Array.isArray(data) ? data[0] : data;
      setProfile(row ?? null);
    } catch {}
  };

  // Helper: derive the auth email from a mobile number — uses ONLY the
  // last 10 digits (the local number, not the country code).
  const buildAuthEmail = (mobileNumber: string) => {
    const digits = mobileNumber.replace(/\D/g, '');
    const local10 = digits.slice(-10);
    return `${local10}@vibetribe.app`;
  };

  // Mobile number + password sign up (no verification required)
  const signUp = async (mobileNumber: string, password: string, metadata: any = {}) => {
    const emailFromMobile = buildAuthEmail(mobileNumber);
    const { data, error } = await supabase.auth.signUp({
      email: emailFromMobile,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          mobile_number: mobileNumber,
          country_code: metadata?.countryCode || '+91',
          avatar_url: metadata?.avatarUrl || '',
          username: metadata?.username || '',
          dob: metadata?.dob || '',
          role: 'user',
        },
        emailRedirectTo: undefined,
      }
    });
    if (error) throw error;
    // Best-effort: persist country_code + username in profile
    try {
      if (data?.user?.id) {
        const updates: any = {};
        if (metadata?.countryCode) updates.country_code = metadata.countryCode;
        if (metadata?.username) updates.username = metadata.username;
        if (metadata?.dob) updates.dob = metadata.dob;
        if (Object.keys(updates).length) {
          await supabase.from('user_profiles').update(updates).eq('id', data.user.id);
        }
      }
    } catch {}
    return data;
  };

  // Mobile number + password sign in (accepts any format, uses last 10 digits)
  const signIn = async (mobileNumber: string, password: string) => {
    const emailFromMobile = buildAuthEmail(mobileNumber);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailFromMobile,
      password
    });
    if (error) throw error;
    if (data?.session) setSession(data.session);
    if (data?.user) {
      setUser(data.user);
      fetchProfile(data.user.id);
    }
    setLoading(false);
    return data;
  };

  // Email sign in — supports BOTH the synthetic mobile email and a user's real
  // email stored in user_profiles.real_email
  const signInWithEmail = async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    // Direct sign-in only. The real_email → synthetic-email fallback is now
    // handled by the /api/public/auth-login server route, which calls the
    // pre_login_lookup RPC under the service role.
    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    if (error) throw error;
    if (data?.session) setSession(data.session);
    if (data?.user) {
      setUser(data.user);
      fetchProfile(data.user.id);
    }
    setLoading(false);
    return data;
  };

  // Sign Out — manual only
  const signOut = async () => {
    // Clear force logout polling
    if (typeof window !== 'undefined' && (window as any).__forceLogoutInterval) {
      clearInterval((window as any).__forceLogoutInterval);
    }
    stopSessionHeartbeat();
    // Remove this device's session row so it disappears from the Devices tab.
    try {
      if (user?.id) {
        const { deleteCurrentSession } = await import('@/lib/sessions');
        await deleteCurrentSession(user.id);
      }
    } catch {}
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
    setProfile(null);
  };

  // Update profile
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    // Re-read the full row (incl. sensitive own-only fields) via secure RPC.
    const { data } = await supabase.rpc('get_my_full_profile');
    setProfile(data);
    return data;
  };

  // Password reset
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  // Update password
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  // Get Current User
  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Get User Profile from Database
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('get_my_full_profile');
    if (error) throw error;
    return data;
  };

  const isAdmin = () => profile?.role === 'admin' || profile?.role === 'master_admin' || !!profile?.is_master_admin;

  const value = {
    user,
    session,
    loading,
    profile,
    signUp,
    signIn,
    signInWithEmail,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    getCurrentUser,
    getUserProfile,
    fetchProfile,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
