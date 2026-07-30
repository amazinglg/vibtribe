import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Server } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

export const Route = createFileRoute('/subprocessors')({
  head: () => ({
    meta: [
      { title: 'Subprocessors — VibTribe' },
      { name: 'description', content: 'The third-party service providers VibTribe uses to operate the platform, their purpose and processing region. Subscribe to change notifications.' },
      { property: 'og:title', content: 'VibTribe Subprocessors' },
      { property: 'og:description', content: 'Public list of subprocessors VibTribe uses, with purpose and region.' },
      { property: 'og:url', content: 'https://www.vibtribe.in/subprocessors' },
      { property: 'og:type', content: 'website' },
    ],
    links: [{ rel: 'canonical', href: 'https://www.vibtribe.in/subprocessors' }],
  }),
  component: SubprocessorsPage,
});

type Sub = { name: string; purpose: string; region: string; dpa: string };

const SUBS: Sub[] = [
  { name: 'Lovable Cloud (Supabase)', purpose: 'Application database, authentication, file storage, server runtime', region: 'EU / global edge', dpa: 'Standard DPA on file' },
  { name: 'Cloudflare', purpose: 'CDN, DDoS protection, edge delivery', region: 'Global edge', dpa: 'Standard DPA on file' },
  { name: 'Google Firebase Cloud Messaging (FCM)', purpose: 'Push notifications to the Android Capacitor app and web browsers', region: 'Global (US-based)', dpa: 'Google Cloud DPA' },
  { name: 'Apple Push Notification Service (APNs)', purpose: 'Push notifications to iOS devices (PWA/native)', region: 'Global (US-based)', dpa: 'Apple Developer Agreement' },
  { name: 'Resend (via Lovable Emails)', purpose: 'Transactional & marketing email delivery, including email OTP sign-in codes', region: 'US / EU', dpa: 'Resend DPA' },
  { name: 'Google Tag Manager / Analytics', purpose: 'Anonymised product analytics (consent-gated)', region: 'Global (US-based)', dpa: 'Google Ads Data Processing Terms' },
];

function SubprocessorsPage() {
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

      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-16 text-center">
        <p className="text-xs text-muted-foreground">
          See also <Link to="/data-notice" className="text-primary hover:underline">Data Notice</Link> · <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </p>
      </section>
    </div>
  );
}
