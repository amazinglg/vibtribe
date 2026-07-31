import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ShieldCheck, Compass, Sparkles, Calendar, Target, Users, Lock } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';
import { breadcrumbLd, socialImageMeta } from '@/lib/seo';

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About VibTribe — Our Story & Vision' },
      { name: 'description', content: 'Learn about VibTribe — a privacy-first social messaging platform. Our mission, values, and vision for private, vibrant communication.' },
      { property: 'og:title', content: 'About VibTribe — Our Story & Vision' },
      { property: 'og:description', content: 'The story, values and vision behind VibTribe — a privacy-first social messaging platform.' },
      { property: 'og:url', content: 'https://www.vibtribe.in/about' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:title', content: 'About VibTribe — Our Story & Vision' },
      { name: 'twitter:description', content: 'The story, values and vision behind VibTribe — a privacy-first social messaging platform.' },
      ...socialImageMeta(),
    ],
    links: [{ rel: 'canonical', href: 'https://www.vibtribe.in/about' }],
    scripts: [breadcrumbLd([{ name: 'About', path: '/about' }])],
  }),
  component: AboutPage,
});

function AboutPage() {
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
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] gradient-primary rounded-full blur-3xl opacity-20" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-[26rem] h-[26rem] gradient-cyan rounded-full blur-3xl opacity-15" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 w-[24rem] h-[24rem] gradient-pink rounded-full blur-3xl opacity-10" />

      {/* Nav */}
      <header className="relative z-20">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <AppLogo size={32} />
            <Wordmark className="text-lg sm:text-xl" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-border text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          >
            <ArrowLeft size={14} /> Home
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-10 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 mb-5">
          <Sparkles size={13} className="text-primary" />
          <span className="text-[11px] sm:text-xs font-medium text-foreground/90">Our Story</span>
        </div>
        <h1 className="font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] mb-5">
          <span className="block text-white">About</span>
          <span className="block text-gradient-primary"><Wordmark className="text-4xl sm:text-5xl lg:text-6xl" /></span>
        </h1>
        <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
          VibTribe is a privacy-first social messaging platform built for the way real friendships, families and tribes
          actually communicate — freely, expressively, and without surveillance.
        </p>
      </section>

      {/* Story / Founded */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl border border-border p-5">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mb-3 glow-primary">
              <Calendar size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Founded in June 2026</h3>
            <p className="text-sm text-muted-foreground">Born out of a need for a chat experience that puts people, not advertisers, at the center.</p>
          </div>
          <div className="glass rounded-2xl border border-border p-5">
            <div className="w-10 h-10 rounded-xl gradient-cyan flex items-center justify-center mb-3">
              <Compass size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Built in India, for the world</h3>
            <p className="text-sm text-muted-foreground">Designed locally with global standards of privacy, security and craft.</p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">What we stand for</span>
          <h2 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight mt-2">Our values</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Lock, title: 'Privacy is non-negotiable', body: 'End-to-end encryption, on-device controls and zero data exploitation. Your conversations belong to you.' },
            { icon: ShieldCheck, title: 'Safety by design', body: 'Trust Lock, Secure Vault, screenshot warnings — protection is built in, not bolted on.' },
            { icon: Users, title: 'Community over algorithms', body: 'Tribes, broadcasts and statuses that bring people closer — without manipulative feeds.' },
            { icon: Sparkles, title: 'Joyful, expressive design', body: 'Bright moments, exclusive emojis and a craft-led interface that feels good to use every day.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl border border-border p-5 hover:border-primary/40 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Aim / Priorities */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="glass-strong rounded-3xl border border-border p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} className="text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Our aim</span>
            </div>
            <h3 className="font-extrabold text-xl sm:text-2xl mb-3">A safer internet for the next generation</h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              We&apos;re building VibTribe so that the next billion people coming online can connect, share and grow without
              fear of being surveilled, profiled or exploited. Private by default. Powerful by craft.
            </p>
          </div>
          <div className="glass-strong rounded-3xl border border-border p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-3">
              <Compass size={18} className="text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Our priorities</span>
            </div>
            <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary">•</span> Your privacy, always — before features, before growth.</li>
              <li className="flex gap-2"><span className="text-primary">•</span> A delightful, modern experience that respects your time.</li>
              <li className="flex gap-2"><span className="text-primary">•</span> Transparent policies and honest communication.</li>
              <li className="flex gap-2"><span className="text-primary">•</span> Long-term trust over short-term metrics.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-10 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">← Back to home</Link>
      </footer>
    </div>
  );
}
