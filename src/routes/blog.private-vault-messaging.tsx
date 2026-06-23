import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

const TITLE = 'What Is a Private Vault in a Messaging App (and Do You Need One)?';
const DESCRIPTION =
  'A private vault hides sensitive chats and media behind a separate PIN, even after your phone is unlocked. Here is how it works and when it matters.';
const URL = 'https://www.vibtribe.in/blog/private-vault-messaging';
const OG_IMAGE = 'https://www.vibtribe.in/icons/icon-512x512.png';
const PUBLISHED = '2026-06-23';

export const Route = createFileRoute('/blog/private-vault-messaging')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'private vault messaging app, hidden chats app, locked chat app, secret chat app India, secure photo vault' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
      { property: 'og:type', content: 'article' },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'article:published_time', content: PUBLISHED },
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
          '@type': 'Article',
          headline: TITLE,
          description: DESCRIPTION,
          datePublished: PUBLISHED,
          dateModified: PUBLISHED,
          author: { '@type': 'Organization', name: 'VibTribe' },
          publisher: { '@type': 'Organization', name: 'VibTribe', logo: { '@type': 'ImageObject', url: OG_IMAGE } },
          mainEntityOfPage: URL,
          image: OG_IMAGE,
        }),
      },
    ],
  }),
  component: Post,
});

function Post() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><AppLogo className="h-8 w-8" /><Wordmark className="h-5" /></Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Privacy &middot; June 2026</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What is a private vault in a messaging app?</h1>
        <article className="prose prose-invert mt-8 max-w-none space-y-5 text-sm leading-relaxed text-foreground/90">
          <p>End-to-end encryption protects messages in transit, but it doesn&rsquo;t help if someone with your unlocked phone opens the app. A <strong>private vault</strong> closes that last gap.</p>
          <h2 className="text-xl font-semibold">How a vault works</h2>
          <p>A vault is a separate area inside the messenger, gated by its own PIN or biometric. Any chat or media you move into it disappears from the main inbox. Even if a friend grabs your phone after you&rsquo;ve unlocked it, the vault stays locked.</p>
          <h2 className="text-xl font-semibold">Who benefits from a vault</h2>
          <ul className="list-disc pl-5">
            <li>People who share a phone with family.</li>
            <li>Anyone who travels and crosses border checkpoints.</li>
            <li>Couples who share private photos and don&rsquo;t want them mixed with regular chats.</li>
            <li>Founders, lawyers, and journalists handling sensitive conversations.</li>
          </ul>
          <h2 className="text-xl font-semibold">Vault vs disappearing messages</h2>
          <p>Disappearing messages remove content after a timer. A vault keeps content but hides and locks it. They complement each other &mdash; many users keep long-running sensitive threads in the vault and use disappearing timers inside those chats.</p>
          <h2 className="text-xl font-semibold">VibTribe&rsquo;s private vault</h2>
          <p>VibTribe ships with a built-in vault. Long-press any chat &rarr; <strong>Move to Vault</strong>. The vault uses a different PIN from your app lock and is invisible from the main inbox. <Link className="underline" to="/security">Read more about how we secure your data.</Link></p>
        </article>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/download/android" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Get VibTribe</Link>
          <Link to="/features" className="rounded-full border border-border px-5 py-2 text-sm font-medium">All features</Link>
        </div>
      </main>
    </div>
  );
}