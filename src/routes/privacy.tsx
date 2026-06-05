import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { TermsContent } from '@/components/legal/LegalContent';

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy — VibTribe' },
      { name: 'description', content: 'How VibTribe collects, uses, and protects your data, including end-to-end encryption details.' },
      { property: 'og:title', content: 'Privacy Policy — VibTribe' },
      { property: 'og:description', content: 'Privacy Policy for the VibTribe messaging app.' },
      { property: 'og:url', content: 'https://www.vibtribe.in/privacy' },
      { property: 'og:type', content: 'article' },
    ],
    links: [{ rel: 'canonical', href: 'https://www.vibtribe.in/privacy' }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/sign-up" className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-semibold">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <TermsContent />
        <div className="mt-10">
          <Link to="/sign-up" className="text-primary underline">← Back to Sign Up</Link>
        </div>
      </main>
    </div>
  );
}
