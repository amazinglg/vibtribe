import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ShieldCheck, Lock, KeyRound, EyeOff, Server, FileLock2 } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

const TITLE = 'Security & Privacy — How VibTribe Protects Your Messages';
const DESCRIPTION =
  'Learn how VibTribe protects your conversations: end-to-end encryption, a PIN-locked private vault, minimal metadata, and a transparent privacy model.';
const URL = 'https://www.vibtribe.in/security';
const OG_IMAGE = 'https://www.vibtribe.in/icons/icon-512x512.png';

export const Route = createFileRoute('/security')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'end-to-end encryption, encrypted messenger, private vault, secure chat app India, message encryption explained, secure messaging app 2026' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: OG_IMAGE },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [{ rel: 'canonical', href: URL }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vibtribe.in/' },
            { '@type': 'ListItem', position: 2, name: 'Security', item: URL },
          ],
        }),
      },
    ],
  }),
  component: SecurityPage,
});

const PILLARS = [
  { icon: Lock, title: 'End-to-end encryption by default', body: 'Direct messages, voice notes, and 1-to-1 calls are encrypted on your device. Keys never leave your phone in plaintext.' },
  { icon: FileLock2, title: 'Encrypted private vault', body: 'Move any chat or media into a PIN-locked vault. It is hidden from the main inbox and gated by a separate code.' },
  { icon: EyeOff, title: 'Minimal metadata', body: 'We collect only what is required to deliver messages. No reading lists, no behavior profiles sold to advertisers.' },
  { icon: KeyRound, title: 'Account protection', body: 'Optional two-factor authentication, app-lock, and trust-lock for additional protection if your phone is lost.' },
  { icon: Server, title: 'Modern infrastructure', body: 'Hosted on hardened cloud infrastructure with role-based access, audit logging, and least-privilege controls.' },
  { icon: ShieldCheck, title: 'No SMS, no number leakage', body: 'Add friends by username \u2014 your phone number is not exposed to other users by default.' },
];

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <AppLogo className="h-8 w-8" />
            <Wordmark className="h-5" />
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Security & Privacy</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">How VibTribe protects your conversations</h1>
        <p className="mt-4 text-base text-muted-foreground">
          VibTribe is a privacy-first messaging app. This page explains, in plain language, the controls in the product and the choices we make on your behalf. It is maintained by the VibTribe team and is not an independent security certification.
        </p>
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <article key={p.title} className="rounded-2xl border border-border/60 bg-card/60 p-5">
              <p.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">What "end-to-end encrypted" means in VibTribe</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When you send a direct message, your device encrypts it using keys that exist only on your phone and the recipient&rsquo;s. The VibTribe server forwards the encrypted bytes but cannot decrypt them. If our servers were compromised, message content would still be unreadable.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">The private vault</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The vault is a separate area inside the app guarded by its own PIN. Move any chat or media into it and it disappears from the main inbox. The vault PIN is required even after you have unlocked the app.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">What we collect</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The minimum required to deliver the service: account identifier, device push tokens, and basic delivery metadata. We do not sell data and do not run third-party advertising trackers in the app. See our <Link to="/privacy" className="underline">Privacy Policy</Link> for details.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Report a vulnerability</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Found something? Email <a className="underline" href="mailto:security@vibtribe.in">security@vibtribe.in</a> with steps to reproduce. We aim to acknowledge within 72 hours.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-xl font-semibold">Ready to try a more private messenger?</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/download/android" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Download VibTribe</Link>
            <Link to="/features" className="rounded-full border border-border px-5 py-2 text-sm font-medium">See all features</Link>
          </div>
        </section>
      </main>
    </div>
  );
}