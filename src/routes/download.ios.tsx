import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Apple, Share2, PlusSquare, Bell, Smartphone, ArrowLeft, CheckCircle2,
  ChevronDown, ChevronUp, AlertTriangle, ExternalLink, Settings as SettingsIcon,
} from 'lucide-react';

const TITLE = 'Install VibTribe on iPhone & iPad — Step-by-step guide';
const DESCRIPTION =
  'Install VibTribe on iOS in under a minute. Step-by-step Safari + Add to Home Screen guide with troubleshooting and permission help.';
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
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
});

const STEPS = [
  { id: 1, title: 'Open in Safari', subtitle: 'Use Apple\u2019s default browser', icon: Apple },
  { id: 2, title: 'Share menu', subtitle: 'Tap the Share icon', icon: Share2 },
  { id: 3, title: 'Add to Home Screen', subtitle: 'Pick from the menu', icon: PlusSquare },
  { id: 4, title: 'Launch & sign up', subtitle: 'Open the new icon', icon: Smartphone },
  { id: 5, title: 'Enable alerts', subtitle: 'Allow notifications', icon: Bell },
];

function DownloadIosPage() {
  const [step, setStep] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-xl border border-border hover:bg-muted transition-all" aria-label="Back">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">iPhone & iPad install</p>
            <h1 className="font-bold text-base sm:text-lg truncate">Get VibTribe on your iPhone</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-6">
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
              eyebrow="Step 1 of 5" icon={Apple} title="Open VibTribe in Safari"
              body={'Safari is required for the install option to appear. Chrome and other browsers on iOS cannot install web apps to the home screen.'}
            >
              <Steps items={[
                'Open the Safari app on your iPhone or iPad.',
                'Visit https://www.vibtribe.in in the address bar.',
                'Wait for the home page to fully load.',
              ]} />
              <Tip>Already in Safari? You\u2019re ready \u2014 just tap continue below.</Tip>
              <NextButton onClick={() => setStep(2)} label="I\u2019m in Safari \u2014 continue" />
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              eyebrow="Step 2 of 5" icon={Share2} title="Open the Share menu"
              body="Find the Share button \u2014 it\u2019s the square icon with an upward arrow. On iPhone it\u2019s at the bottom of the screen; on iPad it\u2019s near the top-right."
            >
              <Steps items={[
                'Tap the Share icon (square with an up-arrow).',
                'A list of actions will slide up from the bottom.',
                'Scroll the list if you don\u2019t see \u201CAdd to Home Screen\u201D right away.',
              ]} />
              <Tip>On newer iPhones the Share icon may appear inside the URL/menu bar at the bottom.</Tip>
              <NextButton onClick={() => setStep(3)} label="Share menu is open \u2014 continue" />
            </StepCard>
          )}

          {step === 3 && (
            <StepCard
              eyebrow="Step 3 of 5" icon={PlusSquare} title="Tap \u201CAdd to Home Screen\u201D"
              body="iOS will preview the icon and ask for a name. You can leave the default \u201CVibTribe\u201D or rename it."
            >
              <Steps items={[
                'Tap \u201CAdd to Home Screen\u201D in the share menu.',
                'Confirm the name (default: VibTribe).',
                'Tap \u201CAdd\u201D in the top-right corner.',
                'The VibTribe icon will appear on your Home Screen alongside other apps.',
              ]} />
              <div className="mt-4 p-3 rounded-2xl bg-vt-amber/10 border border-vt-amber/30 flex gap-2">
                <AlertTriangle size={14} className="text-vt-amber flex-shrink-0 mt-0.5" />
                <p className="text-xs text-vt-amber">
                  Don\u2019t see the option? You\u2019re probably in Chrome or another browser. Open this page in Safari and try again.
                </p>
              </div>
              <NextButton onClick={() => setStep(4)} label="Icon added \u2014 continue" />
            </StepCard>
          )}

          {step === 4 && (
            <StepCard
              eyebrow="Step 4 of 5" icon={Smartphone} title="Launch VibTribe & sign up"
              body="Always open VibTribe from the new home-screen icon \u2014 not from Safari. The icon launches a clean, full-screen app window with no browser chrome."
            >
              <Steps items={[
                'Find the VibTribe icon on your Home Screen.',
                'Tap it \u2014 the app opens full-screen without the browser bar.',
                'Sign up with your name, email and password (or sign in if you already have an account).',
                'Verify your email with the 6-digit code we send.',
              ]} />
              <Tip>VibTribe also works in regular Safari, but the home-screen install gives you a proper app icon, full-screen UI and lock-screen alerts.</Tip>
              <NextButton onClick={() => setStep(5)} label="I\u2019m signed in \u2014 continue" />
            </StepCard>
          )}

          {step === 5 && (
            <StepCard
              eyebrow="Step 5 of 5" icon={Bell} title="Allow notifications (recommended)"
              body="iOS 16.4+ supports web-push notifications for installed PWAs. Allow them so new messages, calls and status updates arrive on your lock screen even when VibTribe isn\u2019t open."
            >
              <Steps items={[
                'When iOS asks \u201CAllow VibTribe to send notifications?\u201D \u2014 tap Allow.',
                'If you missed the prompt, open Settings \u2192 Notifications \u2192 VibTribe and turn on Allow Notifications.',
                'Microphone & Camera prompts only appear when you start a voice or video call.',
              ]} />
              <div className="mt-5 p-4 rounded-2xl bg-vt-green/10 border border-vt-green/30">
                <p className="font-semibold text-vt-green flex items-center gap-2">
                  <CheckCircle2 size={16} /> You\u2019re all set!
                </p>
                <p className="text-xs text-foreground/80 mt-1">
                  Welcome to VibTribe \u2014 where your vibe finds its tribe. Open the app from your Home Screen and start chatting.
                </p>
              </div>
            </StepCard>
          )}
        </section>

        <section className="glass rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setHelpOpen(v => !v)}
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
              <Faq q="\u201CAdd to Home Screen\u201D isn\u2019t in the share menu.">
                You\u2019re likely in Chrome, Firefox, or another browser. iOS only allows installing web apps from <strong>Safari</strong>. Copy the URL, open Safari, and try again.
              </Faq>
              <Faq q="Notifications aren\u2019t coming through on iPhone.">
                Web-push needs iOS 16.4 or newer, and the app must be installed from the Home Screen first \u2014 not just opened in Safari. Check Settings \u2192 Notifications \u2192 VibTribe.
              </Faq>
              <Faq q="Will I lose data if I delete the icon?">
                No \u2014 your messages and account live on our servers. Reinstalling the icon and signing back in restores everything.
              </Faq>
              <Faq q="Is there a native iOS app on the App Store?">
                Not yet \u2014 the installable PWA gives you the same features today. A native iOS app is on our roadmap.
              </Faq>
              <a href="mailto:help.vibtribe.in@gmail.com" className="inline-flex items-center gap-1.5 text-primary text-xs font-semibold hover:underline">
                Still stuck? Email us <ExternalLink size={11} />
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StepCard({ eyebrow, icon: Icon, title, body, children }: any) {
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
          <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
          <span className="text-foreground/85">{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 p-3 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
      \uD83D\uDCA1 {children}
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
      {label} \u2192
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