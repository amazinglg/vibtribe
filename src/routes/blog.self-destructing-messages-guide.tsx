import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';
import { breadcrumbLd } from '@/lib/seo';

const TITLE = 'How to Send Self-Destructing Messages (And Why You Should)';
const DESCRIPTION =
  'A practical guide to disappearing messages: when they help, when they don\u2019t, and how to send self-destructing messages in VibTribe and other apps.';
const URL = 'https://www.vibtribe.in/blog/self-destructing-messages-guide';
const OG_IMAGE = 'https://www.vibtribe.in/icons/icon-512x512.png';
const PUBLISHED = '2026-06-23';

export const Route = createFileRoute('/blog/self-destructing-messages-guide')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'self destructing messages, disappearing messages, vanishing messages app, how to send disappearing messages, secure chat tips' },
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
      breadcrumbLd([{ name: 'Self-Destructing Messages Guide', path: '/blog/self-destructing-messages-guide' }]),
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
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
          <Link to="/" className="flex items-center gap-2"><AppLogo size={28} /><Wordmark className="text-lg" /></Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">How-to &middot; June 2026</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">How to send self-destructing messages</h1>
        <article className="prose prose-invert mt-8 max-w-none space-y-5 text-sm leading-relaxed text-foreground/90">
          <p>Some conversations don&rsquo;t need to live forever in your chat history &mdash; a one-time password, a quick rant, a private photo. Self-destructing messages handle that for you.</p>
          <h2 className="text-xl font-semibold">When disappearing messages help</h2>
          <ul className="list-disc pl-5">
            <li>Sharing temporary credentials or one-time codes.</li>
            <li>Sending sensitive photos that shouldn&rsquo;t linger on either device.</li>
            <li>Casual conversations you don&rsquo;t want piling up in your inbox.</li>
            <li>Reducing the amount of personal context on a lost or stolen phone.</li>
          </ul>
          <h2 className="text-xl font-semibold">When they don&rsquo;t</h2>
          <p>They don&rsquo;t stop the other side from taking a screenshot, photographing the screen, or copying the text. Treat them as &ldquo;reduce exposure&rdquo;, not &ldquo;guarantee secrecy&rdquo;.</p>
          <h2 className="text-xl font-semibold">How to enable them in VibTribe</h2>
          <ol className="list-decimal pl-5">
            <li>Open a chat.</li>
            <li>Tap the chat header, then <strong>Privacy &rarr; Disappearing messages</strong>.</li>
            <li>Pick a timer: 1 hour, 24 hours, or 7 days.</li>
            <li>New messages in that chat will vanish automatically.</li>
          </ol>
          <h2 className="text-xl font-semibold">A complementary trick: the private vault</h2>
          <p>For chats you&rsquo;d rather hide entirely instead of timing-out, move them to the VibTribe <Link className="underline" to="/security">private vault</Link>. They disappear from your main inbox and are locked behind a separate PIN.</p>
        </article>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/download/android" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Get VibTribe</Link>
          <Link to="/faq" className="rounded-full border border-border px-5 py-2 text-sm font-medium">More FAQs</Link>
        </div>
      </main>
    </div>
  );
}