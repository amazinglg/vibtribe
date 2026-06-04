import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  ShieldCheck, Sparkles, PhoneCall, Lock, Zap, Palette,
  ArrowRight, MessageCircle, Check, Github, Twitter, Globe,
  Smartphone, Apple, Download, Share2, PlusSquare,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/contexts/LanguageContext';
import ContactFormModal from '@/components/ContactFormModal';

export default function LandingPage() {
  const { t } = useT();
  const [contactOpen, setContactOpen] = React.useState(false);

  return (
    <div
      className="min-h-screen gradient-bg-page text-foreground overflow-x-hidden relative"
      style={{
        // Android safe-area: same strategy as SignIn/SignUp. Without this the
        // sticky header's "Log In" / "Get Started" buttons render under the
        // status bar/notch on Capacitor Android builds.
        paddingTop: 'var(--safe-top)',
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
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <AppLogo size={32} />
            <span className="font-bold text-lg sm:text-xl text-gradient-primary tracking-tight">VibTribe</span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.nav.features')}</a>
            <a href="#about" className="hover:text-foreground transition-colors">{t('landing.nav.about')}</a>
            <a href="#contact" className="hover:text-foreground transition-colors">{t('landing.nav.contact')}</a>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to="/sign-in"
              className="px-2.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              {t('landing.nav.login')}
            </Link>
            <Link
              to="/sign-up"
              className="px-2.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold gradient-primary text-white glow-primary hover:opacity-90 transition-all flex items-center gap-1 whitespace-nowrap"
            >
              {t('landing.nav.signup')}
              <ArrowRight size={14} />
            </Link>
          </div>
        </nav>
        <div className="px-4 pb-2 flex justify-center sm:justify-end sm:max-w-6xl sm:mx-auto sm:pr-6">
          <LanguageSwitcher variant="pill" />
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-12 sm:pb-20 text-center">
        <div className="float-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 mb-6">
            <ShieldCheck size={13} className="text-primary" />
            <span className="text-[11px] sm:text-xs font-medium text-foreground/90">{t('landing.hero.badge')}</span>
          </div>
          <h1 className="font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.05] mb-5">
            <span className="text-gradient-primary">{t('landing.hero.title')}</span>
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed mb-8">
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              to="/sign-up"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl gradient-primary text-white text-sm font-semibold glow-primary hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {t('landing.hero.ctaPrimary')}
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/sign-in"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl glass border border-border text-foreground text-sm font-semibold hover:border-primary/50 transition-all"
            >
              {t('landing.hero.ctaSecondary')}
            </Link>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock size={11} /> {t('landing.hero.trust')}
          </p>
        </div>
      </section>

      {/* Features — Bento */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-10">
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mb-2">{t('landing.features.title')}</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">{t('landing.features.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-[minmax(170px,auto)]">
          {/* Hero feature - spans 2 on lg */}
          <FeatureTile
            icon={<ShieldCheck className="text-primary" size={22} />}
            title={t('landing.feature.e2e.title')}
            desc={t('landing.feature.e2e.desc')}
            className="lg:col-span-2 lg:row-span-2"
            big
            accent="gradient-primary"
          />
          <FeatureTile
            icon={<Sparkles className="text-vt-pink" size={20} />}
            title={t('landing.feature.status.title')}
            desc={t('landing.feature.status.desc')}
            accent="gradient-pink"
          />
          <FeatureTile
            icon={<PhoneCall className="text-vt-cyan" size={20} />}
            title={t('landing.feature.calls.title')}
            desc={t('landing.feature.calls.desc')}
            accent="gradient-cyan"
          />
          <FeatureTile
            icon={<Lock className="text-primary" size={20} />}
            title={t('landing.feature.vault.title')}
            desc={t('landing.feature.vault.desc')}
          />
          <FeatureTile
            icon={<Zap className="text-vt-amber" size={20} />}
            title={t('landing.feature.realtime.title')}
            desc={t('landing.feature.realtime.desc')}
          />
          <FeatureTile
            icon={<Palette className="text-vt-violet" size={20} />}
            title={t('landing.feature.themes.title')}
            desc={t('landing.feature.themes.desc')}
          />
        </div>
      </section>

      {/* Get the App — Platform Availability */}
      <section id="download" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Get the app</span>
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-2">Available on your phone</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            VibTribe is currently built as a native Android app. iPhone users can install it as a Progressive Web App (PWA) in seconds.
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
                  <p className="text-xs text-muted-foreground">Native app</p>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-foreground/80 mb-5">
                <li className="flex items-start gap-2"><Check size={14} className="text-primary mt-0.5 flex-shrink-0" /> Full native performance & push notifications</li>
                <li className="flex items-start gap-2"><Check size={14} className="text-primary mt-0.5 flex-shrink-0" /> Background calls & message delivery</li>
                <li className="flex items-start gap-2"><Check size={14} className="text-primary mt-0.5 flex-shrink-0" /> Native Android build coming soon</li>
              </ul>

              <div className="w-full px-4 py-3 rounded-2xl glass border border-border text-muted-foreground text-sm font-semibold flex items-center justify-center gap-2">
                <Download size={16} /> Android app coming soon
              </div>
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
                  <p className="text-xs text-muted-foreground">Install as Web App</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Add VibTribe to your home screen in 3 quick steps using Safari:
              </p>

              <ol className="space-y-2 text-sm text-foreground/80 mb-5">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>Open <span className="font-semibold text-foreground">vibtribe.in</span> in <span className="font-semibold text-foreground">Safari</span> (not Chrome).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>Tap the <Share2 size={12} className="inline mx-0.5 text-primary" /> <span className="font-semibold text-foreground">Share</span> button in the toolbar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span>Scroll and pick <PlusSquare size={12} className="inline mx-0.5 text-primary" /> <span className="font-semibold text-foreground">Add to Home Screen</span>, then tap Add.</span>
                </li>
              </ol>

              <a
                href="/"
                className="w-full px-4 py-3 rounded-2xl glass border border-primary/40 text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:border-primary transition-all"
              >
                <Apple size={16} /> Open in Safari to install
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">{t('landing.about.eyebrow')}</span>
            <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-4 max-w-2xl">
              {t('landing.about.title')}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              {t('landing.about.body')}
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">{t('landing.contact.eyebrow')}</span>
          <h2 className="font-bold text-2xl sm:text-4xl text-foreground mt-2 mb-2">{t('landing.contact.title')}</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">{t('landing.contact.body')}</p>
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
            <h2 className="font-bold text-2xl sm:text-4xl text-foreground mb-2">{t('landing.cta.title')}</h2>
            <Link
              to="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl gradient-primary text-white text-sm font-semibold glow-primary hover:opacity-90 transition-all"
            >
              {t('landing.cta.button')}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size={24} />
            <span className="font-bold text-sm text-foreground">VibTribe</span>
            <span className="text-xs text-muted-foreground hidden sm:inline ml-2">— {t('landing.footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">{t('landing.footer.terms')}</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">{t('landing.footer.privacy')}</Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
      <ContactFormModal open={contactOpen} onClose={() => setContactOpen(false)} external />
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

