// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft, Shield, Pencil, X, Save, KeyRound, Ban, Trash2,
  UserX, UserCheck, LogOut, AlertTriangle, ShieldCheck, ShieldOff, RotateCcw,
  Mail, Phone, Clock, Calendar, Activity, Lock, BadgeCheck, FileText, Megaphone,
  Crown, Infinity as InfinityIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { COUNTRIES, findCountryByDial, flagFromIso2 } from '@/lib/countryCodes';

export default function AdminUserDetailPage() {
  const navigate = useNavigate();
  const params = useParams({ from: '/admin/user/$userId' });
  const userId = params.userId;
  const { user, profile, isAdmin, loading } = useAuth();
  const supabase = createClient();

  const [target, setTarget] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', mobile_number: '', country_code: '+91' });
  const [secureChatCount, setSecureChatCount] = useState<number | null>(null);
  const [guardian, setGuardian] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState<'general' | 'terms_breach' | 'incomplete_signup' | ''>('');

  const isMaster = !!profile?.is_master_admin;

  useEffect(() => {
    if (!loading) {
      if (!user) { navigate({ to: '/sign-in', replace: true }); return; }
      if (!isAdmin?.()) { navigate({ to: '/', replace: true }); return; }
      load();
    }
  }, [user, loading, userId]);

  const load = async () => {
    setLoadingData(true);
    // Use admin RPC so we receive owner-only columns (real_email, login_attempts)
    // that are no longer readable via direct SELECT.
    const { data } = await supabase.rpc('admin_get_user_profile', { _user_id: userId });
    const row = Array.isArray(data) ? data[0] : data;
    setTarget(row);
    setLoadingData(false);
    // Master-admin only: count chats this user has moved to their Secure Vault
    if (profile?.is_master_admin) {
      const { count } = await supabase
        .from('user_secure_chats')
        .select('chat_id', { count: 'exact', head: true })
        .eq('user_id', userId);
      setSecureChatCount(count || 0);
    }
    // If under 18, fetch guardian consent record for the admin panel.
    if (row?.dob) {
      const d = new Date(row.dob);
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      if (age < 18) {
        const { data: g } = await supabase.rpc('admin_get_guardian_consent', { _user_id: userId });
        setGuardian(Array.isArray(g) ? g[0] : g);
      } else {
        setGuardian(null);
      }
    }
  };

  const update = async (updates: any, successMsg: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('user_profiles').update(updates).eq('id', userId);
      if (error) throw error;
      setTarget((t: any) => ({ ...t, ...updates }));
      toast.success(successMsg);
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    await update(editForm, 'User info updated');
    setEditOpen(false);
  };

  const handleBlock = () => {
    const newStatus = target.account_status === 'blocked' ? 'active' : 'blocked';
    update({ account_status: newStatus }, `User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`);
  };

  const handleSuspend = (suspend: boolean) => {
    const updates: any = { is_suspended: suspend, account_status: suspend ? 'suspended' : 'active' };
    if (!suspend) updates.login_attempts = 0;
    update(updates, suspend ? 'User suspended' : 'User unsuspended');
  };

  const handleResetPassword = async () => {
    if (!target.mobile_number) { toast.error('No mobile number on file'); return; }
    const newPwd = (target.mobile_number || '').replace(/\D/g, '').slice(-10);
    if (newPwd.length < 10) { toast.error('Mobile number must have at least 10 digits'); return; }
    if (!confirm(`Reset password for ${target.full_name || 'this user'} to their 10-digit mobile number (${newPwd})?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('admin_reset_user_password' as any, {
        target_user_id: userId, new_password: newPwd,
      });
      if (error) throw error;
      toast.success(`Password reset to ${newPwd}`);
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleForceLogout = async () => {
    if (!confirm(`Force logout ${target.full_name || 'this user'}?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('force_logout_tokens').insert({ user_id: userId, issued_by: user?.id });
      if (error) throw error;
      toast.success('Force logout issued');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleResetOtpAttempts = async () => {
    if (!isMaster) { toast.error('Master admin only'); return; }
    if (!target.real_email) { toast.error('No verified email on file'); return; }
    if (!confirm(`Reset OTP resend attempts for ${target.full_name || 'this user'}? They will have 5 fresh attempts and the 24h timer starts now.`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('admin_reset_otp_attempts' as any, { _user_id: userId });
      if (error) throw error;
      toast.success('OTP attempts reset — 5/5 available');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const openDeleteDialog = () => {
    setDeleteReason('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteReason) { toast.error('Please select a reason'); return; }
    setActionLoading(true);
    try {
      const { adminDeleteUser } = await import('@/lib/admin-users.functions');
      await adminDeleteUser({ data: { userId, reason: deleteReason } });
      toast.success('User deleted — offboarding email sent');
      setDeleteOpen(false);
      navigate({ to: '/admin' });
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleChangeRole = async (newRole: 'user' | 'admin' | 'master_admin') => {
    if (!isMaster) { toast.error('Only the master admin can change roles'); return; }
    if (newRole === 'master_admin') {
      if (!confirm(`Promote this user to MASTER ADMIN? They will have full unrestricted access — this is irreversible from their side.`)) return;
      await update({ role: 'admin', is_master_admin: true }, 'User promoted to Master Admin');
      return;
    }
    if (!confirm(`Change role to "${newRole}"?`)) return;
    // If demoting a master admin back to plain admin/user, also clear the flag
    const updates: any = { role: newRole };
    if (target.is_master_admin) updates.is_master_admin = false;
    await update(updates, `Role updated to ${newRole}`);
  };

  const handleToggleVerified = async (next: boolean) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('admin_set_user_verified', {
        _user_id: userId, _verified: next,
      });
      if (error) throw error;
      setTarget((t: any) => ({ ...t, is_verified: next }));
      toast.success(next ? 'Verified badge granted' : 'Verified badge removed');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update verified status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantPremium = async (months: number | 'forever') => {
    if (!isMaster) { toast.error('Master admin only'); return; }
    const label = months === 'forever' ? 'forever' : `${months} month${months === 1 ? '' : 's'}`;
    if (!confirm(`Mark ${target.full_name || 'this user'} as Premium for ${label}?`)) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_set_premium' as any, {
        _user_id: userId,
        _months: months === 'forever' ? 1 : months,
        _forever: months === 'forever',
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setTarget((t: any) => ({ ...t, ...(row || {}) }));
      toast.success(`Premium granted (${label})`);
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleRevokePremium = async () => {
    if (!isMaster) { toast.error('Master admin only'); return; }
    if (!confirm(`Revoke premium from ${target.full_name || 'this user'}? Premium features will be removed immediately.`)) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_revoke_premium' as any, { _user_id: userId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setTarget((t: any) => ({ ...t, ...(row || { is_premium: false, premium_expires_at: null, premium_source: null }) }));
      toast.success('Premium revoked');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  if (loading || loadingData || !target) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isSelf = target.id === user?.id;
  const targetIsMaster = !!target.is_master_admin;
  // If target is master admin and current user is not the same master → lock all actions
  const locked = targetIsMaster && !isSelf;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/admin' })}
            className="p-2 glass rounded-xl text-foreground hover:bg-muted transition-all"
            aria-label="Back to admin"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-foreground">User details</h1>
            <p className="text-xs text-muted-foreground">Manage account, security and access</p>
          </div>
          {!locked && !isSelf && (
            <button
              onClick={() => { setEditForm({ full_name: target.full_name || '', email: target.real_email || target.email || '', mobile_number: target.mobile_number || '', country_code: target.country_code || '+91' }); setEditOpen(true); }}
              className="px-3 py-2 rounded-xl glass border border-border text-foreground hover:border-primary/40 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        {/* Profile hero */}
        <div className="glass rounded-3xl border border-border p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 gradient-primary rounded-full blur-3xl opacity-15" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-3xl glow-primary">
                {target.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              {target.is_online && target.last_seen && (Date.now() - new Date(target.last_seen).getTime()) < 2 * 60 * 1000 && (
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-vt-green rounded-full border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-bold text-foreground text-xl truncate">{target.full_name || 'Unknown'}</h2>
                {targetIsMaster && (
                  <span className="text-[10px] bg-vt-amber/20 text-vt-amber px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Master Admin</span>
                )}
                {!targetIsMaster && target.role === 'admin' && (
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Admin</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                  target.is_suspended ? 'bg-orange-500/20 text-orange-400' :
                  target.account_status === 'active' ? 'bg-vt-green/20 text-vt-green' :
                  target.account_status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {target.is_suspended ? 'Suspended' : target.account_status}
                </span>
                {(() => {
                  const hasAnswered = !!target.marketing_consent_at;
                  const optedIn = !!target.email_marketing_opt_in;
                  const cls = !hasAnswered
                    ? 'bg-muted text-muted-foreground'
                    : optedIn
                      ? 'bg-vt-green/20 text-vt-green'
                      : 'bg-red-500/20 text-red-400';
                  const label = !hasAnswered
                    ? 'Promo: Pending'
                    : optedIn
                      ? 'Promo: Opted in'
                      : 'Promo: Opted out';
                  const title = target.marketing_consent_at
                    ? `Last updated ${new Date(target.marketing_consent_at).toLocaleString()}${target.marketing_consent_source ? ` · via ${target.marketing_consent_source}` : ''}`
                    : 'User has not made a choice yet';
                  return (
                    <span title={title} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${cls}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
              {target.username && <p className="text-xs text-primary truncate mb-1">@{target.username}</p>}
              <div className="space-y-0.5 text-xs text-muted-foreground">
                {target.real_email && <p className="flex items-center gap-1.5 truncate"><Mail size={11} /> {target.real_email}</p>}
                {target.mobile_number && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={11} />
                    {(() => {
                      const c = findCountryByDial(target.country_code);
                      return c ? <span aria-hidden className="text-sm leading-none">{flagFromIso2(c.iso2)}</span> : null;
                    })()}
                    <span>{target.mobile_number}</span>
                    {target.country_code && <span className="text-[10px] text-muted-foreground">({target.country_code})</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile icon={Activity} label="Online" value={target.is_online && target.last_seen && (Date.now() - new Date(target.last_seen).getTime()) < 2 * 60 * 1000 ? 'Yes' : 'No'} />
          <StatTile icon={Clock} label="Last seen" value={target.last_seen ? new Date(target.last_seen).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} />
          <StatTile icon={Lock} label="Login attempts" value={`${target.login_attempts || 0} / 5`} warn={(target.login_attempts || 0) >= 3} />
          <StatTile icon={Calendar} label="Joined" value={new Date(target.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} />
        </div>

        {/* Master-admin only: Secure chats by this user */}
        {isMaster && (
          <div className="glass rounded-2xl border border-vt-amber/30 p-5 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-vt-amber/20 rounded-xl flex items-center justify-center">
                  <Shield size={18} className="text-vt-amber" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Secure Chats Created</p>
                  <p className="text-[10px] text-vt-amber">Visible to master admin only</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {secureChatCount === null ? '—' : secureChatCount}
              </p>
            </div>
          </div>
        )}

        {/* Role management */}
        {!isSelf && !locked && isMaster && (
          <div className="glass rounded-2xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              Role Management
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Current role: <span className="font-semibold text-foreground capitalize">{target.role}</span>
              {target.is_master_admin && <span className="ml-2 text-vt-amber">(Master Admin)</span>}
            </p>
            <label className="text-xs text-muted-foreground mb-1 block">Change Role</label>
            <select
              value={target.role}
              onChange={(e) => handleChangeRole(e.target.value as any)}
              disabled={actionLoading}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="master_admin">Master Admin</option>
            </select>
            <p className="text-[10px] text-muted-foreground mt-2">
              Only the master admin can change roles. Promoting a user to Master Admin grants them full unrestricted access.
            </p>
          </div>
        )}

        {/* Verified badge toggle — admin-only */}
        {!isSelf && !locked && (
          <div className="glass rounded-2xl border border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                  <BadgeCheck size={16} className="text-primary" />
                  Verified Badge
                </h3>
                <p className="text-xs text-muted-foreground">
                  Show a blue verified tick next to this user's name across chats and tribes. Reserve for public figures, official accounts, and trusted partners.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={!!target.is_verified}
                disabled={actionLoading}
                onClick={() => handleToggleVerified(!target.is_verified)}
                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${target.is_verified ? 'gradient-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${target.is_verified ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Premium membership — master admin only */}
        {!isSelf && !locked && isMaster && (
          <div className="glass rounded-2xl border border-amber-500/30 p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center ring-1 ring-amber-400/20">
                <Crown size={18} className="text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Premium Membership</h3>
                {target.is_premium ? (
                  <p className="text-xs text-amber-300 mt-0.5">
                    Active{' '}
                    {target.premium_expires_at
                      ? <>· expires {new Date(target.premium_expires_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                      : <>· <span className="inline-flex items-center gap-0.5"><InfinityIcon size={11} /> forever</span></>
                    }
                    {target.premium_source ? <span className="text-muted-foreground"> · source: {target.premium_source}</span> : null}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Not a premium user. Grant a duration to unlock premium features.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  disabled={actionLoading}
                  onClick={() => handleGrantPremium(m)}
                  className="px-2 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                >
                  {m} month{m === 1 ? '' : 's'}
                </button>
              ))}
              <button
                disabled={actionLoading}
                onClick={() => handleGrantPremium('forever')}
                className="px-2 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-200 hover:brightness-110 border border-amber-400/40 transition-all flex items-center justify-center gap-1"
              >
                <InfinityIcon size={12} /> Forever
              </button>
            </div>
            {target.is_premium && (
              <button
                disabled={actionLoading}
                onClick={handleRevokePremium}
                className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                Revoke premium now
              </button>
            )}
          </div>
        )}

        {/* Action sections */}
        {locked ? (
          <div className="glass rounded-2xl border border-vt-amber/30 p-5 flex items-center gap-3">
            <AlertTriangle size={16} className="text-vt-amber flex-shrink-0" />
            <p className="text-xs text-vt-amber">Master Admin accounts are protected from modification by other admins.</p>
          </div>
        ) : isSelf ? (
          <div className="glass rounded-2xl border border-primary/30 p-5 flex items-center gap-3">
            <AlertTriangle size={16} className="text-primary flex-shrink-0" />
            <p className="text-xs text-primary">This is your own account. Use the Profile page to manage your own settings.</p>
          </div>
        ) : (
          <>
            {/* Account Controls */}
            <SectionCard
              title="Account controls"
              subtitle="Restrict sign-in or change how this user accesses the platform."
              icon={UserX}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {target.is_suspended || target.account_status === 'suspended' ? (
                  <ActionBtn icon={UserCheck} label="Unsuspend account" hint="Restores sign-in and clears attempts" onClick={() => handleSuspend(false)} className="bg-vt-green/10 text-vt-green hover:bg-vt-green/20 border-vt-green/20" />
                ) : (
                  <ActionBtn icon={UserX} label="Suspend account" hint="Temporarily blocks all sign-ins" onClick={() => handleSuspend(true)} className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20" />
                )}
                <ActionBtn
                  icon={Ban}
                  label={target.account_status === 'blocked' ? 'Unblock user' : 'Block user'}
                  hint={target.account_status === 'blocked' ? 'Restore full access' : 'Permanent restriction'}
                  onClick={handleBlock}
                  className={target.account_status === 'blocked'
                    ? 'bg-vt-green/10 text-vt-green hover:bg-vt-green/20 border-vt-green/20'
                    : 'bg-vt-amber/10 text-vt-amber hover:bg-vt-amber/20 border-vt-amber/20'}
                />
              </div>
            </SectionCard>

            {/* Security & Recovery */}
            <SectionCard
              title="Security & recovery"
              subtitle="Reset credentials, OTP throttles, and active sessions."
              icon={ShieldCheck}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ActionBtn icon={KeyRound} label="Reset password" hint="Sets password to user's mobile number" onClick={handleResetPassword} className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20" />
                <ActionBtn icon={LogOut} label="Force logout" hint="Signs them out of all devices" onClick={handleForceLogout} className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20" />
                {isMaster && (
                  <ActionBtn
                    icon={RotateCcw}
                    label="Reset OTP attempts"
                    hint="Grants 5 fresh OTPs (master only)"
                    onClick={handleResetOtpAttempts}
                    className="bg-vt-amber/10 text-vt-amber hover:bg-vt-amber/20 border-vt-amber/20"
                  />
                )}
              </div>
            </SectionCard>

            {/* Danger Zone */}
            <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-red-400">Danger zone</h3>
                  <p className="text-xs text-muted-foreground">Irreversible actions. Proceed carefully.</p>
                </div>
              </div>
              <ActionBtn
                icon={Trash2}
                label="Delete user permanently"
                hint="Removes account, chats, statuses, and uploads"
                onClick={openDeleteDialog}
                className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30 w-full"
              />
            </div>
          </>
        )}

        {/* Consent & Compliance — always visible to admins, including for self/master */}
          <SectionCard
            title="Consent & compliance"
            subtitle="Audit log of what this user accepted, and when. Used for DPDP / GDPR / CAN-SPAM compliance."
            icon={FileText}
          >
            <div className="grid grid-cols-1 gap-2">
              <ConsentRow
                icon={FileText}
                label="Terms & Conditions"
                acceptedAt={target.terms_accepted_at}
                pendingText="Not yet accepted"
              />
              <ConsentRow
                icon={ShieldCheck}
                label="Privacy Policy"
                acceptedAt={target.privacy_accepted_at}
                pendingText="Not yet accepted"
              />
              <ConsentRow
                icon={Megaphone}
                label="Promotional emails"
                acceptedAt={target.marketing_consent_at}
                pendingText="No choice recorded yet"
                stateText={
                  target.marketing_consent_at
                    ? (target.email_marketing_opt_in ? 'Opted IN' : 'Opted OUT')
                    : null
                }
                positive={!!target.email_marketing_opt_in}
                extra={
                  target.marketing_consent_source
                    ? `Source: ${target.marketing_consent_source}${target.marketing_consent_ip ? ` · IP ${target.marketing_consent_ip}` : ''}`
                    : null
                }
              />
            </div>
          </SectionCard>

        {/* Guardian information — only for under-18 users */}
        {guardian && (
          <SectionCard
            title="Guardian information"
            subtitle="DPDP §9 verifiable parental consent record. Retained for audit; automatically retired at age 18."
            icon={ShieldCheck}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Info label="Guardian name" value={guardian.guardian_name || '—'} />
              <Info label="Guardian mobile" value={guardian.guardian_mobile || '—'} />
              <Info label="Guardian email" value={guardian.guardian_email || '—'} />
              <Info label="Relationship" value={guardian.relationship || '—'} />
              <Info
                label="Verified at"
                value={guardian.email_verified_at ? new Date(guardian.email_verified_at).toLocaleString() : 'Not verified'}
              />
              <Info label="IP address" value={guardian.ip || '—'} />
              <Info label="User agent" value={guardian.user_agent || '—'} />
              <Info label="Consent version" value={guardian.consent_version || '—'} />
              <Info label="Minor user ID" value={guardian.minor_user_id || userId} />
              <Info
                label="Consented at"
                value={guardian.consented_at ? new Date(guardian.consented_at).toLocaleString() : 'Pending'}
                colorClass={guardian.consented_at ? 'text-vt-green' : 'text-vt-amber'}
              />
              {guardian.revoked_at && (
                <Info
                  label="Revoked at"
                  value={new Date(guardian.revoked_at).toLocaleString()}
                  colorClass="text-red-400"
                />
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-2xl border border-border p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground">Edit User Info</h3>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {(['full_name', 'email', 'mobile_number'] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground mb-1 block capitalize">{field.replace('_', ' ')}</label>
                  <input
                    type="text"
                    value={editForm[field]}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Country code</label>
                <select
                  value={editForm.country_code}
                  onChange={e => setEditForm(f => ({ ...f, country_code: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground"
                >
                  {COUNTRIES.map(c => (
                    <option key={`${c.iso2}-${c.dial}`} value={c.dial}>{c.name} ({c.dial})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground">Cancel</button>
              <button onClick={handleSaveEdit} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium gradient-primary text-white">
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offboarding reason dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-2xl border border-red-500/40 p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground">Offboard user permanently</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a reason. The user will receive an email explaining the
                  outcome. This action cannot be undone.
                </p>
              </div>
              <button onClick={() => setDeleteOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            <div className="space-y-2 mb-5">
              {([
                { key: 'general', label: 'General', hint: 'Removed per platform policies (no specific reason disclosed).' },
                { key: 'terms_breach', label: 'Breach of Terms & Conditions', hint: 'User will be told their account violated the Terms.' },
                { key: 'incomplete_signup', label: 'Incomplete Sign-up', hint: 'User will be told sign-up was not completed in time.' },
              ] as const).map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    deleteReason === opt.key ? 'border-red-500/60 bg-red-500/10' : 'border-border bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="offboard_reason"
                    className="mt-1 accent-red-500"
                    checked={deleteReason === opt.key}
                    onChange={() => setDeleteReason(opt.key)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground mb-4">
              Personal data will be deleted or retained in accordance with
              applicable law (DPDP Act, 2023), our Privacy Policy, and legal
              obligations for security, fraud prevention and dispute resolution.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading || !deleteReason}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} /> {actionLoading ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Info({ label, value, colorClass = 'text-foreground' }: any) {
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-medium mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, warn = false }: any) {
  return (
    <div className={`glass rounded-2xl border p-3 ${warn ? 'border-orange-500/30' : 'border-border'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={warn ? 'text-orange-400' : 'text-muted-foreground'} />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm font-bold ${warn ? 'text-orange-400' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children }: any) {
  return (
    <div className="glass rounded-2xl border border-border p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, hint, onClick, className }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-left flex items-start gap-3 px-3.5 py-3 rounded-xl border text-sm font-semibold transition-all ${className}`}
    >
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-[10px] font-normal opacity-70 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function ConsentRow({
  icon: Icon,
  label,
  acceptedAt,
  pendingText,
  stateText,
  positive,
  extra,
}: {
  icon: any;
  label: string;
  acceptedAt: string | null | undefined;
  pendingText: string;
  stateText?: string | null;
  positive?: boolean;
  extra?: string | null;
}) {
  const has = !!acceptedAt;
  const when = acceptedAt
    ? new Date(acceptedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;
  return (
    <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-border bg-muted/30">
      <Icon size={16} className="mt-0.5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {stateText && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
              positive ? 'bg-vt-green/20 text-vt-green' : 'bg-red-500/20 text-red-400'
            }`}>{stateText}</span>
          )}
          {!has && !stateText && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-muted text-muted-foreground">Pending</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${has ? 'text-foreground/80' : 'text-muted-foreground'}`}>
          {has ? when : pendingText}
        </p>
        {extra && <p className="text-[11px] text-muted-foreground mt-0.5">{extra}</p>}
      </div>
    </div>
  );
}
