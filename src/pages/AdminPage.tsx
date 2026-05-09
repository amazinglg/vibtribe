import React, { useState, useEffect } from 'react';
import { useNavigate as _useNavigate } from '@tanstack/react-router';
import { Shield, Users, MessageCircle, Activity, Search, Ban, Trash2, RefreshCw, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { createClient } from '../../lib/supabase/client';
import { toast } from 'sonner';

function useRouter() {
  const navigate = _useNavigate();
  return {
    push: (to: string) => navigate({ to: to as any }),
    replace: (to: string) => navigate({ to: to as any, replace: true }),
    back: () => { if (typeof window !== 'undefined') window.history.back(); },
    refresh: () => {},
  };
}


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
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  onlineNow: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, isAdmin, loading } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, totalMessages: 0, onlineNow: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'messages'>('overview');

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace('/sign-in'); return; }
      if (!isAdmin?.()) { router.replace('/'); return; }
      loadData();
    }
  }, [user, loading]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      const allUsers = usersData || [];
      setUsers(allUsers);
      setStats({
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.account_status === 'active').length,
        totalMessages: msgCount || 0,
        onlineNow: allUsers.filter(u => u.is_online).length,
      });
    } catch (err: any) {
      toast.error('Failed to load admin data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSuspendUser = async (userId: string, currentStatus: string) => {
    setActionLoading(userId);
    try {
      const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
      await supabase.from('user_profiles').update({ account_status: newStatus }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_status: newStatus } : u));
      toast.success(`User ${newStatus === 'suspended' ? 'suspended' : 'unsuspended'} successfully`);
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, account_status: newStatus } : null);
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

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.mobile_number?.includes(search)
  );

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
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all">
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
          {(['overview', 'users', 'messages'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'gradient-primary', glow: 'glow-primary' },
                { label: 'Active Users', value: stats.activeUsers, icon: CheckCircle2, color: 'gradient-cyan', glow: '' },
                { label: 'Total Messages', value: stats.totalMessages, icon: MessageCircle, color: 'gradient-pink', glow: '' },
                { label: 'Online Now', value: stats.onlineNow, icon: Activity, color: 'gradient-tri', glow: '' },
              ].map((stat) => (
                <div key={stat.label} className="glass rounded-2xl border border-border p-5 card-3d">
                  <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3 ${stat.glow}`}>
                    <stat.icon size={20} className="text-white" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Users */}
            <div className="glass rounded-2xl border border-border p-5">
              <h2 className="font-bold text-base text-foreground mb-4">Recent Signups</h2>
              <div className="space-y-3">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setSelectedUser(u); setActiveTab('users'); }}>
                    <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {u.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email || u.mobile_number}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.account_status === 'active' ? 'bg-vt-green/20 text-vt-green' :
                      u.account_status === 'suspended'? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {u.account_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="flex gap-6">
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
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email || u.mobile_number}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      u.account_status === 'active' ? 'bg-vt-green/20 text-vt-green' :
                      u.account_status === 'suspended'? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
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
              <div className="w-80 flex-shrink-0 glass rounded-2xl border border-border p-5 float-up">
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
                    <span className={`text-xs font-medium ${selectedUser.account_status === 'active' ? 'text-vt-green' : 'text-red-400'}`}>
                      {selectedUser.account_status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Online</span>
                    <span className={`text-xs ${selectedUser.is_online ? 'text-vt-green' : 'text-muted-foreground'}`}>
                      {selectedUser.is_online ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined</span>
                    <span className="text-foreground text-xs">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profile</span>
                    <span className={`text-xs ${selectedUser.profile_completed ? 'text-vt-green' : 'text-vt-amber'}`}>
                      {selectedUser.profile_completed ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedUser.id !== user?.id && (
                    <>
                      <button
                        onClick={() => handleSuspendUser(selectedUser.id, selectedUser.account_status)}
                        disabled={actionLoading === selectedUser.id}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          selectedUser.account_status === 'suspended' ?'bg-vt-green/10 text-vt-green hover:bg-vt-green/20' :'bg-vt-amber/10 text-vt-amber hover:bg-vt-amber/20'
                        }`}
                      >
                        <Ban size={14} />
                        {selectedUser.account_status === 'suspended' ? 'Unsuspend User' : 'Suspend User'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(selectedUser.id)}
                        disabled={actionLoading === selectedUser.id}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 size={14} />
                        Delete User
                      </button>
                    </>
                  )}
                  {selectedUser.id === user?.id && (
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

        {activeTab === 'messages' && (
          <div className="glass rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle size={20} className="text-primary" />
              <h2 className="font-bold text-base text-foreground">Platform Messages</h2>
              <span className="ml-auto text-sm text-muted-foreground">{stats.totalMessages} total</span>
            </div>
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <MessageCircle size={40} className="text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Message analytics coming soon</p>
              <p className="text-xs text-muted-foreground">Total messages on platform: <span className="text-foreground font-semibold">{stats.totalMessages}</span></p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
