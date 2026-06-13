import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Share2, Smartphone, UserPlus, Bell, ChevronDown, ChevronUp,
  CheckCircle2, ArrowLeft, ExternalLink, Settings as SettingsIcon,
  AlertTriangle, Globe, Home,
} from 'lucide-react';

const SITE_URL = 'https://www.vibtribe.in';
const TITLE = 'Install VibTribe on iPhone — Step-by-step guide';
const DESCRIPTION =
  'Install VibTribe on your iPhone or iPad as a Home Screen app. Follow our 5-step Safari guide and start chatting in under 2 minutes.';
const URL = 'https://www.vibtribe.in/download/ios';

export const Route = createFileRoute('/download/ios')({
  component: DownloadIosPage,
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
  { id: 1, title: 'Open in Safari', subtitle: 'vibtribe.in in Safari', icon: Globe },
  { id: 2, title: 'Tap Share', subtitle: 'Bottom toolbar', icon: Share2 },
  { id: 3, title: 'Add to Home Screen', subtitle: 'Pick from the list', icon: Home },
  { id: 4, title: 'Open VibTribe', subtitle: 'Launch from icon', icon: Smartphone },
  { id: 5, title: 'Sign up & notify', subtitle: 'Allow notifications', icon: Bell },
];

function DownloadIosPage() {
  const [step, setStep] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);

  const openInSafari = () => {
    try {
      window.location.href = SITE_URL;
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">iPhone install</p>
            <h1 className="font-bold text-base sm:text-lg truncate">Get VibTribe on your iPhone</h1>
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

        <section className="glass rounded-3xl border border-border p-5 sm:p-7">
          {step === 1 && (
            <StepCard
              eyebrow="Step 1 of 5"
              icon={Globe}
              title="Open VibTribe in Safari"
              body="iPhone only lets Safari add apps to your Home Screen. If you're reading this in Chrome, Firefox or in-app browsers like Instagram, copy the link and open it in Safari first."
            >
              <button
                type="button"
                onClick={openInSafari}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 gradient-primary text-white font-semibold rounded-2xl glow-primary hover:opacity-95 transition-all"
              >
                <Globe size={16} /> Open vibtribe.in
              </button>
              <Tip>
                If a different browser opens, tap the share menu and choose "Open in Safari" — or paste <strong>vibtribe.in</strong> into Safari's address bar.
              </Tip>
              <NextButton onClick={() => setStep(2)} label="I'm in Safari — continue" />
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              eyebrow="Step 2 of 5"
              icon={Share2}
              title="Tap the Share button"
              body="The Share button is the square with an upward arrow. It's in the bottom toolbar on iPhone, and at the top on iPad."
            >
              <Steps
                items={[
                  'Make sure you are on vibtribe.in (the home page works best).',
                  'On iPhone: tap the Share icon in the bottom toolbar.',
                  'On iPad: tap the Share icon at the top-right of Safari.',
                  'A sheet slides up with sharing and action options.',
                ]}
              />
              <Tip>
                Don't see the toolbar? Tap once near the bottom of the screen — iOS auto-hides the Safari toolbar while you scroll.
              </Tip>
              <NextButton onClick={() => setStep(3)} label="Share sheet is open — continue" />
            </StepCard>
          )}

          {step === 3 && (
            <StepCard
              eyebrow="Step 3 of 5"
              icon={Home}
              title="Choose “Add to Home Screen”"
              body="Scroll down inside the Share sheet until you see “Add to Home Screen”. Tap it, then confirm the app name and tap Add."
            >
              <Steps
                items={[
                  'In the Share sheet, scroll past the apps row to the actions list.',
                  'Tap “Add to Home Screen”.',
                  'You can rename it (default: VibTribe). Tap “Add” in the top-right.',
                  'iOS closes Safari and drops the VibTribe icon on your Home Screen.',
                ]}
              />
              <div className="mt-4 p-3 rounded-2xl bg-vt-amber/10 border border-vt-amber/30 flex gap-2">
                <AlertTriangle size={14} className="text-vt-amber flex-shrink-0 mt-0.5" />
                <p className="text-xs text-vt-amber">
                  Don't see “Add to Home Screen”? Tap “Edit Actions” at the bottom of the Share sheet and turn it on.
                </p>
              </div>
              <NextButton onClick={() => setStep(4)} label="Icon is on my Home Screen — continue" />
            </StepCard>
          )}

          {step === 4 && (
            <StepCard
              eyebrow="Step 4 of 5"
              icon={Smartphone}
              title="Open VibTribe from your Home Screen"
              body="Tap the new VibTribe icon. It launches full-screen — no Safari address bar — just like a regular iPhone app."
            >
              <Steps
                items={[
                  'Find the VibTribe icon on your Home Screen.',
                  'Tap it — VibTribe opens in full-screen app mode.',
                  'You can move it to a folder or onto your dock like any other app.',
                  'To uninstall, long-press the icon and tap Remove App.',
                ]}
              />
              <Tip>
                Always open VibTribe from this icon — opening vibtribe.in in Safari signs you in to a separate browser session.
              </Tip>
              <NextButton onClick={() => setStep(5)} label="App is open — continue" />
            </StepCard>
          )}

          {step === 5 && (
            <StepCard
              eyebrow="Step 5 of 5"
              icon={UserPlus}
              title="Sign up & enable notifications"
              body="Create your account, then allow notifications so messages, calls and statuses arrive even when the app isn't open."
            >
              <Steps
                items={[
                  'Tap Sign Up and enter your name, email and password.',
                  'Verify your email with the 6-digit code we send.',
                  'When asked, tap “Allow” for notifications — iOS 16.4+ supports web push for Home Screen apps.',
                  'Allow Microphone & Camera only when you start a voice or video call.',
                  'iPhone contacts sync is optional — used only to suggest people you know.',
                ]}
              />
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
              <Faq q="Why does iPhone only allow this in Safari?">
                Apple restricts “Add to Home Screen” to Safari. Other browsers on iOS (Chrome, Firefox, Edge) all use Safari's engine but don't expose the install action.
              </Faq>
              <Faq q="I don't see “Add to Home Screen” in the Share sheet.">
                Scroll down inside the Share sheet — it's below the row of apps. If it's still missing, tap “Edit Actions” at the bottom and toggle it on.
              </Faq>
              <Faq q="Notifications aren't arriving.">
                Open the VibTribe Home Screen icon (not Safari), go to Profile → Notifications, and make sure they're enabled. iOS 16.4 or later is required for web push.
              </Faq>
              <Faq q="Does this work on iPad?">
                Yes — same flow. The Share button is in the top-right of Safari instead of the bottom toolbar.
              </Faq>
              <Faq q="Will I lose my chats if I delete the icon?">
                No. Your account and chats live on VibTribe's servers. Re-add the Home Screen icon and sign in again to pick up where you left off.
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
