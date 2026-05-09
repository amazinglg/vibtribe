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
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  // Poll for force-logout tokens every 30 seconds
  const startForceLogoutPolling = (userId: string) => {
    const checkForceLogout = async () => {
      try {
        const { data } = await supabase
          .from('force_logout_tokens')
          .select('id')
          .eq('user_id', userId)
          .limit(1);
        if (data && data.length > 0) {
          // Delete the token first, then sign out
          await supabase.from('force_logout_tokens').delete().eq('user_id', userId);
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

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
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
          role: 'user',
        },
        emailRedirectTo: undefined,
      }
    });
    if (error) throw error;
    // Best-effort: persist country_code in profile (in case trigger doesn't pick it up)
    try {
      if (data?.user?.id && metadata?.countryCode) {
        await supabase.from('user_profiles').update({ country_code: metadata.countryCode }).eq('id', data.user.id);
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
    // First try direct sign-in (covers admins / synthetic emails)
    let { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    if (error) {
      // Fallback: look up by real_email -> get the synthetic email -> sign in with that
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .ilike('real_email', trimmed)
        .maybeSingle();
      if (profile?.email) {
        const retry = await supabase.auth.signInWithPassword({ email: profile.email, password });
        if (retry.error) throw retry.error;
        if (retry.data?.session) setSession(retry.data.session);
        if (retry.data?.user) {
          setUser(retry.data.user);
          fetchProfile(retry.data.user.id);
        }
        setLoading(false);
        return retry.data;
      }
      throw error;
    }
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
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
    setProfile(null);
  };

  // Update profile
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const isAdmin = () => profile?.role === 'admin';

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
