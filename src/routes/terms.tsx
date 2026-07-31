import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { TermsConditionsContent } from '@/components/legal/LegalContent';
import { breadcrumbLd, socialImageMeta } from '@/lib/seo';

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms & Conditions — VibTribe' },
      { name: 'description', content: 'VibTribe Terms of Service and Privacy Policy governing use of our private messaging platform.' },
      { property: 'og:title', content: 'Terms & Conditions — VibTribe' },
      { property: 'og:description', content: 'Read the Terms of Service and Privacy Policy for the VibTribe messaging app.' },
      { property: 'og:url', content: 'https://www.vibtribe.in/terms' },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:title', content: 'Terms & Conditions — VibTribe' },
      { name: 'twitter:description', content: 'Read the Terms of Service for the VibTribe messaging app.' },
      ...socialImageMeta(),
    ],
    links: [{ rel: 'canonical', href: 'https://www.vibtribe.in/terms' }],
    scripts: [breadcrumbLd([{ name: 'Terms & Conditions', path: '/terms' }])],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/sign-up" className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-semibold">Terms &amp; Conditions</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <TermsConditionsContent />
        <div className="mt-10 text-xs text-muted-foreground">
          If you're already signed in and haven't accepted yet, you'll be prompted to do so the next time you open the app.
        </div>
        <div className="mt-4">
          <Link to="/sign-up" className="text-primary underline">← Back to Sign Up</Link>
        </div>
      </main>
    </div>
  );
}
