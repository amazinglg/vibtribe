import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Server, Bell, CheckCircle2 } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/subprocessors')({
  head: () => ({
    meta: [
      { title: 'Subprocessors — VibTribe' },
      { name: 'description', content: 'The third-party service providers VibTribe uses to operate the platform, their purpose and processing region. Subscribe to change notifications.' },
      { property: 'og:title', content: 'VibTribe Subprocessors' },
      { property: 'og:description', content: 'Public list of subprocessors VibTribe uses, with purpose and region.' },
    ],
  }),
  component: SubprocessorsPage,
});

type Sub = { name: string; purpose: string; region: string; dpa: string };

const SUBS: Sub[] = [
  { name: 'Lovable Cloud (Supabase)', purpose: 'Application database, authentication, file storage, server runtime', region: 'EU / global edge', dpa: 'Standard DPA on file' },
  { name: 'Cloudflare', purpose: 'CDN, DDoS protection, edge delivery', region: 'Global edge', dpa: 'Standard DPA on file' },
  { name: 'Google Firebase Cloud Messaging', purpose: 'Push notifications to Android devices', region: 'Global (US-based)', dpa: 'Google Cloud DPA' },
  { name: 'Apple Push Notification Service', purpose: 'Push notifications to iOS devices', region: 'Global (US-based)', dpa: 'Apple Developer Agreement' },
  { name: 'Resend', purpose: 'Transactional & marketing email delivery', region: 'US / EU', dpa: 'Resend DPA' },
  { name: 'Google Tag Manager / Analytics', purpose: 'Anonymised product analytics (consent-gated)', region: 'Global (US-based)', dpa: 'Google Ads Data Processing Terms' },
  { name: 'SMS OTP provider', purpose: 'One-time passcode delivery for sign-in', region: 'India', dpa: 'Standard DPA on file' },
];

function SubprocessorsPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('subprocessor_subscribers').insert({ email: email.trim().toLowerCase() });
      if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
      setDone(true);
      toast.success('Subscribed — we will email you on subprocessor changes.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not subscribe right now');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen gradient-bg-page text-foreground overflow-x-hidden relative"
      style={{
        paddingTop: 'min(var(--safe-top), 2.25rem)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      <div className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] gradient-cyan rounded-full blur-3xl opacity-20" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[24rem] h-[24rem] gradient-pink rounded-full blur-3xl opacity-10" />

      <header className="relative z-20">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <AppLogo size={32} />
            <Wordmark className="text-lg sm:text-xl" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-border text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all">
            <ArrowLeft size={14} /> Home
          </Link>
        </nav>
      </header>

      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-border text-[11px] font-semibold uppercase tracking-widest text-primary mb-4">
          <Server size={14} /> Subprocessors
        </div>
        <h1 className="font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight">Who helps us run VibTribe</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          We use a small number of trusted third-party service providers ("subprocessors") to deliver VibTribe. Each one has a contractual data-protection agreement and processes only what's needed for its purpose.
        </p>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="glass rounded-3xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-semibold">Subprocessor</th>
                  <th className="text-left p-3 font-semibold">Purpose</th>
                  <th className="text-left p-3 font-semibold">Region</th>
                  <th className="text-left p-3 font-semibold">DPA</th>
                </tr>
              </thead>
              <tbody>
                {SUBS.map((s, i) => (
                  <tr key={i} className="border-t border-border/60 align-top">
                    <td className="p-3 font-semibold text-foreground">{s.name}</td>
                    <td className="p-3 text-muted-foreground">{s.purpose}</td>
                    <td className="p-3 text-muted-foreground">{s.region}</td>
                    <td className="p-3 text-muted-foreground">{s.dpa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="glass rounded-3xl border border-border p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={18} className="text-primary" />
            <h2 className="font-bold text-lg">Get notified about changes</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            We notify subscribers at least 30 days before adding or replacing a subprocessor.
          </p>
          {done ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 size={18} /> You're subscribed. We'll email you on changes.
            </div>
          ) : (
            <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
                className="flex-1 px-4 py-2.5 rounded-xl bg-card/40 border border-border text-sm focus:outline-none focus:border-primary/60"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm disabled:opacity-60 glow-primary"
              >
                {submitting ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            One email per change. Unsubscribe any time. See <Link to="/data-notice" className="text-primary hover:underline">Data Notice</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
