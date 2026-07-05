import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeft, ShieldCheck, Ban, Users, Flag, Gavel, Handshake, Mail,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';

const TITLE = 'Child Safety Standards — VibTribe';
const DESCRIPTION =
  'VibTribe maintains a zero-tolerance policy toward CSAM, CSAE, grooming, and any exploitation of minors. Learn how we protect children through Guardian Flow, moderation, and cooperation with authorities.';
const URL = 'https://www.vibtribe.in/child-safety';

export const Route = createFileRoute('/child-safety')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
  component: ChildSafetyPage,
});

function ChildSafetyPage() {
  return (
    <div
      className="min-h-screen gradient-bg-page text-foreground overflow-x-hidden relative"
      style={{
        paddingTop: 'min(var(--safe-top), 2.25rem)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      <div className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] gradient-cyan rounded-full blur-3xl opacity-20" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[24rem] h-[24rem] gradient-pink rounded-full blur-3xl opacity-10" />

      <header className="relative z-20">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <AppLogo size={32} />
            <Wordmark className="text-lg sm:text-xl" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-border text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all">
            <ArrowLeft size={14} /> Home
          </Link>
        </nav>
      </header>

      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-border text-[11px] font-semibold uppercase tracking-widest text-primary mb-4">
          <ShieldCheck size={14} /> Child Safety
        </div>
        <h1 className="font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight bg-gradient-to-r from-primary via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
          Child Safety Standards
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          VibTribe is committed to providing a safe environment for everyone. We maintain a zero-tolerance policy toward child sexual abuse and exploitation (CSAE), child sexual abuse material (CSAM), grooming, trafficking, or any activity that exploits minors.
        </p>
      </section>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
        <Card icon={<ShieldCheck size={20} />} title="Our Commitment">
          <p>VibTribe places user safety — and especially the safety of children and young people — at the heart of everything we build. As part of this commitment we:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>Prioritize the safety and well-being of every user on the platform.</li>
            <li>Protect children and young people from harm, exploitation, and abuse.</li>
            <li>Maintain strict moderation standards across all user-generated content.</li>
            <li>Comply with applicable child protection laws in the jurisdictions we operate in.</li>
            <li>Remove illegal content immediately upon detection or report.</li>
            <li>Cooperate with law enforcement and child-safety authorities where legally required.</li>
          </ul>
        </Card>

        <Card icon={<Ban size={20} />} title="Zero Tolerance Policy">
          <p>VibTribe strictly prohibits, and will never tolerate, any of the following on our platform:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>Child Sexual Abuse Material (CSAM).</li>
            <li>Child Sexual Abuse and Exploitation (CSAE) of any form.</li>
            <li>Grooming or attempts to build inappropriate relationships with minors.</li>
            <li>Sexual exploitation of minors, including sexualized content depicting them.</li>
            <li>Solicitation of minors for sexual, financial, or other exploitative purposes.</li>
            <li>Human trafficking involving minors.</li>
            <li>Any attempt to contact minors for exploitative, abusive, or harmful purposes.</li>
            <li>Content that promotes, glorifies, normalizes, or encourages abuse of minors.</li>
          </ul>
          <p className="mt-4 font-semibold text-foreground">Violations result in:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>Immediate removal of the offending content.</li>
            <li>Permanent suspension of the associated account(s).</li>
            <li>Reporting to relevant law-enforcement or child-protection authorities where legally required.</li>
          </ul>
        </Card>

        <Card icon={<Users size={20} />} title="Guardian Flow Protection">
          <p>VibTribe operates a dedicated <strong className="text-foreground">Guardian Flow</strong> to safeguard minors on the platform:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>Users aged <strong className="text-foreground">13–17</strong> are protected through the Guardian Flow onboarding process.</li>
            <li>Verifiable parent or legal-guardian consent is required before the account is activated.</li>
            <li>Additional safeguards and stricter defaults are applied to younger users.</li>
            <li>Guardian Flow exists to promote a safer, age-appropriate digital experience for every minor on VibTribe.</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Users under 13 are not permitted to create an account on VibTribe.</p>
        </Card>

        <Card icon={<Flag size={20} />} title="Reporting Child Safety Concerns">
          <p>Every user can report suspected child-safety violations directly from the app. You can report:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>Profiles that appear to belong to, or target, minors inappropriately.</li>
            <li>Individual chats or conversations.</li>
            <li>Media (images, videos, audio) shared with you.</li>
            <li>Inappropriate behaviour or messages.</li>
            <li>Suspected grooming activity.</li>
            <li>Suspected exploitation, trafficking, or CSAM.</li>
          </ul>
          <p className="mt-3">All reports are reviewed promptly by the VibTribe Trust &amp; Safety team.</p>
        </Card>

        <Card icon={<ShieldCheck size={20} />} title="Moderation & Enforcement">
          <p>To keep VibTribe safe, we combine multiple layers of moderation:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>User reporting from within the app.</li>
            <li>In-app moderation tools such as block, mute, and report.</li>
            <li>Account review processes for flagged or suspicious activity.</li>
            <li>Automated detection signals, where appropriate.</li>
            <li>Manual review of reported content by our Trust &amp; Safety team.</li>
          </ul>
          <p className="mt-3">Repeat offenders and any account found engaging in child-safety violations are permanently removed from the platform.</p>
        </Card>

        <Card icon={<Gavel size={20} />} title="Cooperation with Authorities">
          <p>Where required by applicable law, VibTribe cooperates with:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>Relevant law-enforcement agencies.</li>
            <li>Recognised child-protection organisations.</li>
            <li>Courts, regulators, and other legal authorities.</li>
          </ul>
          <p className="mt-3">We respond to lawful requests through appropriate legal channels and maintain records as required by applicable law.</p>
        </Card>

        <Card icon={<Mail size={20} />} title="Child Safety Contact">
          <p>Concerns relating to child safety, CSAM, CSAE, grooming, or legal requests from authorities may be sent to:</p>
          <a
            href="mailto:help.vibtribe.in@gmail.com"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-blue-500 text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Mail size={16} /> help.vibtribe.in@gmail.com
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            Please include as much detail as possible (usernames, timestamps, screenshots) so our team can investigate quickly. If a child is in immediate danger, contact your local emergency services first.
          </p>
        </Card>

        <Card icon={<Flag size={20} />} title="Reporting & Moderation System">
          <p>
            VibTribe is built around a Trust Lock architecture: messages, media, and status posts are protected end-to-end and are not routinely accessible to VibTribe staff. Because of that, moderation happens on an opt-in basis — through user reports.
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li><b>In-app reporting</b> — every message, photo, video, voice note, file, status, chat, and profile has a Report option.</li>
            <li><b>Explicit consent snapshot</b> — when you submit a report, only that specific piece of content is decrypted and stored as evidence for review, alongside metadata about the reported user and chat. Nothing else is unlocked.</li>
            <li><b>Master-admin review</b> — reports are reviewed by trained moderators. High-priority categories (Child Safety, CSAE, Grooming) are queued for immediate review.</li>
            <li><b>Enforcement actions</b> — depending on the outcome, moderators may remove the reported content, suspend the account, or permanently ban the account. Confirmed child-safety violations are removed immediately and reported to the appropriate authorities.</li>
            <li><b>Retention</b> — evidence snapshots are retained only as long as required for review, legal obligations, and audit trails.</li>
          </ul>
          <p className="mt-3">
            Learn more in our <Link to="/help/reporting" className="text-primary hover:underline">How reporting works</Link> help article.
          </p>
        </Card>

        <Card icon={<ShieldQuestion size={20} />} title="Appeals">
          <p>
            If your account or content was actioned and you believe the decision was made in error, you can appeal it. When we take action, we send an in-app notification with a link to submit an appeal. A moderator will re-review your case and respond in-app.
          </p>
          <p className="mt-3">
            One pending appeal is allowed per decision. Approving an appeal reverses the underlying action (for example, restoring a suspended account).
          </p>
        </Card>

        <section className="text-center pt-4">
          <p className="text-xs text-muted-foreground">Last Updated: July 2026</p>
          <p className="mt-3 text-xs text-muted-foreground">
            See also <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> · <Link to="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link> · <Link to="/data-notice" className="text-primary hover:underline">Data Notice</Link>
          </p>
        </section>
      </main>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl border border-border p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 border border-primary/30 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}