import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

const TITLE = 'End-to-End Encryption Explained (Simply) for Messaging Apps';
const DESCRIPTION =
  'A plain-English guide to how end-to-end encryption works in messaging apps, what it does (and does not) protect, and why it matters for everyday chat.';
const URL = 'https://www.vibtribe.in/blog/end-to-end-encryption-explained';
const OG_IMAGE = 'https://www.vibtribe.in/icons/icon-512x512.png';
const PUBLISHED = '2026-06-23';

export const Route = createFileRoute('/blog/end-to-end-encryption-explained')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'end to end encryption explained, how does encryption work, encrypted messaging app, what is e2ee, secure chat app' },
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
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Explainer &middot; June 2026</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">End-to-End Encryption, Explained Simply</h1>
        <article className="prose prose-invert mt-8 max-w-none space-y-5 text-sm leading-relaxed text-foreground/90">
          <p>You&rsquo;ve seen the phrase &ldquo;end-to-end encrypted&rdquo; on every messenger&rsquo;s marketing page. Here&rsquo;s what it actually means, without the jargon.</p>
          <h2 className="text-xl font-semibold">The basic idea</h2>
          <p>Imagine you write a letter, lock it in a box that only your friend has the key to, and post it. The courier carries the box from your hand to your friend&rsquo;s. The courier can see <em>that</em> the box exists, but cannot open it. That&rsquo;s end-to-end encryption (E2EE) in one sentence.</p>
          <h2 className="text-xl font-semibold">How keys actually work</h2>
          <p>Each device generates a pair of keys: a public key it shares, and a private key it keeps. When you send a message, your app encrypts it using the recipient&rsquo;s public key. Only the recipient&rsquo;s private key can decrypt it. The server in the middle forwards encrypted bytes; it has no way to read them.</p>
          <h2 className="text-xl font-semibold">What E2EE protects</h2>
          <ul className="list-disc pl-5">
            <li>Message content from servers and network operators.</li>
            <li>Voice and video call audio (in apps that support encrypted calls).</li>
            <li>Attached photos, voice notes, and files, when implemented properly.</li>
          </ul>
          <h2 className="text-xl font-semibold">What E2EE does <em>not</em> protect</h2>
          <ul className="list-disc pl-5">
            <li>Metadata &mdash; who you message and when.</li>
            <li>Backups stored unencrypted in the cloud.</li>
            <li>Screenshots taken on the other end.</li>
            <li>A compromised or unlocked device.</li>
          </ul>
          <h2 className="text-xl font-semibold">How VibTribe uses E2EE</h2>
          <p>VibTribe encrypts direct messages and 1-to-1 calls on your device before they leave. We pair that with an additional <Link className="underline" to="/security">private vault</Link> for sensitive chats, and we minimise the metadata we keep so even our own systems learn less about you.</p>
        </article>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/download/android" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Try VibTribe</Link>
          <Link to="/security" className="rounded-full border border-border px-5 py-2 text-sm font-medium">Our security model</Link>
        </div>
      </main>
    </div>
  );
}