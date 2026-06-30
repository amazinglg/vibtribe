import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ShieldCheck, Heart, Compass, Sparkles, Quote, Calendar, Target, Users, Lock } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';
import founderImg from '@/assets/founder-richa.png.asset.json';

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About VibTribe — Our Story, Vision & Co-Founder' },
      { name: 'description', content: 'Learn about VibTribe — founded in June 2026 by Richa. Our mission, values, and a personal note from our co-founder on building a private, vibrant social messaging platform.' },
      { property: 'og:title', content: 'About VibTribe — Our Story, Vision & Co-Founder' },
      { property: 'og:description', content: 'The story, values and vision behind VibTribe — a privacy-first social messaging platform.' },
    ],
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
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl border border-border p-5">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mb-3 glow-primary">
              <Calendar size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Founded in June 2026</h3>
            <p className="text-sm text-muted-foreground">Born out of a need for a chat experience that puts people, not advertisers, at the center.</p>
          </div>
          <div className="glass rounded-2xl border border-border p-5">
            <div className="w-10 h-10 rounded-xl gradient-pink flex items-center justify-center mb-3">
              <Heart size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Visionary — Richa</h3>
            <p className="text-sm text-muted-foreground">Co-Founder &amp; product lead, on a mission to make private, joyful communication the default.</p>
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

      {/* Co-Founder's Note */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Co-Founder&apos;s Note</span>
          <h2 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight mt-2">A message from Richa</h2>
        </div>

        <div className="relative rounded-[2rem] overflow-hidden border border-border glass-strong">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 gradient-pink rounded-full blur-3xl opacity-30" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 gradient-primary rounded-full blur-3xl opacity-25" />

          <div className="relative grid lg:grid-cols-5 gap-0">
            {/* Photo */}
            <div className="lg:col-span-2 relative">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[20rem] overflow-hidden">
                <img
                  src={founderImg.url}
                  alt="Richa, Co-Founder of VibTribe"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {/* Gradient blend into the card on desktop */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-background/70" />
                {/* Name plate */}
                <div className="absolute bottom-4 left-4 right-4 lg:right-auto flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
                    <Quote size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="text-white font-extrabold text-lg leading-tight drop-shadow">Richa</div>
                    <div className="text-xs text-white/80">Co-Founder &amp; Visionary, VibTribe</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="lg:col-span-3 p-6 sm:p-10 relative">
              <Quote size={48} className="text-primary/30 mb-3" />
              <p className="text-base sm:text-lg leading-relaxed text-foreground/90 mb-4">
                I started <Wordmark className="text-base sm:text-lg" /> because I believe the place where we talk to the people we love
                shouldn&apos;t feel like a place we&apos;re being watched. Every message, every memory, every late-night voice note —
                it deserves a home that respects it.
              </p>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground mb-4">
                We are a small, deeply committed team building something that we wish existed for ourselves, our families,
                and our friends. A space that is private, expressive, and unapologetically human. No ads. No tracking.
                No compromises on the things that matter.
              </p>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground mb-6">
                Thank you for trusting us early. We&apos;re only getting started — and the future we&apos;re building is one where
                your tribe, your moments, and your voice always stay yours.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                <span className="font-display italic text-lg text-gradient-primary font-bold">— Richa</span>
              </div>
            </div>
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
