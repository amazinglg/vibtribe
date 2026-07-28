import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, MessagesSquare, ShieldCheck, Lock, PhoneCall, Video, Sparkles, Users, ImageIcon, Clock } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

const TITLE = 'VibTribe Features — Secure Chat, Calls, Status & Private Vault';
const DESCRIPTION =
  'Explore every VibTribe feature: end-to-end encrypted chats, HD voice & video calls, 24-hour status, tribes (groups), an encrypted private vault, and self-destructing messages.';
const URL = 'https://www.vibtribe.in/features';
const OG_IMAGE = 'https://www.vibtribe.in/icons/icon-512x512.png';

export const Route = createFileRoute('/features')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'secure messaging features, encrypted chat app, private vault app, disappearing messages, group chat app, video calling app, status updates app, VibTribe features' },
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
            { '@type': 'ListItem', position: 2, name: 'Features', item: URL },
          ],
        }),
      },
    ],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  { icon: MessagesSquare, title: 'End-to-end encrypted chat', body: 'Every direct message is encrypted on your device before it leaves. Not even our servers can read it.' },
  { icon: ShieldCheck, title: 'Private vault', body: 'A separate, PIN-locked space inside the app for sensitive chats and media — invisible from the main inbox.' },
  { icon: Clock, title: '24-hour status', body: 'Share photos, videos, and text moments that disappear in 24 hours. Control exactly who sees them.' },
  { icon: PhoneCall, title: 'Crystal-clear voice calls', body: 'Low-latency one-to-one voice calls with adaptive bitrate, encrypted end-to-end.' },
  { icon: Video, title: 'HD video calls', body: 'Face-to-face video calls in HD, with bandwidth that adapts to your network.' },
  { icon: Users, title: 'Tribes (private groups)', body: 'Create groups of friends, family, or teams with shared media, mentions, and admin controls.' },
  { icon: Sparkles, title: 'Self-destructing messages', body: 'Set messages to vanish after they\u2019re read — for moments you don\u2019t want sitting in chat history.' },
  { icon: ImageIcon, title: 'Rich media sharing', body: 'Send photos, videos, voice notes, documents, and stickers without quality loss.' },
  { icon: Lock, title: 'No SMS, no number leak', body: 'We never share your phone number with other users by default. Find friends by username instead.' },
];

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <AppLogo size={28} />
            <Wordmark className="text-lg" />
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">VibTribe Features</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          A complete look at what you can do with VibTribe — the private messaging app built for people who care about both vibes and privacy.
        </p>
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border border-border/60 bg-card/60 p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>
        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-xl font-semibold">Try VibTribe free</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Available on Android and the web. iOS is in private beta.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/download/android" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Install from Google Play</Link>
            <Link to="/security" className="rounded-full border border-border px-5 py-2 text-sm font-medium">How we keep you safe</Link>
          </div>
        </section>
      </main>
    </div>
  );
}