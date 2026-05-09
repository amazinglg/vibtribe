import React, { useState, useEffect } from 'react';
import { Camera, Edit3, Shield, Bell, Lock, Smartphone, LogOut, Key, AlertTriangle, UserCheck, AtSign, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate as _useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';

function useRouter() {
  const navigate = _useNavigate();
  return {
    push: (to: string) => navigate({ to: to as any }),
    replace: (to: string) => navigate({ to: to as any, replace: true }),
    back: () => { if (typeof window !== 'undefined') window.history.back(); },
    refresh: () => {},
  };
}


type Tab = 'account' | 'privacy' | 'notifications' | 'devices';

export default function ProfileContent() {
  const router = useRouter();
  const { user, profile, updateProfile, updatePassword, signOut, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifStatus, setNotifStatus] = useState(true);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.full_name || '');
      setBio(profile.bio || '');
      setUsername(profile.username || '');
    }
  }, [profile]);

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'account', label: 'Account', icon: <Edit3 size={16} /> },
    { key: 'privacy', label: 'Privacy', icon: <Lock size={16} /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { key: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
  ];

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: displayName, bio, username: username.toLowerCase() });
      setEditMode(false);
      toast.success('Profile updated successfully ✓');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmNewPassword) { toast.error('Passwords do not match'); return; }
    setChangingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Password changed successfully ✓');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/sign-in');
    } catch {}
  };

  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V';

  return (
    <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
      {/* Profile Header */}
      <div className="glass rounded-3xl border border-border p-6 mb-6 relative overflow-hidden card-3d">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-48 h-48 gradient-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 gradient-cyan rounded-full blur-3xl" />
        </div>

        <div className="relative flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="status-ring-active p-0.5 rounded-full">
              <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-background">
                {avatarLetter}
              </div>
            </div>
            <button className="absolute bottom-0 right-0 w-7 h-7 gradient-cyan rounded-full flex items-center justify-center border-2 border-background text-white hover:opacity-80 transition-all">
              <Camera size={12} />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your_username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={2}
                    maxLength={150}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setDisplayName(profile?.full_name || ''); setBio(profile?.bio || ''); }}
                    className="px-4 py-2 glass border border-border text-sm font-semibold rounded-xl hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-bold text-xl text-foreground">{profile?.full_name || 'Your Name'}</h2>
                  {isAdmin?.() && (
                    <span className="text-xs bg-vt-amber/20 text-vt-amber px-2 py-0.5 rounded-full font-medium">Master Admin</span>
                  )}
                </div>
                {profile?.username && (
                  <p className="text-sm text-primary mb-1">@{profile.username}</p>
                )}
                <p className="text-sm text-muted-foreground mb-3">{profile?.bio || 'No bio yet'}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all glow-primary"
                  >
                    <Edit3 size={14} />
                    Edit Profile
                  </button>
                  {isAdmin?.() && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-4 py-2 bg-vt-amber/10 text-vt-amber text-sm font-semibold rounded-xl hover:bg-vt-amber/20 transition-all"
                    >
                      <Shield size={14} />
                      Admin Panel
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab Nav */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="glass rounded-2xl border border-border p-2 flex flex-row lg:flex-col gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  activeTab === tab.key ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.icon}
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all mt-auto"
            >
              <LogOut size={16} />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === 'account' && (
            <div className="space-y-4">
              {/* Account Info */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-4">Account Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mobile Number</p>
                      <p className="text-sm text-foreground font-medium">{profile?.mobile_number || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <AtSign size={16} className="text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Username</p>
                      <p className="text-sm text-foreground font-medium">{profile?.username ? `@${profile.username}` : 'Not set'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <UserCheck size={16} className="text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Member Since</p>
                      <p className="text-sm text-foreground font-medium">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-4 flex items-center gap-2">
                  <Key size={16} className="text-primary" />
                  Change Password
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmNewPassword}
                    className="px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glass rounded-2xl border border-red-500/20 p-5">
                <h3 className="font-semibold text-base text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Danger Zone
                </h3>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all"
                >
                  <LogOut size={14} />
                  Sign Out of All Devices
                </button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="glass rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-4">Privacy Settings</h3>
              <div className="space-y-4">
                {[
                  { label: 'Last Seen', desc: 'Show when you were last active', enabled: true },
                  { label: 'Read Receipts', desc: 'Show when you have read messages', enabled: true },
                  { label: 'Profile Photo', desc: 'Who can see your profile photo', enabled: true },
                  { label: 'Status Updates', desc: 'Who can see your 24h statuses', enabled: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all cursor-pointer ${item.enabled ? 'gradient-primary' : 'bg-muted'} relative`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.enabled ? 'right-1' : 'left-1'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="glass rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: 'New Messages', desc: 'Get notified for new chat messages', state: notifMessages, toggle: () => setNotifMessages(!notifMessages) },
                  { label: 'Status Updates', desc: 'Get notified when contacts post statuses', state: notifStatus, toggle: () => setNotifStatus(!notifStatus) },
                  { label: 'Mentions', desc: 'Get notified when someone mentions you', state: true, toggle: () => {} },
                  { label: 'Sounds', desc: 'Play sounds for notifications', state: true, toggle: () => {} },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <button
                      onClick={item.toggle}
                      className={`w-10 h-6 rounded-full transition-all ${item.state ? 'gradient-primary' : 'bg-muted'} relative`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.state ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="glass rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-4">Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
                    <Smartphone size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Current Device</p>
                    <p className="text-xs text-muted-foreground">Web Browser — Active now</p>
                  </div>
                  <span className="text-xs text-vt-green font-medium">Active</span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all"
              >
                <LogOut size={14} />
                Sign Out All Devices
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}