// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Shield, Users, Activity, Search, Ban, Trash2, RefreshCw, AlertTriangle, CheckCircle2, ArrowLeft, KeyRound, Pencil, X, Save, Ticket, UserX, UserCheck, Send, LogOut, ChevronRight, Circle, ArrowUpDown, Filter, Lock, Globe, AtSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { replyToTicket, deleteTicket } from '@/lib/support.functions';
import TribeDetailsSheet from '@/components/TribeDetailsSheet';

interface PlatformUser {
  id: string;
  full_name: string;
  username?: string;
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
  category?: string | null;
  is_external?: boolean | null;
  username_snapshot?: string | null;
  mobile_snapshot?: string | null;
  country_code_snapshot?: string | null;
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
  const isMaster = !!profile?.is_master_admin || profile?.role === 'master_admin';
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, onlineNow: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tribes' | 'support' | 'marketing'>('overview');
  const [tribes, setTribes] = useState<any[]>([]);
  const [tribeSearch, setTribeSearch] = useState('');
  const [tribeSort, setTribeSort] = useState<'recent' | 'name' | 'members'>('recent');
  const [loadingTribes, setLoadingTribes] = useState(false);
  const [selectedTribeId, setSelectedTribeId] = useState<string | null>(null);
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
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'suspended' | 'blocked' | 'admins' | 'online'>('all');
  const [userSort, setUserSort] = useState<'recent' | 'name' | 'lastActive'>('recent');

  // Ticket thread state
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const replyFn = useServerFn(replyToTicket);
  const deleteFn = useServerFn(deleteTicket);

  const loadThread = async (ticketId: string) => {
    setLoadingThread(true);
    try {
      const { data } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      setThreadMessages(data || []);
    } catch {
      setThreadMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (selectedTicket) loadThread(selectedTicket.id);
    else setThreadMessages([]);
  }, [selectedTicket?.id]);

  const handleDeleteTicket = async (ticketId: string) => {
    setDeletingTicket(ticketId);
    try {
      await deleteFn({ data: { ticketId } });
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      setConfirmDeleteId(null);
      toast.success('Ticket permanently deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete ticket');
    } finally {
      setDeletingTicket(null);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { router({ to: '/sign-in', replace: true }); return; }
    // Wait until the profile has finished loading before deciding admin
    // status — otherwise master admins get bounced to "/" because
    // isAdmin() reads from a not-yet-populated profile.
    if (!profile) return;
    if (!isAdmin?.()) { router({ to: '/', replace: true }); return; }
    loadData();
  }, [user, loading, profile]);

  useEffect(() => {
    if (activeTab === 'support') loadTickets();
    if (activeTab === 'tribes') loadTribes();
  }, [activeTab]);

