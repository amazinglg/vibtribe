import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

const TITLE = 'VibTribe FAQ — Answers to Common Questions';
const DESCRIPTION =
  'Frequently asked questions about VibTribe: is it free, is it end-to-end encrypted, how does the private vault work, is it available on iOS, and how to import contacts.';
const URL = 'https://www.vibtribe.in/faq';
const OG_IMAGE = 'https://www.vibtribe.in/icons/icon-512x512.png';

const FAQS: { q: string; a: string }[] = [
  { q: 'Is VibTribe free to use?', a: 'Yes. All core features \u2014 messaging, calls, status, tribes, and the private vault \u2014 are free. There are no ads inside the app.' },
  { q: 'Is VibTribe end-to-end encrypted?', a: 'Direct chats and 1-to-1 calls are end-to-end encrypted on your device. Group chats use server-mediated transport with encrypted storage at rest.' },
  { q: 'What is the private vault?', a: 'A PIN-locked space inside VibTribe for sensitive chats and media. Vault items do not appear in the main inbox and require a separate code to open.' },
  { q: 'Does VibTribe show my phone number to other users?', a: 'No. By default we do not share your phone number with other users. You can be discovered by username, and you control what is visible on your profile.' },
  { q: 'Is VibTribe available on iPhone?', a: 'iOS is in a closed beta in 2026. Join the waitlist on the iOS download page to get notified at launch.' },
  { q: 'Can I use VibTribe on the web?', a: 'Yes. Open vibtribe.in in any modern browser and sign in to use chat, status, and calls.' },
  { q: 'How do I delete my account?', a: 'In the app, open Profile \u2192 Privacy \u2192 Delete account. Deletion removes your profile, chats, and media from our systems.' },
  { q: 'Does VibTribe back up my chats to the cloud?', a: 'Chats stay on your device by default. Optional encrypted cloud backup is on the roadmap; we will never enable cloud backup without your consent.' },
  { q: 'How is VibTribe different from WhatsApp, Signal, or Telegram?', a: 'VibTribe combines end-to-end encryption with a built-in private vault and a 24-hour status timeline designed for close circles, not public broadcasting. See our comparison post for details.' },
  { q: 'Who is behind VibTribe?', a: 'VibTribe is built by an independent team based in India, focused on respectful, privacy-first social messaging.' },
];

export const Route = createFileRoute('/faq')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'VibTribe FAQ, is VibTribe safe, is VibTribe end to end encrypted, VibTribe vs WhatsApp, private vault app, secure messaging questions' },
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
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vibtribe.in/' },
            { '@type': 'ListItem', position: 2, name: 'FAQ', item: URL },
          ],
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <AppLogo className="h-8 w-8" />
            <Wordmark className="h-5" />
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Quick answers about VibTribe \u2014 the private messaging app for real conversations.
        </p>
        <section className="mt-8 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-5 [&_summary]:cursor-pointer">
              <summary className="text-base font-semibold text-foreground">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </section>
        <section className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-lg font-semibold">Still have a question?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Email <a className="underline" href="mailto:support@vibtribe.in">support@vibtribe.in</a> and we will get back to you.
          </p>
        </section>
      </main>
    </div>
  );
}