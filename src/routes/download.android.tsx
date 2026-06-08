import React, { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Download, ShieldAlert, Smartphone, UserPlus, Mail, ChevronDown, ChevronUp,
  CheckCircle2, ArrowLeft, ExternalLink, Settings as SettingsIcon, AlertTriangle,
} from 'lucide-react';

const APK_HREF = '/VibTribe_v1.1.apk';
const APK_FILENAME = 'VibTribe_v1.1.apk';

const TITLE = 'Install VibTribe on Android — Step-by-step guide';
const DESCRIPTION =
  'Download the VibTribe Android app safely. Follow our 5-step guide to install the APK, enable permissions and finish onboarding in under 2 minutes.';
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
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
});

type StepDef = {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const STEPS: StepDef[] = [
  { id: 1, title: 'Download APK', subtitle: 'Save VibTribe_v1.1.apk', icon: Download },
  { id: 2, title: 'Allow install', subtitle: 'Enable “Install unknown apps”', icon: ShieldAlert },
  { id: 3, title: 'Install app', subtitle: 'Tap the APK and Install', icon: Smartphone },
  { id: 4, title: 'First open', subtitle: 'Sign up & permissions', icon: UserPlus },
  { id: 5, title: 'Updates (optional)', subtitle: 'Opt-in to product emails', icon: Mail },
];

function DownloadAndroidPage() {
  const [step, setStep] = useState(1);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Auto-advance to step 2 a moment after the user taps Download
  useEffect(() => {
    if (!downloadStarted) return;
    const t = setTimeout(() => setStep((s) => (s === 1 ? 2 : s)), 1400);
    return () => clearTimeout(t);
  }, [downloadStarted]);

  const startDownload = () => {
    setDownloadStarted(true);
    // Fire-and-forget analytics — never block the download.
    try {
      void fetch('/api/public/track-apk-download', { method: 'POST', keepalive: true })
        .catch(() => {});
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl border border-border hover:bg-muted transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Android install</p>
            <h1 className="font-bold text-base sm:text-lg truncate">Get VibTribe on your phone</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-6">
        {/* Stepper */}
        <nav aria-label="Installation steps" className="overflow-x-auto -mx-4 px-4">
          <ol className="flex items-center gap-2 min-w-max">
            {STEPS.map((s, i) => {
              const done = step > s.id;
              const active = step === s.id;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-semibold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : done
                          ? 'bg-vt-green/15 text-vt-green border-vt-green/30'
                          : 'bg-muted/40 text-muted-foreground border-border'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      active ? 'bg-primary-foreground/20' : done ? 'bg-vt-green/20' : 'bg-muted'
                    }`}>
                      {done ? <CheckCircle2 size={12} /> : s.id}
                    </span>
                    {s.title}
                  </button>
                  {i < STEPS.length - 1 && <span className="w-4 h-px bg-border" />}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step body */}
        <section className="glass rounded-3xl border border-border p-5 sm:p-7">
          {step === 1 && (
            <StepCard
              eyebrow="Step 1 of 5"
              icon={Download}
              title="Download the VibTribe APK (v1.1)"
              body="Tap the button below. The file will save to your phone as VibTribe_v1.1.apk (about 38 MB). Use Wi-Fi for the fastest download. This is the latest official Android release — version 1.1."
            >
              <a
                href={APK_HREF}
                download={APK_FILENAME}
                onClick={startDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 gradient-primary text-white font-semibold rounded-2xl glow-primary hover:opacity-95 transition-all"
              >
                <Download size={16} /> Download VibTribe_v1.1.apk
              </a>
              {downloadStarted && (
                <p className="mt-3 text-xs text-vt-green flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Download started. Check your Notifications or Downloads folder.
                </p>
              )}
              <Tip>
                Chrome may show a yellow warning because the file is outside the Play Store. This is normal for direct APK installs — tap “Download anyway”.
              </Tip>
              <NextButton onClick={() => setStep(2)} label="I've downloaded the file" />
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              eyebrow="Step 2 of 5"
              icon={ShieldAlert}
              title="Allow installing from this source"
              body="Android blocks apps from outside the Play Store by default. You'll see a prompt asking to allow installs from your browser — tap Settings, then turn on 'Allow from this source'."
            >
              <Steps
                items={[
                  'Open the APK from your Downloads or Chrome notification.',
                  'When Android says "For your security, your phone is not allowed to install unknown apps", tap Settings.',
                  'Toggle ON "Allow from this source" for your browser.',
                  'Tap the back arrow to return to the install screen.',
                ]}
              />
              <Tip>
                On Android 8+ this permission is per-app (browser, file manager). On older Android, it's under Settings → Security → Unknown sources.
              </Tip>
              <NextButton onClick={() => setStep(3)} label="Permission enabled — continue" />
            </StepCard>
          )}

          {step === 3 && (
            <StepCard
              eyebrow="Step 3 of 5"
              icon={Smartphone}
              title="Install the app"
              body="You're back on the install screen. Tap Install. If Google Play Protect asks to scan, allow it — VibTribe is safe and signed by us."
            >
              <Steps
                items={[
                  'Tap Install on the bottom right.',
                  'If Play Protect shows a warning, tap "Install anyway" or "Send for scan, then install".',
                  'Wait a few seconds for installation to finish.',
                  'Tap Open to launch VibTribe — or find the VibTribe icon in your app drawer.',
                ]}
              />
              <div className="mt-4 p-3 rounded-2xl bg-vt-amber/10 border border-vt-amber/30 flex gap-2">
                <AlertTriangle size={14} className="text-vt-amber flex-shrink-0 mt-0.5" />
                <p className="text-xs text-vt-amber">
                  Never install APKs from unknown websites. Only download VibTribe from <strong>vibtribe.in</strong>.
                </p>
              </div>
              <NextButton onClick={() => setStep(4)} label="App installed — continue" />
            </StepCard>
          )}

          {step === 4 && (
            <StepCard
              eyebrow="Step 4 of 5"
              icon={UserPlus}
              title="First open & sign up"
              body="Open VibTribe and create your account. You can also sign in if you already have one."
            >
              <Steps
                items={[
                  'Tap Sign Up and enter your name, email and password.',
                  'Verify your email with the 6-digit code we send.',
                  'Allow Notifications so messages, calls and statuses arrive instantly.',
                  'Allow Microphone & Camera only when you start a voice or video call.',
                  'Contacts access is optional — only used to suggest people you already know.',
                ]}
              />
              <Tip>
                Every permission is optional. You can deny any of them and still use VibTribe — features that need them will prompt later.
              </Tip>
              <NextButton onClick={() => setStep(5)} label="I'm signed in — continue" />
            </StepCard>
          )}

          {step === 5 && (
            <StepCard
              eyebrow="Step 5 of 5"
              icon={Mail}
              title="Stay in the loop (optional)"
              body="Want occasional emails about new features, tips and offers? You can opt in during sign-up or any time from Profile → Privacy. This is completely optional and you can unsubscribe in one click."
            >
              <div className="space-y-2 text-sm text-foreground/80">
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-vt-green mt-0.5 flex-shrink-0" />
                  <span><strong>Optional.</strong> Skip if you prefer a quiet inbox.</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-vt-green mt-0.5 flex-shrink-0" />
                  <span><strong>Reversible anytime</strong> — toggle in Profile → Privacy or click Unsubscribe in any email.</span>
                </p>
                <p className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-vt-amber mt-0.5 flex-shrink-0" />
                  <span>Skipping means you may miss launch news, feature updates and special offers.</span>
                </p>
              </div>
              <div className="mt-5 p-4 rounded-2xl bg-vt-green/10 border border-vt-green/30">
                <p className="font-semibold text-vt-green flex items-center gap-2">
                  <CheckCircle2 size={16} /> You're all set!
                </p>
                <p className="text-xs text-foreground/80 mt-1">
                  Welcome to VibTribe — where your vibe finds its tribe. Open the app and start chatting.
                </p>
              </div>
            </StepCard>
          )}
        </section>

        {/* Need help */}
        <section className="glass rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-all"
            aria-expanded={helpOpen}
          >
            <span className="flex items-center gap-2 font-semibold text-sm">
              <SettingsIcon size={16} className="text-primary" /> Need help?
            </span>
            {helpOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {helpOpen && (
            <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">
              <Faq q="Chrome blocked the download as harmful — what do I do?">
                Tap the 3-dot menu on the warning and choose “Download anyway”. This warning appears for any APK that isn't from the Play Store — it does not mean the file is unsafe.
              </Faq>
              <Faq q="The Install button is greyed out.">
                Your browser doesn't yet have permission to install apps. Go back to Step 2 and turn on “Allow from this source”.
              </Faq>
              <Faq q="Play Protect says the developer is unknown.">
                That's expected for direct installs. Choose “Install anyway”. We sign every release and the signature is verified at install.
              </Faq>
              <Faq q="Can I still get updates?">
                Yes — when a new version is released we'll notify you in-app with a download link. You can also revisit this page anytime to get the latest APK.
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
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StepCard({
  eyebrow, icon: Icon, title, body, children,
}: {
  eyebrow: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center glow-primary flex-shrink-0">
          <Icon size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 className="font-bold text-lg sm:text-xl text-foreground leading-tight">{title}</h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{body}</p>
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-foreground/85">{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 p-3 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
      💡 {children}
    </div>
  );
}

function NextButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl border border-primary/40 text-foreground font-semibold text-sm hover:bg-primary/10 transition-all"
    >
      {label} →
    </button>
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