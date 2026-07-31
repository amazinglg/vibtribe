import React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Flag, ShieldCheck, ShieldAlert, Clock, ShieldQuestion, Mail } from 'lucide-react'
import AppLogo from '@/components/ui/AppLogo'
import Wordmark from '@/components/ui/Wordmark'
import { breadcrumbLd, socialImageMeta } from '@/lib/seo'

const TITLE = 'How Reporting Works — VibTribe Help'
const DESCRIPTION =
  'Learn how to report content on VibTribe, what happens when you report, how long reviews take, and how to appeal a decision.'
const URL = 'https://www.vibtribe.in/help/reporting'

export const Route = createFileRoute('/help/reporting')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: URL },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      ...socialImageMeta(),
    ],
    links: [{ rel: 'canonical', href: URL }],
    scripts: [breadcrumbLd([{ name: 'Help', path: '/help/reporting' }, { name: 'How reporting works', path: '/help/reporting' }])],
  }),
  component: HelpReportingPage,
})

function HelpReportingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-4xl mx-auto flex items-center justify-between px-4 sm:px-6 pt-6">
        <Link to="/" className="flex items-center gap-2">
          <AppLogo className="w-8 h-8" />
          <Wordmark className="h-5" />
        </Link>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Home
        </Link>
      </header>

      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-border text-xs text-muted-foreground mb-4">
          <Flag size={12} /> Help Center · Trust &amp; Safety
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          How reporting works on VibTribe
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
          VibTribe is end-to-end private by default. Reporting is how we surface only the content you flag for human review — nothing else.
        </p>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
        <Card icon={<Flag size={20} />} title="What you can report">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Individual messages (text, images, videos, voice notes, files)</li>
            <li>Entire chats and tribes (group chats)</li>
            <li>Status posts</li>
            <li>User profiles</li>
          </ul>
          <p className="mt-3">Look for the flag icon or long-press a message to open the reporting sheet.</p>
        </Card>

        <Card icon={<ShieldCheck size={20} />} title="What happens when you report">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>You pick a reason (Child Safety, Harassment, Spam, etc.) and optionally add context.</li>
            <li>Only the specific piece of content you reported is decrypted and snapshotted as evidence.</li>
            <li>The report enters our moderation queue. Reports are private — the reported user does not see who reported them.</li>
            <li>A trained moderator reviews the evidence and decides whether the content violates our Community Guidelines.</li>
            <li>You&apos;ll receive an in-app notification with the outcome.</li>
          </ol>
        </Card>

        <Card icon={<Clock size={20} />} title="Review timelines">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>Child Safety, CSAE, Grooming</b> — prioritised for immediate review, typically within 24 hours.</li>
            <li><b>Other categories</b> — reviewed in the order received, typically within 72 hours.</li>
            <li>Complex cases may take longer if we need to consult external partners or authorities.</li>
          </ul>
        </Card>

        <Card icon={<ShieldAlert size={20} />} title="Possible outcomes">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>No action</b> — the content does not violate our guidelines.</li>
            <li><b>Content removed</b> — the reported message or post is deleted.</li>
            <li><b>Account suspended</b> — temporarily blocked while the situation is resolved.</li>
            <li><b>Account banned</b> — permanent removal for severe or repeat violations.</li>
            <li>Confirmed child-safety violations are reported to the appropriate authorities.</li>
          </ul>
        </Card>

        <Card icon={<ShieldQuestion size={20} />} title="Appealing a decision">
          <p>
            If we take action on your account or content and you believe it was a mistake, you can appeal. When we take action, you&apos;ll get an in-app notification with an appeal link. Submit one appeal per decision — a moderator will re-review and respond in-app.
          </p>
          <p className="mt-3">
            Approving an appeal reverses the underlying action (for example, restoring a suspended account). Rejecting an appeal upholds the original decision.
          </p>
        </Card>

        <Card icon={<Mail size={20} />} title="Contact Trust &amp; Safety">
          <p>
            Time-sensitive concerns — especially involving minors — should be emailed directly to our Trust &amp; Safety team.
          </p>
          <a
            href="mailto:help.vibtribe.in@gmail.com"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-blue-500 text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Mail size={16} /> help.vibtribe.in@gmail.com
          </a>
        </Card>

        <section className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            See also <Link to="/child-safety" className="text-primary hover:underline">Child Safety Standards</Link> · <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> · <Link to="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
          </p>
        </section>
      </main>
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl border border-border p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">{icon}</div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="text-sm sm:text-base text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  )
}