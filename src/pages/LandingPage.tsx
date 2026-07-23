import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  ShieldCheck, Sparkles, PhoneCall, Lock, Zap, Palette,
  ArrowRight, MessageCircle, Check, Github, Twitter, Globe,
  Smartphone, Apple, Download, Share2, PlusSquare,
  EyeOff, Ban, Users, KeyRound, X as XIcon, HelpCircle,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/contexts/LanguageContext';
import ContactFormModal from '@/components/ContactFormModal';
import heroPhones from '@/assets/hero-phones.png';

export default function LandingPage() {
  const { t } = useT();
  const [contactOpen, setContactOpen] = React.useState(false);

  return (
    <div
      className="min-h-screen aurora-home-page text-foreground overflow-x-hidden relative"
      style={{
        // Android safe-area: MainActivity injects --safe-top as raw physical
        // pixels, which become oversized CSS px on high-DPR devices. Cap at
        // 2.25rem (~36px) — enough to clear any status bar / notch on phones
        // while preventing the huge empty band above the header.
        paddingTop: 'min(var(--safe-top), 2.25rem)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      <div className="aurora-ambient" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-[28rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" aria-hidden="true" />

      {/* Nav */}
      <header className="relative z-20">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <AppLogo size={32} />
            <Wordmark className="text-lg sm:text-xl" />
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.nav.features')}</a>
            <Link to="/about" className="hover:text-foreground transition-colors">{t('landing.nav.about')}</Link>
            <a href="#contact" className="hover:text-foreground transition-colors">{t('landing.nav.contact')}</a>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to="/sign-in"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              {t('landing.nav.login')}
            </Link>
            <Link
              to="/sign-up"
              className="px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold aurora-primary-cta hover:opacity-95 transition-all flex items-center gap-1 whitespace-nowrap"
            >
              {t('landing.nav.signup')}
              <ArrowRight size={14} />
            </Link>
          </div>
        </nav>
        <div className="px-4 pb-2 flex justify-center sm:pb-1 sm:justify-end sm:max-w-7xl sm:mx-auto sm:pr-6">
          <LanguageSwitcher variant="pill" />
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-12 sm:pb-20">
        <div className="aurora-glass-shell rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 lg:p-16 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 aurora-hero-sheen" aria-hidden="true" />
        <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Left: copy */}
          <div className="float-up text-center lg:text-left order-2 lg:order-1">
            <div className="aurora-copy-chip inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6">
              <span className="h-2 w-2 rounded-full bg-vt-green shadow-[0_0_12px_rgba(34,197,94,0.9)]" />
              <span className="text-[11px] sm:text-xs font-bold tracking-[0.14em] uppercase text-foreground/75">Private by design · No ads · No data selling</span>
            </div>
            <h1 className="font-extrabold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl tracking-tight leading-[1.06] mb-6">
              <span className="block text-foreground">Your conversations</span>
              <span className="block aurora-text-gradient-purple italic">belong to you.</span>
            </h1>
            <p className="max-w-xl mx-auto lg:mx-0 text-sm sm:text-base lg:text-xl text-muted-foreground leading-relaxed mb-7">
              <Wordmark className="text-sm sm:text-base lg:text-lg" /> is a private messenger for real conversations — end-to-end encrypted chats, voice &amp; video calls, disappearing status, and a personal vault only you can unlock.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 mb-5">
              <Link
                to="/sign-up"
                className="px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl aurora-primary-cta text-sm font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                Create your free account
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/sign-in"
                className="px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl aurora-secondary-cta text-foreground text-sm font-bold hover:border-primary/50 transition-all text-center"
              >
                I already have an account
              </Link>
            </div>
            <a
              href="#download"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('download')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="mb-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl aurora-download-pill text-sm font-semibold hover:border-primary/50 transition-all"
            >
              <Download size={16} /> Get the Android app
              <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/20 text-primary px-2 py-0.5 rounded-full ml-1">New</span>
            </a>
            <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center justify-center lg:justify-start gap-1.5">
              <Lock size={11} /> Takes 30 seconds. No credit card. Delete your account anytime.
            </p>
          </div>

          {/* Right: phone showcase */}
          <div className="relative order-1 lg:order-2 aurora-phone-stage flex min-h-[360px] sm:min-h-[520px] items-center justify-center">
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute top-1/4 left-1/4 w-72 h-72 gradient-primary rounded-full blur-3xl opacity-35" />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 gradient-pink rounded-full blur-3xl opacity-25" />
            </div>
            <img
              src={heroPhones}
              alt="VibTribe encrypted messaging app shown on three smartphones — chat list, end-to-end encrypted conversation, and contact profile"
              width={1280}
              height={1280}
              className="aurora-phone-card w-full max-w-[21rem] sm:max-w-lg lg:max-w-none mx-auto"
            />
            <div className="hidden sm:flex absolute top-8 -left-2 lg:left-4 items-center gap-2 px-3 py-2 rounded-2xl aurora-download-pill">
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-[11px] font-semibold text-foreground">Only you can read it</span>
            </div>
            <div className="aurora-trust-toast absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-3xl px-4 py-3 sm:-left-2 sm:bottom-10 sm:translate-x-0 lg:left-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vt-green/20">
                <span className="h-3 w-3 rounded-full bg-vt-green" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Trust Lock Active</p>
                <p className="text-[11px] text-muted-foreground">Screenshots disabled</p>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mt-8 sm:mt-12">
          <AuroraFeature icon={<Ban size={22} />} label="No ads" tone="magenta" />
          <AuroraFeature icon={<Lock size={22} />} label="Encrypted" tone="purple" />
          <AuroraFeature icon={<EyeOff size={22} />} label="No tracking" tone="violet" />
          <AuroraFeature icon={<Sparkles size={22} />} label="Vanishing" tone="amber" />
          <AuroraFeature icon={<KeyRound size={22} />} label="Vault" tone="green" className="col-span-2 md:col-span-1" />
        </div>
      </section>

      {/* Why VibTribe */}
      <section id="why" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-10">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Why VibTribe</span>
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-2">Built for real conversations and Privacy, not for ads.</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Other messengers turned your chats into a data product. We took the opposite path — a modern, beautiful app where privacy is the default, not a setting you have to find.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto text-left perspective-1000">
          <WhyTile
            icon={<ShieldCheck size={20} className="text-white" />}
            title="Only you can read it"
            desc="Every message, call and file is end-to-end encrypted on your device. Not even we can open them."
            accent="primary"
          />
          <WhyTile
            icon={<Lock size={20} className="text-white" />}
            title="A vault just for you"
            desc="Move sensitive chats behind your personal PIN or pattern. Hidden from your chat list — visible only to you."
            accent="cyan"
          />
          <WhyTile
            icon={<EyeOff size={20} className="text-white" />}
            title="Trust Lock"
            desc="Turn on Trust Lock in any chat to block screenshots and screen recording. What&apos;s shared stays between you."
            accent="pink"
          />
          <WhyTile
            icon={<Sparkles size={20} className="text-white" />}
            title="Status that disappears"
            desc="Share moments with the people who matter. Gone in 24 hours — no permanent profile grid to curate."
            accent="amber"
          />
          <WhyTile
            icon={<Users size={20} className="text-white" />}
            title="Private group Tribes"
            desc="Family and friend groups protected by a shared passcode. New members can&apos;t read older messages."
            accent="green"
          />
          <WhyTile
            icon={<PhoneCall size={20} className="text-white" />}
            title="Calls that stay yours"
            desc="Crystal-clear voice &amp; video calls with the same end-to-end encryption. No recordings, no ads, no listening in."
            accent="violet"
          />
        </div>
      </section>

      {/* Comparison */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mb-2">Why switch to VibTribe?</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">A quick side-by-side of how VibTribe compares to typical messaging apps.</p>
        </div>

        <div className="glass-strong rounded-3xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 text-xs sm:text-sm">
            <div className="p-3 sm:p-4 font-semibold text-muted-foreground">What matters</div>
            <div className="p-3 sm:p-4 font-bold text-primary text-center">VibTribe</div>
            <div className="p-3 sm:p-4 font-semibold text-muted-foreground text-center">Other messaging apps</div>

            <CompareRow label="Ads inside the app" vt="No" other="Often" />
            <CompareRow label="Your data sold or shared" vt="Never" other="Commonly" />
            <CompareRow label="End-to-end encryption by default" vt="Yes" other="Varies" />
            <CompareRow label="Hidden vault chats behind a PIN" vt="Yes" other="Rare" />
            <CompareRow label="Screenshot &amp; screen-record protection" vt="Yes" other="Rare" />
            <CompareRow label="Status disappears in 24h" vt="Yes" other="Varies" />
            <CompareRow label="You hold your encryption keys" vt="Yes" other="Rare" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-3">Comparison reflects common defaults across mainstream messaging apps.</p>
      </section>

      {/* Features — Bento */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-10">
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mb-2">Everything you need. Nothing you don&apos;t.</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">A modern messenger designed around one idea: your conversations are none of our business.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-[minmax(170px,auto)]">
          {/* Hero feature - spans 2 on lg */}
          <FeatureTile
            icon={<ShieldCheck className="text-primary" size={22} />}
            title="Only you and them. Nobody else."
            desc="Every chat, call and file is end-to-end encrypted on your device before it ever leaves. Not even VibTribe can read them."
            className="lg:col-span-2 lg:row-span-2"
            big
            accent="gradient-primary"
          />
          <FeatureTile
            icon={<Sparkles className="text-vt-pink" size={20} />}
            title="24-hour Status"
            desc="Share the moment, not a permanent profile. Everything vanishes after a day."
            accent="gradient-pink"
          />
          <FeatureTile
            icon={<PhoneCall className="text-vt-cyan" size={20} />}
            title="Private voice &amp; video"
            desc="HD calls with the same encryption as your chats. Peaceful, ad-free conversations."
            accent="gradient-cyan"
          />
          <FeatureTile
            icon={<Lock className="text-primary" size={20} />}
            title="Private Vault"
            desc="Hide sensitive chats behind your personal PIN or pattern. Nothing shows in the main list."
          />
          <FeatureTile
            icon={<Zap className="text-vt-amber" size={20} />}
            title="Instant &amp; reliable"
            desc="Messages arrive the moment you hit send — even on flaky mobile networks."
          />
          <FeatureTile
            icon={<Palette className="text-vt-violet" size={20} />}
            title="Beautiful by default"
            desc="A calm, premium interface that feels great to use every single day."
          />
        </div>
      </section>

      {/* Get the App — Platform Availability */}
      <section id="download" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Get VibTribe</span>
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-2">Install in under a minute.</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Native Android app today. iPhone users can install it from Safari as a home-screen app in seconds.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {/* Android Card */}
          <div className="glass rounded-3xl border border-border p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 gradient-primary rounded-full blur-3xl opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
                  <Smartphone size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Android</h3>
                  <p className="text-xs text-muted-foreground">Official VibTribe app · Guided install</p>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-foreground/80 mb-5">
                <li className="flex items-start gap-2"><Check size={14} className="text-primary mt-0.5 flex-shrink-0" /> Official signed build — safe to install</li>
                <li className="flex items-start gap-2"><Check size={14} className="text-primary mt-0.5 flex-shrink-0" /> Instant push notifications &amp; background calls</li>
                <li className="flex items-start gap-2"><Check size={14} className="text-primary mt-0.5 flex-shrink-0" /> Play Store rollout in progress</li>
              </ul>

              <a
                href="/download/android"
                className="w-full px-4 py-3 rounded-2xl gradient-primary text-white text-sm font-semibold flex items-center justify-center gap-2 glow-primary hover:opacity-95 transition-all"
              >
                <Download size={16} /> Download for Android
              </a>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Free · ~38 MB · Step-by-step install guide included
              </p>
            </div>
          </div>

          {/* iOS Card */}
          <div className="glass rounded-3xl border border-border p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 gradient-cyan rounded-full blur-3xl opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl gradient-cyan flex items-center justify-center glow-cyan">
                  <Apple size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">iPhone & iPad</h3>
                  <p className="text-xs text-muted-foreground">Install from Safari · No App Store needed</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Add VibTribe to your home screen in 3 quick steps using Safari:
              </p>

              <ol className="space-y-2 text-sm text-foreground/80 mb-5">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>{t('landing.app.ios.step1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span><Share2 size={12} className="inline mx-0.5 text-primary" /> {t('landing.app.ios.step2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span><PlusSquare size={12} className="inline mx-0.5 text-primary" /> {t('landing.app.ios.step3')}</span>
                </li>
              </ol>

              <a
                href="/download/ios"
                className="w-full px-4 py-3 rounded-2xl glass border border-primary/40 text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:border-primary transition-all"
              >
                <Apple size={16} /> Open iPhone install guide
              </a>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-5">
          Native iOS app is on our roadmap. The PWA gives you the full experience today.
        </p>
      </section>

      {/* About */}
      <section id="about" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="glass-strong rounded-3xl border border-border p-6 sm:p-10 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 gradient-primary rounded-full blur-3xl opacity-20" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Our mission</span>
            <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-4 max-w-2xl">
              We believe your private conversations should stay private.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              VibTribe was built for people who are tired of being the product. No ads. No tracking pixels. No selling your chats to train someone else&apos;s model. Just a beautiful, modern messenger for the people you actually care about — your family, your closest friends, your tribe.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">FAQ</span>
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-2">Answers before you sign up</h2>
        </div>
        <div className="space-y-3">
          <FaqItem q="Is VibTribe really free?" a="Yes — completely free. No ads, no paywalls on core messaging. We may offer optional premium features later, but private chats, calls and status will always be free." />
          <FaqItem q="Can VibTribe read my messages?" a="No. Your messages, calls and files are end-to-end encrypted on your device. We never see the contents, and we couldn't hand them over even if we were asked." />
          <FaqItem q="Why is the Android app an APK and not on the Play Store?" a="It's the same official app — signed by us — while our Play Store review is in progress. You'll install it once and get updates automatically." />
          <FaqItem q="What about iPhone?" a="You can install VibTribe from Safari as a home-screen app in seconds and get the full experience today. A native iOS build is on the roadmap." />
          <FaqItem q="Can I delete my account?" a="Anytime, from inside the app. Your data is removed and your account is gone — no forms, no waiting." />
          <FaqItem q="Do I need to give a phone number?" a="You sign up with your mobile number or email. It's used to help friends find you — never shared with advertisers." />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Contact</span>
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-2">Real humans. Real replies.</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">Questions, feedback, or something not working? We&apos;d love to hear from you.</p>
        </div>
        <div className="max-w-md mx-auto flex justify-center">
          <button
            onClick={() => setContactOpen(true)}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl gradient-primary text-white text-sm font-semibold glow-primary hover:opacity-90 transition-all"
          >
            <MessageCircle size={16} />
            Contact us
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-5">
          Or email us directly at{' '}
          <a href="mailto:help.vibtribe.in@gmail.com" className="text-primary font-semibold hover:underline">
            help.vibtribe.in@gmail.com
          </a>
        </p>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-3xl gradient-tri p-[2px]">
          <div className="rounded-[calc(1.5rem-2px)] bg-background/95 backdrop-blur-xl px-6 py-10 sm:p-14 text-center">
            <h2 className="font-bold text-2xl sm:text-4xl text-foreground mb-2">Take your conversations back.</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto mb-6">Join VibTribe today — free, private, and built for the people who matter most.</p>
            <Link
              to="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl gradient-primary text-white text-sm font-semibold glow-primary hover:opacity-90 transition-all"
            >
              Create your free account
              <ArrowRight size={16} />
            </Link>
            <p className="text-[11px] text-muted-foreground mt-4">30 seconds to sign up · No credit card · Delete anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24 lg:pb-8 flex flex-col sm:flex-row items-center sm:justify-between gap-6">
          <div className="flex items-center gap-2">
            <AppLogo size={24} />
            <Wordmark className="text-sm" />
            <span className="text-xs text-muted-foreground hidden sm:inline ml-2">— {t('landing.footer.tagline')}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full text-center text-xs text-muted-foreground sm:flex sm:w-auto sm:items-center sm:gap-5 sm:text-left">
            <Link to="/terms" className="hover:text-foreground transition-colors">{t('landing.footer.terms')}</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">{t('landing.footer.privacy')}</Link>
            <Link to="/data-notice" className="hover:text-foreground transition-colors">Data Notice</Link>
            <Link to="/subprocessors" className="hover:text-foreground transition-colors">Subprocessors</Link>
            <Link to="/child-safety" className="hover:text-foreground transition-colors">Child Safety</Link>
            <Link to="/help/reporting" className="hover:text-foreground transition-colors">Reporting</Link>
            <span className="col-span-2 sm:col-auto">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
      <ContactFormModal open={contactOpen} onClose={() => setContactOpen(false)} external />

    </div>
  );
}

function AuroraFeature({
  icon,
  label,
  tone,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'magenta' | 'purple' | 'violet' | 'amber' | 'green';
  className?: string;
}) {
  const toneClass: Record<typeof tone, string> = {
    magenta: 'aurora-feature-icon--magenta',
    purple: 'aurora-feature-icon--purple',
    violet: 'aurora-feature-icon--violet',
    amber: 'aurora-feature-icon--amber',
    green: 'aurora-feature-icon--green',
  };

  return (
    <div className={`aurora-feature-card rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-3 ${className}`}>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${toneClass[tone]}`}>
        {icon}
      </div>
      <p className="text-sm font-bold tracking-tight text-foreground">{label}</p>
    </div>
  );
}

function FeatureTile({
  icon, title, desc, className = '', big = false, accent,
}: {
  icon: React.ReactNode; title: string; desc: string;
  className?: string; big?: boolean; accent?: string;
}) {
  return (
    <div className={`relative glass rounded-2xl sm:rounded-3xl border border-border p-5 sm:p-6 overflow-hidden group hover:border-primary/40 transition-all ${className}`}>
      {accent && (
        <div className={`absolute -top-10 -right-10 w-32 h-32 ${accent} rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity`} />
      )}
      <div className="relative">
        <div className="w-10 h-10 rounded-xl glass border border-border flex items-center justify-center mb-3">
          {icon}
        </div>
        <h3 className={`font-bold text-foreground mb-1.5 ${big ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>{title}</h3>
        <p className={`text-muted-foreground leading-relaxed ${big ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>{desc}</p>
        {big && (
          <ul className="mt-4 space-y-1.5 text-xs sm:text-sm text-foreground/80">
            <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> AES-GCM + ECDH key exchange</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> Your PIN never leaves your device</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> Zero-knowledge architecture</li>
          </ul>
        )}
      </div>
    </div>
  );
}

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2">
      <div className="w-8 h-8 rounded-lg glass border border-border flex items-center justify-center">{icon}</div>
      <span className="text-[11px] sm:text-sm font-semibold text-foreground/90">{label}</span>
    </div>
  );
}

function CompareRow({ label, vt, other }: { label: string; vt: string; other: string }) {
  const cell = (val: string, positive: boolean) => (
    <div className="p-3 sm:p-4 border-t border-border/60 text-center">
      {positive ? (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <Check size={14} /> {val}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XIcon size={14} /> {val}
        </span>
      )}
    </div>
  );
  const positiveWords = ['Yes', 'Never'];
  return (
    <>
      <div className="p-3 sm:p-4 border-t border-border/60 text-foreground/85 font-medium" dangerouslySetInnerHTML={{ __html: label }} />
      {cell(vt, positiveWords.includes(vt))}
      {cell(other, positiveWords.includes(other))}
    </>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="glass rounded-2xl border border-border p-4 sm:p-5 group open:border-primary/40 transition-colors">
      <summary className="flex items-start gap-3 cursor-pointer list-none">
        <HelpCircle size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <span className="font-semibold text-foreground text-sm sm:text-base flex-1">{q}</span>
        <span className="text-primary text-lg leading-none transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 pl-7 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </details>
  );
}

function WhyTile({
  icon,
  title,
  desc,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: 'primary' | 'cyan' | 'pink' | 'amber' | 'green' | 'violet';
}) {
  const accentMap: Record<typeof accent, { gradient: string; iconGradient: string; text: string; border: string }> = {
    primary: { gradient: 'from-violet-500/20 to-purple-500/10', iconGradient: 'gradient-primary', text: 'text-violet-400', border: 'border-violet-500/20' },
    cyan: { gradient: 'from-cyan-500/20 to-blue-500/10', iconGradient: 'gradient-cyan', text: 'text-cyan-400', border: 'border-cyan-500/20' },
    pink: { gradient: 'from-pink-500/20 to-rose-500/10', iconGradient: 'gradient-pink', text: 'text-pink-400', border: 'border-pink-500/20' },
    amber: { gradient: 'from-amber-500/20 to-yellow-500/10', iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-500', text: 'text-amber-400', border: 'border-amber-500/20' },
    green: { gradient: 'from-emerald-500/20 to-teal-500/10', iconGradient: 'bg-gradient-to-br from-emerald-500 to-green-500', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    violet: { gradient: 'from-fuchsia-500/20 to-violet-500/10', iconGradient: 'bg-gradient-to-br from-violet-500 to-fuchsia-500', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20' },
  };
  const a = accentMap[accent];
  return (
    <div className="group relative h-full transition-all duration-500 [transform-style:preserve-3d] hover:[transform:rotateX(5deg)_rotateY(-5deg)_translateZ(20px)]">
      {/* Hover halo border */}
      <div className={`absolute -inset-px bg-gradient-to-br from-white/20 to-transparent rounded-3xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative h-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 overflow-hidden shadow-2xl">
        {/* Reflection sweep */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
        {/* Ambient backglow */}
        <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br ${a.gradient} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        <div className="relative">
          <div className={`mb-5 inline-flex p-3 rounded-2xl bg-gradient-to-br ${a.gradient} ${a.border} border shadow-lg`}>
            <div className={`w-8 h-8 rounded-xl ${a.iconGradient} flex items-center justify-center shadow-md`}>
              {icon}
            </div>
          </div>
          <h3 className="font-bold text-xl text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

