"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  Zap,
  Phone,
  BarChart3,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Mic,
  Brain,
  Target,
  Clock,
} from "lucide-react";

/* ─── Navbar ─── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[rgba(5,5,7,0.85)] backdrop-blur-xl border-b border-[var(--border)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e8553d] to-[#ff8a6a] flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-bold text-lg">NextNote</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-4 py-2"
            >
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-medium px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white hover:from-[#f06a54] hover:to-[#e8553d] transition-all shadow-lg shadow-[#e8553d]/20"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[var(--card)] border-b border-[var(--border)]">
          <div className="px-4 py-4 space-y-3">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors py-2"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
              <Link href="/auth/login" className="text-sm text-center py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors">
                Login
              </Link>
              <Link href="/auth/signup" className="text-sm font-medium text-center py-2.5 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 glow-hero pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#e8553d]/[0.04] blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted)] mb-8 fade-in-up">
          <Zap className="w-3 h-3 text-[var(--accent)]" />
          AI-Powered CRM for Modern Sales Teams
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6 fade-in-up" style={{ animationDelay: "0.1s" }}>
          Close more deals.{" "}
          <span className="bg-gradient-to-r from-[#e8553d] to-[#ff8a6a] bg-clip-text text-transparent">
            Scale faster.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up" style={{ animationDelay: "0.2s" }}>
          NextNote is the sales operating system that helps agency owners and closers
          organize leads, book appointments, follow up faster, and let AI handle the rest.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-semibold text-base hover:from-[#f06a54] hover:to-[#e8553d] transition-all shadow-xl shadow-[#e8553d]/25 hover:shadow-[#e8553d]/40"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-[var(--border)] text-[var(--foreground)] font-medium text-base hover:bg-[var(--card)] transition-all"
          >
            See Pricing
          </a>
        </div>

        {/* Social Proof */}
        <div className="mt-16 fade-in-up" style={{ animationDelay: "0.4s" }}>
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-6">Trusted by 500+ agencies worldwide</p>
          <div className="flex items-center justify-center gap-8 sm:gap-12 opacity-40">
            {["Apex Studio", "SalesForge", "LeadWave", "CloserHQ", "GrowthOps"].map((name) => (
              <span key={name} className="text-sm sm:text-base font-semibold tracking-wide whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */
const features = [
  {
    icon: Users,
    title: "Smart CRM",
    desc: "Organize prospects in folders, track every touchpoint, and never let a lead slip through the cracks.",
  },
  {
    icon: Calendar,
    title: "Appointment Booking",
    desc: "Book, reschedule, and manage appointments with Google Calendar sync built right in.",
  },
  {
    icon: Brain,
    title: "AI Summaries",
    desc: "Let AI analyze your meeting notes, parse imports, and surface the insights that matter.",
  },
  {
    icon: Mic,
    title: "Voicemail Drops",
    desc: "Send ringless voicemails at scale with Slybroadcast integration. Reach more prospects, faster.",
  },
  {
    icon: BarChart3,
    title: "Pipeline Tracking",
    desc: "Visual pipeline from New to Closed. See conversion rates, booking rates, and stale leads instantly.",
  },
  {
    icon: Target,
    title: "Smart Import",
    desc: "Import from XLSX, CSV, or Google Sheets. AI auto-maps your columns — zero manual config.",
  },
];

function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 glow-section pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to close</h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            A complete toolkit for agency owners and sales teams who want to move fast and close more.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="glass-card rounded-2xl p-6 sm:p-8 transition-all duration-300 group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors" style={{ background: "rgba(232, 85, 61, 0.1)" }}>
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Why NextNote ─── */
const reasons = [
  { icon: Clock, title: "Save 10+ hours/week", desc: "Automate follow-ups, imports, and note-taking so you focus on selling." },
  { icon: Zap, title: "AI-native from day one", desc: "Not a bolt-on. AI is woven into every workflow — from import to insights." },
  { icon: Phone, title: "Built for outbound", desc: "Voicemail drops, appointment booking, and pipeline tracking — purpose-built for closers." },
  { icon: BarChart3, title: "Real-time analytics", desc: "See your conversion funnel, stale leads, and team performance at a glance." },
];

function WhySection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">Why NextNote</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why agencies choose NextNote</h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Built specifically for outbound teams, appointment setters, and agency owners who need speed and simplicity.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {reasons.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="flex gap-4 p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-[rgba(232,85,61,0.2)] transition-all">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232, 85, 61, 0.1)" }}>
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{r.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{r.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─── */
const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    desc: "For solo closers and freelancers getting started.",
    features: [
      "Up to 500 prospects",
      "3 folders",
      "Appointment booking",
      "Google Calendar sync",
      "CSV / XLSX import",
      "Email support",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    desc: "For growing teams that need AI and automation.",
    features: [
      "Unlimited prospects",
      "Unlimited folders",
      "AI meeting summaries",
      "AI smart import",
      "Voicemail drops",
      "Pipeline analytics",
      "Google Sheets import",
      "Priority support",
    ],
    cta: "Get Started",
    featured: true,
  },
  {
    name: "Agency",
    price: "$199",
    period: "/month",
    desc: "For agencies managing multiple campaigns at scale.",
    features: [
      "Everything in Pro",
      "Team seats (up to 10)",
      "Custom branding",
      "API access",
      "Advanced analytics",
      "Dedicated account manager",
      "SSO & compliance",
      "Onboarding call",
    ],
    cta: "Contact Sales",
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 glow-section pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Start free for 14 days. No credit card required. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.featured
                  ? "bg-gradient-to-b from-[rgba(232,85,61,0.08)] to-[var(--card)] border-2 border-[#e8553d]/30 shadow-2xl shadow-[#e8553d]/10 lg:scale-105"
                  : "glass-card"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white text-xs font-semibold shadow-lg">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
              <p className="text-sm text-[var(--muted)] mb-6">{plan.desc}</p>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-[var(--muted)] text-sm">{plan.period}</span>
              </div>

              <Link
                href="/auth/signup"
                className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                  plan.featured
                    ? "bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white hover:from-[#f06a54] hover:to-[#e8553d] shadow-lg shadow-[#e8553d]/20"
                    : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card-hover)] hover:border-[rgba(232,85,61,0.3)]"
                }`}
              >
                {plan.cta}
              </Link>

              <div className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                    <span className="text-sm text-[var(--muted)]">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
const faqs = [
  {
    q: "Do I need a credit card to start?",
    a: "No. You can sign up and start using NextNote immediately with our 14-day free trial. No credit card required.",
  },
  {
    q: "Can I import my existing leads?",
    a: "Absolutely. NextNote supports CSV, XLSX, and Google Sheets imports. Our AI automatically detects and maps your columns — no manual configuration needed.",
  },
  {
    q: "Does NextNote integrate with Google Calendar?",
    a: "Yes. Connect your Google account and NextNote will sync appointments directly to your calendar, send confirmations, and track outcomes.",
  },
  {
    q: "What are voicemail drops?",
    a: "Voicemail drops let you send pre-recorded messages directly to a prospect's voicemail without their phone ringing. It's powered by Slybroadcast integration.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All sessions are encrypted, passwords are hashed with bcrypt, and we use secure HTTP-only cookies. Your data stays yours.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term contracts. You can cancel, upgrade, or downgrade at any time from your account settings.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--card-hover)] transition-colors"
              >
                <span className="font-medium text-sm pr-4">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp className="w-4 h-4 text-[var(--muted)] shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--muted)] shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 text-sm text-[var(--muted)] leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCTA() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="absolute inset-0 glow-bottom pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to close more deals?
        </h2>
        <p className="text-[var(--muted)] text-lg mb-10 max-w-xl mx-auto">
          Join 500+ agencies already using NextNote to scale their outreach and book more appointments.
        </p>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-semibold text-base hover:from-[#f06a54] hover:to-[#e8553d] transition-all shadow-xl shadow-[#e8553d]/25 hover:shadow-[#e8553d]/40"
        >
          Get Started Free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e8553d] to-[#ff8a6a] flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="font-bold">NextNote</span>
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              The sales operating system for agencies, closers, and outbound teams.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-2.5">
              {["Features", "Pricing", "Integrations", "Changelog"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-2.5">
              {["About", "Blog", "Careers", "Contact"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {["Privacy Policy", "Terms of Service", "Security"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--muted)]">
            &copy; {new Date().getFullYear()} NextNote by Apex Studio. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Twitter
            </a>
            <a href="#" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Navbar />
      <Hero />
      <Features />
      <WhySection />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
