import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Database, ShieldCheck, Mail } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

export const Route = createFileRoute('/data-notice')({
  head: () => ({
    meta: [
      { title: 'Data Notice — VibTribe (DPDP Act, 2023)' },
      { name: 'description', content: 'How VibTribe collects, processes, retains and shares your personal data — published under India\u2019s Digital Personal Data Protection Act, 2023.' },
      { property: 'og:title', content: 'VibTribe Data Notice' },
      { property: 'og:description', content: 'A clear, itemised notice of what data we process, why, on what legal basis, for how long, and with whom.' },
    ],
  }),
  component: DataNoticePage,
});

type Row = {
  element: string;
  purpose: string;
  basis: string;
  retention: string;
  subprocessors: string;
  rights: string;
};

const ROWS: Row[] = [
  { element: 'Mobile number', purpose: 'Account identifier and contact discovery', basis: 'Contract performance', retention: 'Until account deletion', subprocessors: 'Lovable Cloud', rights: 'Export, delete' },
  { element: 'Email address (mandatory)', purpose: 'OTP verification at signup, password recovery, transactional & support emails. Marketing emails only if you opt in.', basis: 'Contract performance (OTP/recovery) & consent (marketing)', retention: 'Until account deletion', subprocessors: 'Resend', rights: 'Export, delete; withdraw marketing consent any time' },
  { element: 'Display name, username, profile photo, bio', purpose: 'Profile rendering & contact identification', basis: 'Contract performance', retention: 'Until account deletion', subprocessors: 'Lovable Cloud, Cloudflare (CDN)', rights: 'Edit, export, delete' },
  { element: 'Date of birth', purpose: 'Age verification (under-18 safeguards under DPDP §9)', basis: 'Legal obligation', retention: 'Until account deletion', subprocessors: 'Lovable Cloud', rights: 'Export, delete' },
  { element: 'Chats, media, status, reactions', purpose: 'Deliver messaging service', basis: 'Contract performance', retention: 'Until deleted by you or account deletion', subprocessors: 'Lovable Cloud (storage), Cloudflare (delivery)', rights: 'Delete per-message or whole account' },
  { element: 'Phone contacts (hashes only)', purpose: 'Match which of your contacts already use VibTribe', basis: 'Granular consent (Consent Center toggle)', retention: 'Hashes refreshed on each sync; deletable on demand', subprocessors: 'Lovable Cloud', rights: 'Withdraw consent any time' },
  { element: 'Device tokens (FCM / Web Push)', purpose: 'Deliver push notifications', basis: 'Consent', retention: 'Until sign-out or token expiry', subprocessors: 'Google Firebase Cloud Messaging', rights: 'Disable in OS / app settings' },
  { element: 'Device & session metadata (IP, user-agent, app version)', purpose: 'Security, fraud prevention, debugging', basis: 'Legitimate interests & legal obligation', retention: '90 days for session logs', subprocessors: 'Lovable Cloud, Cloudflare', rights: 'Export' },
  { element: 'Consent records', purpose: 'Demonstrate lawful basis (DPDP §6)', basis: 'Legal obligation', retention: 'Lifetime of account + 3 years', subprocessors: 'Lovable Cloud', rights: 'Export' },
  { element: 'Analytics (page views, anonymised events)', purpose: 'Improve product & SEO', basis: 'Granular consent (Analytics cookies toggle)', retention: '14 months', subprocessors: 'Google Tag Manager / Google Analytics', rights: 'Withdraw consent any time' },
];

function DataNoticePage() {
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
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] gradient-primary rounded-full blur-3xl opacity-20" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[24rem] h-[24rem] gradient-cyan rounded-full blur-3xl opacity-10" />

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
          <Database size={14} /> DPDP Act, 2023 — Data Notice
        </div>
        <h1 className="font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight">What data we process, why, and for how long</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          Published by VibTribe under §5 of India's Digital Personal Data Protection Act, 2023. This notice is plain-English and itemised. You can withdraw consent, export, or delete your data any time from <strong>Profile → Privacy → Consent Center</strong>.
        </p>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="glass rounded-3xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-semibold">Data element</th>
                  <th className="text-left p-3 font-semibold">Purpose</th>
                  <th className="text-left p-3 font-semibold">Legal basis</th>
                  <th className="text-left p-3 font-semibold">Retention</th>
                  <th className="text-left p-3 font-semibold">Subprocessors</th>
                  <th className="text-left p-3 font-semibold">Your rights</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={i} className="border-t border-border/60 align-top">
                    <td className="p-3 font-semibold text-foreground">{r.element}</td>
                    <td className="p-3 text-muted-foreground">{r.purpose}</td>
                    <td className="p-3 text-muted-foreground">{r.basis}</td>
                    <td className="p-3 text-muted-foreground">{r.retention}</td>
                    <td className="p-3 text-muted-foreground">{r.subprocessors}</td>
                    <td className="p-3 text-muted-foreground">{r.rights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={18} className="text-primary" />
              <h3 className="font-bold">Your DPDP rights</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Right to access &amp; correction</li>
              <li>Right to erasure (delete account)</li>
              <li>Right to grievance redressal</li>
              <li>Right to nominate (post-death data)</li>
              <li>Right to withdraw consent at any time</li>
            </ul>
          </div>
          <div className="glass rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={18} className="text-primary" />
              <h3 className="font-bold">Grievance Officer</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              For DPDP-related grievances, write to <a href="mailto:Labhansh.garg@outlook.com" className="text-primary hover:underline">Labhansh.garg@outlook.com</a>. We acknowledge within 24 hours and resolve within the timelines required by the DPDP Act, 2023 and IT Rules, 2021.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              See also: <Link to="/subprocessors" className="text-primary hover:underline">Subprocessors</Link> · <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Notice version 1.0 · Last updated June 2026 · Maintained by VibTribe
        </p>
      </section>
    </div>
  );
}