  // Auto-open ticket if ?ticket=<id> is in URL (from notification click)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('ticket');
    if (tid) {
      setActiveTab('support');
      (async () => {
        const { data } = await supabase.from('support_tickets').select('*').eq('id', tid).maybeSingle();
        if (data) {
          setSelectedTicket(data as any);
          setReplyText((data as any).admin_reply || '');
        }
      })();
    }
  }, []);

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
      // Use admin-only RPC — table SELECT is restricted to safe columns now.
      const { data: usersData } = await supabase.rpc('admin_list_user_profiles');

      const allUsers = usersData || [];
      setUsers(allUsers);
      // Online = active heartbeat within last 2 minutes (more accurate than stale is_online flag)
      const TWO_MIN = 2 * 60 * 1000;
      const now = Date.now();
      const onlineCount = allUsers.filter(u => {
        if (!u.last_seen) return false;
        return (now - new Date(u.last_seen).getTime()) < TWO_MIN;
      }).length;
      setStats({
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.account_status === 'active').length,
        onlineNow: onlineCount,
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

  const loadTribes = async () => {
    setLoadingTribes(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_tribes');
      if (error) throw error;
      setTribes(data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load tribes');
    } finally {
      setLoadingTribes(false);
    }
  };

  const filteredTribes = tribes
    .filter(t => {
      const q = tribeSearch.trim().toLowerCase();
      if (!q) return true;
      return (t.name || '').toLowerCase().includes(q) || (t.handle || '').toLowerCase().includes(q) || (t.founder_name || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (tribeSort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (tribeSort === 'members') return Number(b.member_count || 0) - Number(a.member_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
      const body = replyText.trim();
      const result = await replyFn({ data: { ticketId: selectedTicket.id, body } });
      const now = new Date().toISOString();
      const updated = { ...selectedTicket, admin_reply: body, replied_at: now, ticket_status: 'inprocess' as const };
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
      setSelectedTicket(updated);
      setReplyText('');
      await loadThread(selectedTicket.id);
      if (result?.emailQueued) toast.success('Reply sent — email queued to the user');
      else if (result?.emailError) toast.warning(`Reply saved. Email issue: ${result.emailError}`);
      else toast.success('Reply sent');
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
      const { adminDeleteUser } = await import('@/lib/admin-users.functions');
      await adminDeleteUser({ data: { userId } });
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSelectedUser(null);
      toast.success('User deleted successfully');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete user');
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

  const TWO_MIN = 2 * 60 * 1000;
  const isOnline = (u: PlatformUser) =>
    !!u.last_seen && (Date.now() - new Date(u.last_seen).getTime()) < TWO_MIN;

  const filteredUsers = users
    .filter(u => {
      const q = search.trim().toLowerCase();
      if (q && !(
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u as any).real_email?.toLowerCase().includes(q) ||
        u.mobile_number?.includes(search)
      )) return false;
      if (userFilter === 'active') return u.account_status === 'active' && !u.is_suspended;
      if (userFilter === 'suspended') return u.account_status === 'suspended' || u.is_suspended;
      if (userFilter === 'blocked') return u.account_status === 'blocked';
      if (userFilter === 'admins') return u.role === 'admin' || (u as any).is_master_admin;
      if (userFilter === 'online') return isOnline(u);
      return true;
    })
    .sort((a, b) => {
      if (userSort === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
      if (userSort === 'lastActive') {
        const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
        const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
        return tb - ta;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const userCounts = {
    all: users.length,
    active: users.filter(u => u.account_status === 'active' && !u.is_suspended).length,
    suspended: users.filter(u => u.account_status === 'suspended' || u.is_suspended).length,
    blocked: users.filter(u => u.account_status === 'blocked').length,
    admins: users.filter(u => u.role === 'admin' || (u as any).is_master_admin).length,
    online: users.filter(isOnline).length,
  };

  const relTime = (iso?: string) => {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.issue_title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.name.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchesFilter = ticketFilter === 'all' || t.ticket_status === ticketFilter;
    return matchesSearch && matchesFilter;
  });

  const getUserDetailUrl = (userId: string) => `/admin/user/${encodeURIComponent(userId)}`;

  const openUserDetails = (userId: string) => {
    router({ to: '/admin/user/$userId', params: { userId } });
  };

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

        {/* Tabs — single-line, horizontally scrollable on small screens */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-full sm:w-fit overflow-x-auto no-scrollbar">
          {(['overview', 'users', ...(isMaster ? ['tribes' as const] : []), 'support', 'marketing' as const, ...(isMaster ? ['permissions' as const] : [])] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'marketing') { router({ to: '/admin/marketing' }); return; }
                if (tab === 'permissions') { router({ to: '/admin/permissions' }); return; }
                setActiveTab(tab);
              }}
              className={`relative flex-shrink-0 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'support' ? 'Support' : tab === 'tribes' ? 'Tribes' : tab === 'marketing' ? 'Marketing' : tab === 'permissions' ? 'Permissions' : tab}
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
                  (() => {
                    const lockedRow = (u as any).is_master_admin && !isMaster;
                    const RowInner = (
                      <>
                    <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {u.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'Unknown'}</p>
                        {(u as any).is_master_admin && <span className="text-[9px] bg-vt-amber/20 text-vt-amber px-1.5 py-0.5 rounded-full font-bold">MASTER</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{(u as any).real_email || u.email || u.mobile_number}</p>
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
                      </>
                    );
                    return lockedRow ? (
                      <div key={u.id} title="Master admin — protected" className="flex items-center gap-3 p-3 rounded-xl bg-vt-amber/5 border border-vt-amber/20 opacity-90 cursor-not-allowed">
                        {RowInner}
                      </div>
                    ) : (
                      <a key={u.id} href={getUserDetailUrl(u.id)} onClick={(e) => { e.preventDefault(); openUserDetails(u.id); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                        {RowInner}
                      </a>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="glass rounded-2xl border border-border p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name, email, mobile…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="relative sm:w-44">
                  <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <select
                    value={userSort}
                    onChange={e => setUserSort(e.target.value as any)}
                    className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                  >
                    <option value="recent">Recently joined</option>
                    <option value="lastActive">Last active</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </div>
              </div>

              {/* Filter chips */}
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'online', label: 'Online', dot: 'bg-vt-green' },
                  { key: 'active', label: 'Active' },
                  { key: 'suspended', label: 'Suspended' },
                  { key: 'admins', label: 'Admins' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setUserFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      userFilter === f.key
                        ? 'gradient-primary text-white shadow'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {(f as any).dot && <span className={`w-1.5 h-1.5 rounded-full ${(f as any).dot}`} />}
                    <span>{f.label}</span>
                    <span className={`text-[10px] px-1.5 rounded-full ${userFilter === f.key ? 'bg-white/20 text-white' : 'bg-background/50 text-muted-foreground'}`}>
                      {userCounts[f.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Result count */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{filteredUsers.length} of {users.length} users</span>
              {(search || userFilter !== 'all') && (
                <button onClick={() => { setSearch(''); setUserFilter('all'); }} className="text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>

            {/* User list */}
            <div className="glass rounded-2xl border border-border overflow-hidden">
              <div className="overflow-y-auto max-h-[calc(100vh-360px)]">
                {filteredUsers.map(u => {
                  const lockedRow = (u as any).is_master_admin && !isMaster;
                  const online = isOnline(u);
                  const Inner = (
                    <>
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {u.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-vt-green rounded-full border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'Unknown'}</p>
                          {u.username && <span className="text-[11px] text-primary">@{u.username}</span>}
                          {(u as any).is_master_admin
                            ? <span className="text-[9px] bg-vt-amber/20 text-vt-amber px-1.5 py-0.5 rounded-full font-bold uppercase">Master</span>
                            : u.role === 'admin' && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium uppercase">Admin</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {(u as any).real_email || u.email || u.mobile_number || '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                          <Circle size={5} className={online ? 'fill-vt-green text-vt-green' : 'fill-muted-foreground/40 text-muted-foreground/40'} />
                          {online ? 'Online now' : `Last active ${relTime(u.last_seen)}`}
                          <span className="text-muted-foreground/30">·</span>
                          <span>Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          u.account_status === 'active' && !u.is_suspended ? 'bg-vt-green/20 text-vt-green' :
                          u.account_status === 'suspended' || u.is_suspended ? 'bg-orange-500/20 text-orange-400' :
                          u.account_status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {u.is_suspended ? 'suspended' : u.account_status}
                        </span>
                        {!lockedRow && <ChevronRight size={14} className="text-muted-foreground/50" />}
                      </div>
                    </>
                  );
                  return lockedRow ? (
                    <div key={u.id} title="Master admin — protected" className="flex items-center gap-3 px-4 py-3 cursor-not-allowed border-b border-border/30 bg-vt-amber/5">
                      {Inner}
                    </div>
                  ) : (
                    <a
                      key={u.id}
                      href={getUserDetailUrl(u.id)}
                      onClick={(e) => { e.preventDefault(); openUserDetails(u.id); }}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border/30 hover:bg-muted/50 transition-colors"
                    >
                      {Inner}
                    </a>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Users size={32} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No users match these filters</p>
                  </div>
                )}
              </div>
            </div>
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
                            {ticket.is_external ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-vt-amber/20 text-vt-amber border border-vt-amber/40 flex-shrink-0">EXTERNAL</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/20 text-primary border border-primary/40 flex-shrink-0">MEMBER</span>
                            )}
                            {!ticket.admin_reply && ticket.ticket_status === 'open' && (
                              <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {ticket.name} · {ticket.email}
                            {ticket.category ? ` · ${ticket.category}` : ''}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(ticket.id); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete ticket permanently"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-foreground text-base truncate">{selectedTicket.issue_title}</h3>
                    {selectedTicket.is_external ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-vt-amber/20 text-vt-amber">EXTERNAL</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-primary/20 text-primary">MEMBER</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {selectedTicket.name} · {selectedTicket.email}
                    {selectedTicket.username_snapshot ? ` · @${selectedTicket.username_snapshot}` : ''}
                    {selectedTicket.mobile_snapshot ? ` · ${selectedTicket.country_code_snapshot || ''}${selectedTicket.mobile_snapshot}` : ''}
                  </p>
                  {selectedTicket.category && (
                    <p className="text-[10px] text-primary mt-0.5">Category: {selectedTicket.category}</p>
                  )}
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
                  Conversation
                </p>
                <div className="bg-muted/30 border border-border rounded-xl p-3 max-h-72 overflow-y-auto flex flex-col gap-2 mb-3">
                  {loadingThread ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
                  ) : threadMessages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No replies yet. Send the first message below.</p>
                  ) : (
                    threadMessages.map(m => (
                      <div key={m.id} className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.sender_type === 'admin' ? 'bg-primary text-white rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm'}`}>
                          <p className="text-[10px] font-semibold opacity-80 mb-0.5">{m.sender_type === 'admin' ? (m.sender_name || 'Support') : 'User'}</p>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          <p className="text-[9px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Reply to user</p>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply to the user..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleReplyTicket}
                    disabled={replyLoading || !replyText.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {replyLoading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending...</span></>
                    ) : (
                      <><Send size={14} /><span>Send Reply</span></>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(selectedTicket.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all"
                    title="Delete ticket permanently"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteId(null)}>
            <div className="glass-strong rounded-2xl border border-border p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <h3 className="font-bold text-foreground">Delete ticket permanently?</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">This will permanently remove the ticket and its entire conversation history from the database. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted">Cancel</button>
                <button
                  onClick={() => handleDeleteTicket(confirmDeleteId)}
                  disabled={deletingTicket === confirmDeleteId}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                >
                  {deletingTicket === confirmDeleteId ? 'Deleting…' : 'Delete forever'}
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

      {/* Tribes Tab content */}
      {activeTab === 'tribes' && isMaster && (
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 pb-28 lg:pb-6 flex flex-col gap-4">
          <div className="glass rounded-2xl border border-border p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tribe name, @handle, founder…"
                  value={tribeSearch}
                  onChange={e => setTribeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="relative sm:w-44">
                <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  value={tribeSort}
                  onChange={e => setTribeSort(e.target.value as any)}
                  className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="recent">Recently created</option>
                  <option value="members">Most members</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredTribes.length} of {tribes.length} tribes</span>
            <button onClick={loadTribes} className="text-primary hover:underline">Refresh</button>
          </div>

          <div className="glass rounded-2xl border border-border overflow-hidden">
            {loadingTribes ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[calc(100vh-360px)]">
                {filteredTribes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTribeId(t.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    {t.avatar_url ? (
                      <img src={t.avatar_url} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(t.name || 'T')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{t.name || 'Untitled tribe'}</p>
                        {t.handle && <span className="text-[11px] text-primary flex items-center gap-0.5"><AtSign size={10} />{t.handle}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5 ${t.privacy === 'public' ? 'bg-vt-green/15 text-vt-green' : 'bg-muted text-foreground'}`}>
                          {t.privacy === 'public' ? <Globe size={9} /> : <Lock size={9} />} {t.privacy}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">Founder: {t.founder_name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{t.member_count} member{Number(t.member_count) === 1 ? '' : 's'} · Created {new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/50" />
                  </button>
                ))}
                {filteredTribes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Users size={32} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No tribes found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTribeId && (
        <TribeDetailsSheet
          chatId={selectedTribeId}
          isOpen={!!selectedTribeId}
          onClose={() => { setSelectedTribeId(null); loadTribes(); }}
        />
      )}
    </AppLayout>
  );
}
