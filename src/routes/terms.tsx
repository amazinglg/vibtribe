import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { TermsContent } from '@/components/legal/LegalContent';

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms & Conditions — VibTribe' },
      { name: 'description', content: 'VibTribe Terms of Service and Privacy Policy governing use of our private messaging platform.' },
      { property: 'og:title', content: 'Terms & Conditions — VibTribe' },
      { property: 'og:description', content: 'Read the Terms of Service and Privacy Policy for the VibTribe messaging app.' },
    ],
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
        <TermsContent />
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
