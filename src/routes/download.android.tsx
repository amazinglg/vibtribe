import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ShieldCheck, Smartphone, UserPlus, Mail, ChevronDown, Apple,
  CheckCircle2, ArrowLeft, ExternalLink, RefreshCw, BadgeCheck, Sparkles,
} from 'lucide-react';
import GooglePlayButton, { PLAY_STORE_URL } from '@/components/GooglePlayButton';
import { breadcrumbLd, socialImageMeta } from '@/lib/seo';

const TITLE = 'Install VibTribe on Android — Get it on Google Play';
const DESCRIPTION =
  'Install VibTribe for Android from the official Google Play listing. Verified by Google Play Protect, automatic updates and a secure one-tap installation.';
const URL = 'https://www.vibtribe.in/download/android';

export const Route = createFileRoute('/download/android')({
  component: DownloadAndroidPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      ...socialImageMeta(),
    ],
    links: [{ rel: 'canonical', href: URL }],
    scripts: [
      breadcrumbLd([{ name: 'Install on Android', path: '/download/android' }]),
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'VibTribe',
          applicationCategory: 'SocialNetworkingApplication',
          operatingSystem: 'Android',
          url: PLAY_STORE_URL,
          downloadUrl: PLAY_STORE_URL,
          installUrl: PLAY_STORE_URL,
          description: DESCRIPTION,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }),
      },
    ],
  }),
});

const TRUST = [
  { icon: BadgeCheck, text: 'Official Google Play Release' },
  { icon: RefreshCw, text: 'Automatic Updates' },
  { icon: ShieldCheck, text: 'Verified by Google Play Protect' },
  { icon: Smartphone, text: 'Secure Installation' },
  { icon: Sparkles, text: 'Always Up-to-date' },
];

function useIsAndroid() {
  const [platform, setPlatform] = React.useState<'android' | 'ios' | 'desktop'>('desktop');
  React.useEffect(() => {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (/Android/i.test(ua)) setPlatform('android');
    else if (isIOS) setPlatform('ios');
    else setPlatform('desktop');
  }, []);
  return platform;
}

function DownloadAndroidPage() {
  const platform = useIsAndroid();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-xl border border-border hover:bg-muted transition-all" aria-label="Back">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Android</p>
            <h1 className="font-bold text-base sm:text-lg truncate">Install VibTribe from Google Play</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-6">
        <section className="glass rounded-3xl border border-border p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-52 h-52 gradient-primary rounded-full blur-3xl opacity-20" aria-hidden="true" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Now live on Google Play</p>
            <h2 className="font-bold text-xl sm:text-2xl leading-tight mb-2">
              One tap. Officially published. Always up-to-date.
            </h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              VibTribe for Android is distributed exclusively through the Google Play Store, so every install is
              verified, signed and updated automatically.
            </p>

            <GooglePlayButton />

            <ul className="mt-6 grid sm:grid-cols-2 gap-2.5">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-foreground/85">
                  <span className="w-6 h-6 rounded-full bg-vt-green/15 text-vt-green flex items-center justify-center flex-shrink-0">
                    <Icon size={13} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {platform !== 'android' && (
          <section className="glass rounded-3xl border border-border p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl gradient-cyan flex items-center justify-center glow-cyan flex-shrink-0">
                <Apple size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">On iPhone or iPad?</h2>
                <p className="text-xs text-muted-foreground">Install from Safari in three quick steps</p>
              </div>
            </div>
            <Link
              to="/download/ios"
              className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl glass border border-primary/40 text-foreground text-sm font-semibold hover:border-primary transition-all"
            >
              <Apple size={16} /> Open iPhone install guide
            </Link>
          </section>
        )}

        <section className="glass rounded-3xl border border-border p-5 sm:p-7">
          <h2 className="font-bold text-lg mb-4">After you install</h2>
          <ol className="space-y-3 text-sm">
            {[
              { icon: UserPlus, t: 'Create your account', d: 'Sign up with your mobile number or email and verify with the 6-digit code.' },
              { icon: Smartphone, t: 'Allow notifications', d: 'So messages, calls and statuses arrive instantly.' },
              { icon: Mail, t: 'Product updates (optional)', d: 'Opt in during sign-up or later from Profile → Privacy. Unsubscribe in one click.' },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon size={15} />
                </span>
                <span>
                  <strong className="block text-foreground">{t}</strong>
                  <span className="text-muted-foreground text-xs leading-relaxed">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="glass rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <CheckCircle2 size={15} className="text-primary" /> Common questions
          </h2>
          <Faq q="Is this the official VibTribe app?">
            Yes. VibTribe is published by us on Google Play under the package <strong>app.vibtribe.app</strong> and is verified by Google Play Protect.
          </Faq>
          <Faq q="How do I get updates?">
            Google Play updates VibTribe automatically. You never have to reinstall anything.
          </Faq>
          <Faq q="I'm on iPhone — can I use VibTribe?">
            Yes — VibTribe runs as an installable web app on iOS. Open vibtribe.in in Safari and tap Share → Add to Home Screen.
          </Faq>
          <a
            href="mailto:help.vibtribe.in@gmail.com"
            className="inline-flex items-center gap-1.5 text-primary text-xs font-semibold hover:underline"
          >
            Still stuck? Email us <ExternalLink size={11} />
          </a>
        </section>
      </main>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl bg-muted/30 border border-border p-3 group">
      <summary className="cursor-pointer text-foreground font-medium text-sm list-none flex items-center justify-between gap-2">
        {q}
        <ChevronDown size={14} className="text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{children}</p>
    </details>
  );
}
