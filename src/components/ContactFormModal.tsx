import React, { useEffect, useState } from 'react';
import { X, Send, Loader2, CheckCircle2, AlertCircle, Headphones, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORIES = [
  'General question',
  'Account & login',
  'Bug / technical issue',
  'Payments & billing',
  'Feature request',
  'Partnership',
  'Privacy / data',
  'Other',
];

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  external?: boolean; // true when shown on a public/landing page (no auth required)
}

export default function ContactFormModal({ open, onClose, external = false }: ContactFormModalProps) {
  const auth = (() => { try { return useAuth(); } catch { return { user: null, profile: null } as any; } })();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSuccess(false);
    setError('');
    if (!external && user && profile) {
      setName(profile.full_name || '');
      const realEmail = (profile.real_email && !profile.real_email.endsWith('@vibetribe.app'))
        ? profile.real_email
        : (profile.email && !profile.email.endsWith('@vibetribe.app') ? profile.email : '');
      setEmail(realEmail || '');
    }
  }, [open, external, user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !title.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const isExternal = external || !user;
      const { error: insertError } = await supabase.from('support_tickets').insert({
        user_id: isExternal ? null : user!.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        issue_title: title.trim(),
        issue_description: description.trim(),
        category,
        is_external: isExternal,
        username_snapshot: !isExternal ? (profile?.username || null) : null,
        mobile_snapshot: !isExternal ? (profile?.mobile_number || null) : null,
        country_code_snapshot: !isExternal ? (profile?.country_code || null) : null,
        ticket_status: 'open',
      } as any);
      if (insertError) throw insertError;
      setSuccess(true);
      setTitle('');
      setDescription('');
      if (isExternal) { setName(''); setEmail(''); }
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-strong rounded-3xl border border-border w-full max-w-md float-up overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
              <Headphones size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Contact us</h2>
              <p className="text-xs text-muted-foreground">We typically reply within 24 hours</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
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
              <h3 className="font-bold text-foreground text-lg mb-2">Thanks — we got it!</h3>
              <p className="text-sm text-muted-foreground mb-1">Our team will get back to you at <span className="text-foreground font-medium">{email}</span>.</p>
              {!external && user && (
                <p className="text-xs text-primary mt-2">You can also track your ticket in Profile → My Tickets.</p>
              )}
              <button onClick={onClose} className="mt-5 px-6 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all">Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your name *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Full name" maxLength={120}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" maxLength={255}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                {external && (
                  <p className="text-[10px] text-muted-foreground mt-1">No verification needed — we'll reply to this address.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category *</label>
                <select
                  value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Subject *</label>
                <input
                  type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Brief summary" maxLength={200}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message *</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Tell us more..." rows={4} maxLength={4000}
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
                type="submit" disabled={loading}
                className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /><span>Sending...</span></> : <><Send size={16} /><span>Send message</span></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}