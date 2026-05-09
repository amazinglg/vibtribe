// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Shield, Users, Activity, Search, Ban, Trash2, RefreshCw, AlertTriangle, CheckCircle2, ArrowLeft, KeyRound, Pencil, X, Save, Ticket, UserX, UserCheck, Send, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface PlatformUser {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  role: string;
  account_status: string;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  profile_completed: boolean;
  is_suspended?: boolean;
  login_attempts?: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  onlineNow: number;
}

interface EditForm {
  full_name: string;
  email: string;
  mobile_number: string;
}

interface SupportTicket {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  issue_title: string;
  issue_description: string;
  ticket_status: 'open' | 'inprocess' | 'solved';
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const TICKET_STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400' },
  inprocess: { label: 'In Process', color: 'bg-vt-amber/20 text-vt-amber' },
  solved: { label: 'Solved', color: 'bg-vt-green/20 text-vt-green' },
};

export default function AdminPage() {
  const router = useNavigate();
  const { user, profile, isAdmin, loading } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, onlineNow: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'support'>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ full_name: '', email: '', mobile_number: '' });

  // Support state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'inprocess' | 'solved'>('all');
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [forceLogoutLoading, setForceLogoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) { router({ to: '/sign-in', replace: true }); return; }
      if (!isAdmin?.()) { router({ to: '/', replace: true }); return; }
      loadData();
    }
  }, [user, loading]);

  useEffect(() => {
    if (activeTab === 'support') loadTickets();
  }, [activeTab]);

  // Real-time subscription for new tickets
  useEffect(() => {
    if (!user || !isAdmin?.()) return;
    const channel = supabase
      .channel('admin-support-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (payload) => {
        setUnreadTickets(prev => prev + 1);
        setTickets(prev => [payload.new as SupportTicket, ...prev]);
        toast.info(`🎫 New support ticket: "${(payload.new as SupportTicket).issue_title}"`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const allUsers = usersData || [];
      setUsers(allUsers);
      setStats({
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.account_status === 'active').length,
        onlineNow: allUsers.filter(u => u.is_online).length,
      });

      // Count unread (open) tickets
      const { count } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('ticket_status', 'open');
      setUnreadTickets(count || 0);
    } catch (err: any) {
      toast.error('Failed to load admin data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      setTickets(data || []);
      setUnreadTickets((data || []).filter(t => t.ticket_status === 'open').length);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: 'open' | 'inprocess' | 'solved') => {
    try {
      await supabase.from('support_tickets').update({ ticket_status: newStatus, updated_at: new Date().toISOString() }).eq('id', ticketId);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ticket_status: newStatus } : t));
      if (selectedTicket?.id === ticketId) setSelectedTicket(prev => prev ? { ...prev, ticket_status: newStatus } : null);
      toast.success(`Ticket status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update ticket status');
    }
  };

  const handleReplyTicket = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('support_tickets').update({
        admin_reply: replyText.trim(),
        replied_at: now,
        ticket_status: 'inprocess',
        updated_at: now,
      }).eq('id', selectedTicket.id);

      const updated = { ...selectedTicket, admin_reply: replyText.trim(), replied_at: now, ticket_status: 'inprocess' as const };
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
      setSelectedTicket(updated);
      setReplyText('');
      toast.success('Reply sent successfully');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleBlockUser = async (userId: string, currentStatus: string) => {
    setActionLoading(userId);
    try {
      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
      await supabase.from('user_profiles').update({ account_status: newStatus }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_status: newStatus } : u));
      toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'} successfully`);
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, account_status: newStatus } : null);
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendUser = async (userId: string, suspend: boolean) => {
    setActionLoading(userId);
    try {
      const updates: any = {
        is_suspended: suspend,
        account_status: suspend ? 'suspended' : 'active',
      };
      if (!suspend) {
        updates.login_attempts = 0; // Reset attempts on unsuspend
      }
      await supabase.from('user_profiles').update(updates).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
      toast.success(suspend ? 'User suspended' : 'User unsuspended — login attempts reset');
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    setActionLoading(userId);
    try {
      await supabase.from('user_profiles').delete().eq('id', userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSelectedUser(null);
      toast.success('User deleted successfully');
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (targetUser: PlatformUser) => {
    if (!targetUser.mobile_number) {
      toast.error('User has no mobile number to reset password to');
      return;
    }
    if (!confirm(`Reset password for ${targetUser.full_name || 'this user'} to their mobile number?`)) return;
    setActionLoading(targetUser.id);
    try {
      const { error } = await supabase.rpc('admin_reset_user_password' as any, {
        target_user_id: targetUser.id,
        new_password: targetUser.mobile_number,
      });
      if (error) throw error;
      toast.success(`Password reset to mobile number for ${targetUser.full_name || 'user'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset password');
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceLogout = async (targetUser: PlatformUser) => {
    if (!confirm(`Force logout ${targetUser.full_name || 'this user'} from all devices? They will be signed out immediately.`)) return;
    setForceLogoutLoading(targetUser.id);
    try {
      // Insert a force_logout_token for the user — their client will detect it and sign out
      const { error } = await supabase
        .from('force_logout_tokens')
        .insert({ user_id: targetUser.id, issued_by: user?.id });
      if (error) throw error;
      toast.success(`Force logout issued for ${targetUser.full_name || 'user'} — they will be signed out within 30 seconds`);
    } catch (err: any) {
      toast.error('Failed to issue force logout: ' + (err.message || 'Unknown error'));
    } finally {
      setForceLogoutLoading(null);
    }
  };

  const openEdit = (u: PlatformUser) => {
    setEditForm({ full_name: u.full_name || '', email: u.email || '', mobile_number: u.mobile_number || '' });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setActionLoading(selectedUser.id);
    try {
      await supabase.from('user_profiles').update({
        full_name: editForm.full_name,
        email: editForm.email,
        mobile_number: editForm.mobile_number,
      }).eq('id', selectedUser.id);
      const updated = { ...selectedUser, ...editForm };
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      setSelectedUser(updated);
      setEditOpen(false);
      toast.success('User info updated successfully');
    } catch {
      toast.error('Failed to update user info');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.mobile_number?.includes(search)
  );

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.issue_title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.name.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchesFilter = ticketFilter === 'all' || t.ticket_status === ticketFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading || loadingData) {
    return (
      <div className="gradient-bg-page min-h-screen flex items-center justify-center">
        <div className="text-center float-up">
          <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 glow-primary animate-pulse">
            <Shield size={28} className="text-white" />
          </div>
          <p className="text-muted-foreground text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => window.history.back()} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-vt-amber/20 rounded-2xl flex items-center justify-center">
              <Shield size={20} className="text-vt-amber" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Master control — {profile?.full_name}</p>
            </div>
          </div>
          <button onClick={loadData} className="ml-auto p-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-muted rounded-xl mb-6 w-fit">
          {(['overview', 'users', 'support'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'support' ? 'Support' : tab}
              {tab === 'support' && unreadTickets > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadTickets > 9 ? '9+' : unreadTickets}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'gradient-primary', glow: 'glow-primary' },
                { label: 'Active Users', value: stats.activeUsers, icon: CheckCircle2, color: 'gradient-cyan', glow: '' },
                { label: 'Online Now', value: stats.onlineNow, icon: Activity, color: 'gradient-tri', glow: '' },
              ].map((stat) => (
                <div key={stat.label} className="glass rounded-xl border border-border p-2.5 sm:p-4 card-3d flex flex-col items-center text-center sm:items-start sm:text-left">
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 ${stat.color} rounded-lg flex items-center justify-center mb-1.5 sm:mb-2 ${stat.glow}`}>
                    <stat.icon size={14} className="text-white" />
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="glass rounded-2xl border border-border p-5">
              <h2 className="font-bold text-base text-foreground mb-4">Recent Signups</h2>
              <div className="space-y-3">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router({ to: '/admin/user/$userId', params: { userId: u.id } })}>
                    <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {u.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email || u.mobile_number}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.account_status === 'active' ? 'bg-vt-green/20 text-vt-green' :
                        u.account_status === 'suspended' ? 'bg-orange-500/20 text-orange-400' :
                        u.account_status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {u.account_status}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="flex flex-col gap-6">
            {/* User List */}
            <div className="flex-1 glass rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or mobile..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-border/30 hover:bg-muted/50 ${selectedUser?.id === u.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {u.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      {u.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-vt-green rounded-full border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'Unknown'}</p>
                        {u.role === 'admin' && <span className="text-[10px] bg-vt-amber/20 text-vt-amber px-1.5 py-0.5 rounded-full font-medium">Admin</span>}
                        {u.is_suspended && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-medium">Suspended</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email || u.mobile_number}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      u.account_status === 'active' ? 'bg-vt-green/20 text-vt-green' :
                      u.account_status === 'suspended' ? 'bg-orange-500/20 text-orange-400' :
                      u.account_status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {u.account_status}
                    </span>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Users size={32} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No users found</p>
                  </div>
                )}
              </div>
            </div>

            {/* User Detail Panel */}
            {selectedUser && (
              <div className="w-full lg:w-80 flex-shrink-0 glass rounded-2xl border border-border p-5 float-up overflow-y-auto max-h-[calc(100dvh-220px)] lg:max-h-[calc(100vh-200px)] pb-24 lg:pb-5">
                <div className="flex lg:hidden justify-end mb-2">
                  <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {selectedUser.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{selectedUser.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.role}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground text-xs truncate max-w-[160px]">{selectedUser.email || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobile</span>
                    <span className="text-foreground text-xs">{selectedUser.mobile_number || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`text-xs font-medium ${
                      selectedUser.account_status === 'active' ? 'text-vt-green' :
                      selectedUser.account_status === 'suspended' ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {selectedUser.account_status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Login Attempts</span>
                    <span className={`text-xs font-medium ${(selectedUser.login_attempts || 0) >= 3 ? 'text-red-400' : 'text-foreground'}`}>
                      {selectedUser.login_attempts || 0} / 5
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Suspended</span>
                    <span className={`text-xs ${selectedUser.is_suspended ? 'text-orange-400' : 'text-vt-green'}`}>
                      {selectedUser.is_suspended ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Online</span>
                    <span className={`text-xs ${selectedUser.is_online ? 'text-vt-green' : 'text-muted-foreground'}`}>
                      {selectedUser.is_online ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signed Up</span>
                    <span className="text-foreground text-xs">{new Date(selectedUser.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedUser.id !== user?.id ? (
                    <>
                      <button onClick={() => openEdit(selectedUser)} disabled={actionLoading === selectedUser.id}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                        <Pencil size={14} />Edit User Info
                      </button>

                      {/* Suspend / Unsuspend */}
                      {selectedUser.is_suspended || selectedUser.account_status === 'suspended' ? (
                        <button onClick={() => handleSuspendUser(selectedUser.id, false)} disabled={actionLoading === selectedUser.id}
                          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-vt-green/10 text-vt-green hover:bg-vt-green/20 transition-all">
                          <UserCheck size={14} />Unsuspend Account
                        </button>
                      ) : (
                        <button onClick={() => handleSuspendUser(selectedUser.id, true)} disabled={actionLoading === selectedUser.id}
                          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all">
                          <UserX size={14} />Suspend Account
                        </button>
                      )}

                      <button onClick={() => handleBlockUser(selectedUser.id, selectedUser.account_status)} disabled={actionLoading === selectedUser.id}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          selectedUser.account_status === 'blocked' ? 'bg-vt-green/10 text-vt-green hover:bg-vt-green/20' : 'bg-vt-amber/10 text-vt-amber hover:bg-vt-amber/20'
                        }`}>
                        <Ban size={14} />
                        {selectedUser.account_status === 'blocked' ? 'Unblock User' : 'Block User'}
                      </button>

                      <button onClick={() => handleResetPassword(selectedUser)} disabled={actionLoading === selectedUser.id}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">
                        <KeyRound size={14} />Reset Password
                      </button>

                      <button
                        onClick={() => handleForceLogout(selectedUser)}
                        disabled={forceLogoutLoading === selectedUser.id}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all disabled:opacity-50"
                      >
                        <LogOut size={14} />
                        {forceLogoutLoading === selectedUser.id ? 'Issuing...' : 'Force Logout (All Devices)'}
                      </button>

                      <button onClick={() => handleDeleteUser(selectedUser.id)} disabled={actionLoading === selectedUser.id}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                        <Trash2 size={14} />Delete User
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                      <AlertTriangle size={14} className="text-primary flex-shrink-0" />
                      <p className="text-xs text-primary">This is your own account</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="flex flex-col gap-6">
            {/* Ticket List */}
            <div className="flex-1 glass rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={ticketSearch}
                    onChange={e => setTicketSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(['all', 'open', 'inprocess', 'solved'] as const).map(f => (
                    <button key={f} onClick={() => setTicketFilter(f)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${ticketFilter === f ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                      {f === 'all' ? 'All' : f === 'inprocess' ? 'In Process' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {loadingTickets ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[calc(100dvh-340px)] lg:max-h-[calc(100vh-300px)]">
                  {filteredTickets.map(ticket => {
                    const cfg = TICKET_STATUS_CONFIG[ticket.ticket_status] || TICKET_STATUS_CONFIG.open;
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => { setSelectedTicket(ticket); setReplyText(ticket.admin_reply || ''); }}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all border-b border-border/30 hover:bg-muted/50 ${selectedTicket?.id === ticket.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                      >
                        <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">
                          {ticket.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-foreground truncate">{ticket.issue_title}</p>
                            {!ticket.admin_reply && ticket.ticket_status === 'open' && (
                              <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{ticket.name} · {ticket.email}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                  {filteredTickets.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <Ticket size={32} className="text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No tickets found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ticket Detail Modal */}
        {selectedTicket && activeTab === 'support' && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setSelectedTicket(null)}>
            <div
              className="glass-strong rounded-t-3xl sm:rounded-3xl border border-border w-full max-w-lg float-up flex flex-col gap-4 p-5 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground text-base truncate">{selectedTicket.issue_title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedTicket.name} · {selectedTicket.email}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(selectedTicket.created_at).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <X size={18} />
                </button>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Change Status</p>
                <div className="flex gap-2">
                  {(['open', 'inprocess', 'solved'] as const).map(s => {
                    const cfg = TICKET_STATUS_CONFIG[s];
                    return (
                      <button key={s} onClick={() => handleUpdateTicketStatus(selectedTicket.id, s)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          selectedTicket.ticket_status === s ? `${cfg.color} border-current` : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                        }`}>
                        {s === 'inprocess' ? 'In Process' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Issue Description</p>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{selectedTicket.issue_description}</p>
                </div>
              </div>

              {selectedTicket.admin_reply && (
                <div>
                  <p className="text-xs text-primary mb-1.5 font-medium">Your Previous Reply</p>
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{selectedTicket.admin_reply}</p>
                    {selectedTicket.replied_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(selectedTicket.replied_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                  {selectedTicket.admin_reply ? 'Update Reply' : 'Send Reply'}
                </p>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply to the user..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                />
                <button
                  onClick={handleReplyTicket}
                  disabled={replyLoading || !replyText.trim()}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {replyLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending...</span></>
                  ) : (
                    <><Send size={14} /><span>Send Reply</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl border border-border p-6 w-full max-w-sm mx-4 float-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground">Edit User Info</h3>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
                <input type="text" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Mobile Number</label>
                <input type="text" value={editForm.mobile_number} onChange={e => setEditForm(f => ({ ...f, mobile_number: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground hover:text-foreground transition-all">Cancel</button>
              <button onClick={handleSaveEdit} disabled={actionLoading === selectedUser.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium gradient-primary text-white hover:opacity-90 transition-all">
                <Save size={14} />Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
