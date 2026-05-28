// @ts-nocheck
import React, { useState } from 'react';
import { HelpCircle, X, Send, Loader2, CheckCircle2, AlertCircle, Headphones, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface HelpButtonProps {
  variant?: 'floating' | 'inline' | 'topbar';
}

export default function HelpButton({ variant = 'floating' }: HelpButtonProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = () => {
    if (user && profile) {
      setName(profile.full_name || '');
      const displayEmail = profile.email && !profile.email.endsWith('@vibetribe.app')
        ? profile.email
        : (user.email && !user.email.endsWith('@vibetribe.app') ? user.email : '');
      setEmail(displayEmail || '');
    }
    setOpen(true);
    setSuccess(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !title.trim() || !description.trim()) {
      setError('Please fill in all fields');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('support_tickets').insert({
        user_id: user?.id || null,
        name: name.trim(),
        email: email.trim(),
        issue_title: title.trim(),
        issue_description: description.trim(),
        ticket_status: 'open',
        is_external: !user,
        username_snapshot: profile?.username || null,
        mobile_snapshot: profile?.mobile_number || null,
        country_code_snapshot: profile?.country_code || null,
      });
      if (insertError) throw insertError;

      // Notify admin via notifications table
      const { data: adminData } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (adminData) {
        await supabase.from('notifications').insert({
          user_id: adminData.id,
          type: 'support_ticket',
          title: '🎫 New Support Request',
          body: `${name.trim()} submitted: "${title.trim()}"`,
        });
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {variant === 'topbar' ? (
        <button
          onClick={handleOpen}
          className="p-2 sm:p-2.5 glass rounded-xl text-muted-foreground hover:text-primary transition-all"
          title="Help & Support"
          aria-label="Help & Support"
        >
          <HelpCircle size={18} />
        </button>
      ) : variant === 'floating' ? (
        <button
          onClick={handleOpen}
          className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-30 w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-lg glow-primary hover:opacity-90 transition-all"
          title="Help & Support"
        >
          <HelpCircle size={22} className="text-white" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 px-4 py-2 glass border border-border text-sm font-semibold rounded-xl hover:bg-muted transition-all text-foreground"
        >
          <Headphones size={15} className="text-primary" />
          Help & Support
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-3xl border border-border w-full max-w-md float-up overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
                  <Headphones size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-base">Help & Support</h2>
                  <p className="text-xs text-muted-foreground">We typically reply within 24 hours</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <a
                href="mailto:help.vibtribe.in@gmail.com"
                className="mb-4 flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-xl text-xs hover:bg-primary/15 transition-all"
              >
                <Mail size={14} className="text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Prefer email?</span>
                <span className="text-primary font-semibold break-all">help.vibtribe.in@gmail.com</span>
              </a>
              {success ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-vt-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-vt-green" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">Ticket Submitted!</h3>
                  <p className="text-sm text-muted-foreground mb-1">Your support request has been received.</p>
                  {user ? (
                    <p className="text-xs text-primary">You can track your ticket in Profile → More → My Tickets</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sign in to track your ticket and see our reply.</p>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-5 px-6 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Issue Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Brief summary of your issue"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Issue Description *</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      rows={4}
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /><span>Submitting...</span></>
                    ) : (
                      <><Send size={16} /><span>Submit Ticket</span></>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
