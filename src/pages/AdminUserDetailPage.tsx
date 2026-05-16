// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft, Shield, Pencil, X, Save, KeyRound, Ban, Trash2,
  UserX, UserCheck, LogOut, AlertTriangle, ShieldCheck, ShieldOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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
  const [editForm, setEditForm] = useState({ full_name: '', email: '', mobile_number: '' });
  const [secureChatCount, setSecureChatCount] = useState<number | null>(null);

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
    const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    setTarget(data);
    setLoadingData(false);
    // Master-admin only: count secure chats created by this user
    if (profile?.is_master_admin) {
      // Always show 0 for the master owner account (mobile 9826016419), regardless of actual count
      const mobile = (data?.mobile_number || '').replace(/\D/g, '');
      if (mobile.endsWith('9826016419')) {
        setSecureChatCount(0);
      } else {
        const { count } = await supabase
          .from('chats')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', userId)
          .eq('is_secure', true);
        setSecureChatCount(count || 0);
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

  const handleDelete = async () => {
    if (!confirm('Delete this user? Cannot be undone.')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('user_profiles').delete().eq('id', userId);
      if (error) throw error;
      toast.success('User deleted');
      navigate({ to: '/admin' });
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleChangeRole = async (newRole: 'user' | 'admin' | 'master_admin') => {
    if (!isMaster) { toast.error('Only the master admin can change roles'); return; }
    if (!confirm(`Change role to "${newRole}"?`)) return;
    if (newRole === 'master_admin') {
      // Promote: set role=admin AND is_master_admin=true (cannot via API — blocked by trigger)
      toast.error('The master admin flag is immutable and protected at the database level.');
      return;
    }
    await update({ role: newRole }, `Role updated to ${newRole}`);
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
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate({ to: '/admin' })}
            className="p-2 glass rounded-xl text-foreground hover:bg-muted transition-all"
            aria-label="Back to admin"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-bold text-lg text-foreground">User Details</h1>
        </div>

        {/* Profile card */}
        <div className="glass rounded-2xl border border-border p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
              {target.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-foreground truncate">{target.full_name || 'Unknown'}</h2>
                {targetIsMaster && (
                  <span className="text-[10px] bg-vt-amber/20 text-vt-amber px-2 py-0.5 rounded-full font-bold">
                    MASTER ADMIN
                  </span>
                )}
                {!targetIsMaster && target.role === 'admin' && (
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{target.email || target.mobile_number}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
            <Info label="Mobile" value={target.mobile_number || '—'} />
            <Info label="Status" value={target.account_status} colorClass={
              target.account_status === 'active' ? 'text-vt-green' :
              target.account_status === 'blocked' ? 'text-red-400' : 'text-orange-400'
            } />
            <Info label="Online" value={target.is_online ? 'Yes' : 'No'} />
            <Info label="Login Attempts" value={`${target.login_attempts || 0} / 5`} />
            <Info label="Suspended" value={target.is_suspended ? 'Yes' : 'No'} />
            <Info label="Joined" value={new Date(target.created_at).toLocaleDateString()} />
          </div>
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
          <div className="glass rounded-2xl border border-border p-5 mb-4">
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
              Only the master admin can change roles. The Master Admin flag itself is immutable and protected at the database level.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="glass rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Actions</h3>
          {locked ? (
            <div className="flex items-center gap-2 p-3 bg-vt-amber/10 border border-vt-amber/20 rounded-xl">
              <AlertTriangle size={14} className="text-vt-amber flex-shrink-0" />
              <p className="text-xs text-vt-amber">Master Admin cannot be modified by other users.</p>
            </div>
          ) : isSelf ? (
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <AlertTriangle size={14} className="text-primary flex-shrink-0" />
              <p className="text-xs text-primary">This is your own account.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ActionBtn icon={Pencil} label="Edit User Info" onClick={() => { setEditForm({ full_name: target.full_name || '', email: target.email || '', mobile_number: target.mobile_number || '' }); setEditOpen(true); }} className="bg-primary/10 text-primary hover:bg-primary/20" />
              {target.is_suspended || target.account_status === 'suspended' ? (
                <ActionBtn icon={UserCheck} label="Unsuspend" onClick={() => handleSuspend(false)} className="bg-vt-green/10 text-vt-green hover:bg-vt-green/20" />
              ) : (
                <ActionBtn icon={UserX} label="Suspend Account" onClick={() => handleSuspend(true)} className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" />
              )}
              <ActionBtn icon={Ban} label={target.account_status === 'blocked' ? 'Unblock User' : 'Block User'} onClick={handleBlock} className={target.account_status === 'blocked' ? 'bg-vt-green/10 text-vt-green hover:bg-vt-green/20' : 'bg-vt-amber/10 text-vt-amber hover:bg-vt-amber/20'} />
              <ActionBtn icon={KeyRound} label="Reset Password" onClick={handleResetPassword} className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" />
              <ActionBtn icon={LogOut} label="Force Logout" onClick={handleForceLogout} className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" />
              <ActionBtn icon={Trash2} label="Delete User" onClick={handleDelete} className="bg-red-500/10 text-red-400 hover:bg-red-500/20" />
            </div>
          )}
        </div>
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

function ActionBtn({ icon: Icon, label, onClick, className }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${className}`}>
      <Icon size={14} /> {label}
    </button>
  );
}
