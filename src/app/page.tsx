"use client";

import { useState, useEffect, useRef } from "react";
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
  Shield,
  Sparkles,
  FileSpreadsheet,
  MousePointerClick,
} from "lucide-react";
import { OrbitGridLogo } from "@/components/OrbitGridLogo";

/* ─── Intersection Observer hook for scroll reveal ─── */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          obs.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Cursor glow + grid interaction (desktop only) ─── */
function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    const spot = spotRef.current;
    if (!glow || !spot) return;

    let raf = 0;
    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      cx = lerp(cx, mx, 0.12);
      cy = lerp(cy, my, 0.12);
      glow.style.left = `${cx}px`;
      glow.style.top = `${cy}px`;
      spot.style.left = `${cx}px`;
      spot.style.top = `${cy}px`;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      glow.style.opacity = "1";
      spot.style.opacity = "1";
    };
    const onLeave = () => {
      glow.style.opacity = "0";
      spot.style.opacity = "0";
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={glowRef} className="cursor-glow" style={{ opacity: 0 }} />
      <div ref={spotRef} className="cursor-grid-spot" style={{ opacity: 0 }} />
    </>
  );
}

/* ─── Floating orbs ─── */
function FloatingOrbs() {
  return (
    <>
      <div className="orb orb-1" style={{ top: "5%", left: "10%" }} />
      <div className="orb orb-2" style={{ top: "40%", right: "5%" }} />
      <div className="orb orb-3" style={{ bottom: "20%", left: "20%" }} />
    </>
  );
}

/* ─── Portrait data ─── */
const portraits = [
  { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face", alt: "Agency owner" },
  { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face", alt: "Sales director" },
  { src: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&h=120&fit=crop&crop=face", alt: "Team lead" },
  { src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face", alt: "Account executive" },
  { src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face", alt: "Growth manager" },
];

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
    { label: "How It Works", href: "#how-it-works" },
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
          <Link href="/" className="flex items-center">
            <OrbitGridLogo size={30} />
          </Link>

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

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-4 py-2"
            >
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="cta-primary !py-2 !px-5 !text-sm !shadow-md"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[rgba(12,12,18,0.95)] backdrop-blur-xl border-b border-[var(--border)]">
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
    <section className="relative pt-32 pb-20 sm:pt-44 sm:pb-32 overflow-hidden">
      <div className="absolute inset-0 glow-hero pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#e8553d]/[0.05] blur-[100px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.06)] text-xs text-[var(--accent)] mb-8 fade-in-up backdrop-blur-sm">
          <Sparkles className="w-3 h-3" />
          AI-Powered Sales OS
        </div>

        <h1
          className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6 fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          Your agency&apos;s unfair
          <br />
          <span className="text-shimmer">advantage to close.</span>
        </h1>

        <p
          className="text-lg sm:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-12 leading-relaxed fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          NextNote is the all-in-one operating system that helps agency owners and sales
          teams organize leads, book appointments, automate follow-ups, and let AI do the
          heavy lifting — so you can focus on closing.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Link href="/auth/signup" className="cta-primary">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#how-it-works" className="cta-secondary">
            See How It Works
          </a>
        </div>

        {/* Social Proof with real portraits */}
        <div className="mt-20 fade-in-up" style={{ animationDelay: "0.45s" }}>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex -space-x-3">
              {portraits.map((p, i) => (
                <div
                  key={i}
                  className="relative w-9 h-9 rounded-full border-2 border-[var(--background)] overflow-hidden shadow-lg shadow-black/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt={p.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <span className="text-sm text-[var(--muted)] ml-1">
              Trusted by <span className="text-[var(--foreground)] font-semibold">500+</span> agencies
            </span>
          </div>
          <div className="flex items-center justify-center flex-wrap gap-x-10 gap-y-4 opacity-30">
            {["Apex Studio", "SalesForge", "LeadWave", "CloserHQ", "GrowthOps"].map(
              (name) => (
                <span
                  key={name}
                  className="text-sm sm:text-base font-semibold tracking-wide whitespace-nowrap"
                >
                  {name}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Trust Bar ─── */
function TrustBar() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal">
      <div className="section-divider" />
      <div className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "500+", label: "Agencies" },
              { value: "2M+", label: "Prospects Managed" },
              { value: "98%", label: "Uptime" },
              { value: "4.9/5", label: "Customer Rating" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-[var(--foreground)] to-[var(--muted)] bg-clip-text text-transparent">
                  {s.value}
                </p>
                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="section-divider" />
    </div>
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
    desc: "Let AI analyze your meeting notes, parse imports, and surface the insights that matter most.",
  },
  {
    icon: Mic,
    title: "Voicemail Drops",
    desc: "Send ringless voicemails at scale with Slybroadcast. Reach more prospects without lifting a finger.",
  },
  {
    icon: BarChart3,
    title: "Pipeline Analytics",
    desc: "Visual pipeline from New to Closed. See conversion rates, booking rates, and stale leads instantly.",
  },
  {
    icon: FileSpreadsheet,
    title: "Smart Import",
    desc: "Import from XLSX, CSV, or Google Sheets. AI auto-maps your columns — zero manual config.",
  },
];

function Features() {
  const headRef = useReveal<HTMLDivElement>();
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 glow-section pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={headRef} className="text-center mb-16 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to close
          </h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            A complete toolkit for agency owners and sales teams who want to move fast
            and close more deals.
          </p>
        </div>

        <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 reveal-stagger">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="reveal-child glass-card rounded-2xl p-6 sm:p-8 group"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#e8553d]/10"
                  style={{ background: "rgba(232, 85, 61, 0.1)" }}
                >
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

/* ─── How It Works ─── */
const steps = [
  {
    num: "01",
    icon: FileSpreadsheet,
    title: "Import Your Leads",
    desc: "Upload from CSV, XLSX, or Google Sheets. AI auto-maps columns and cleans your data.",
  },
  {
    num: "02",
    icon: MousePointerClick,
    title: "Engage & Book",
    desc: "Send voicemail drops, schedule appointments, and track every interaction in one place.",
  },
  {
    num: "03",
    icon: Target,
    title: "Close & Scale",
    desc: "AI summarizes meetings, surfaces hot leads, and keeps your pipeline moving toward revenue.",
  },
];

function HowItWorks() {
  const ref = useReveal<HTMLDivElement>();
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div ref={ref} className="text-center mb-16 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Three steps to more closed deals
          </h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Get up and running in minutes — not days. NextNote does the heavy lifting.
          </p>
        </div>

        <div ref={gridRef} className="grid md:grid-cols-3 gap-8 reveal-stagger">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="reveal-child relative text-center">
                {i < steps.length - 1 && <div className="step-connector" />}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[rgba(232,85,61,0.15)] to-[rgba(232,85,61,0.05)] border border-[rgba(232,85,61,0.2)] mb-5">
                  <Icon className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <div className="text-xs font-bold text-[var(--accent)] tracking-widest mb-2">
                  STEP {s.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed max-w-xs mx-auto">
                  {s.desc}
                </p>
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
  {
    icon: Clock,
    title: "Save 10+ Hours a Week",
    desc: "Automate follow-ups, imports, and note-taking so your team focuses on selling, not admin work.",
  },
  {
    icon: Zap,
    title: "AI-Native from Day One",
    desc: "Not a bolt-on. AI is woven into every workflow — from smart imports to automated meeting insights.",
  },
  {
    icon: Phone,
    title: "Built for Outbound Teams",
    desc: "Voicemail drops, appointment booking, and pipeline tracking — purpose-built for closers who move fast.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    desc: "See your conversion funnel, stale leads, and team performance at a glance. Make data-driven decisions.",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    desc: "Encrypted sessions, bcrypt-hashed passwords, HTTP-only cookies. Your data stays yours.",
  },
  {
    icon: Sparkles,
    title: "All-in-One Platform",
    desc: "CRM, booking, voicemail, analytics, AI — one platform replaces five tools and eliminates tab-switching.",
  },
];

function WhySection() {
  const headRef = useReveal<HTMLDivElement>();
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section className="relative py-24 sm:py-32">
      <div className="absolute inset-0 glow-section pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={headRef} className="text-center mb-16 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
            Why NextNote
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            The operating system your agency deserves
          </h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Built specifically for outbound teams, appointment setters, and agency owners
            who need speed, simplicity, and results.
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto reveal-stagger"
        >
          {reasons.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className="reveal-child flex gap-4 p-6 rounded-2xl border border-[var(--border)] bg-[rgba(12,12,18,0.6)] backdrop-blur-sm hover:border-[rgba(232,85,61,0.2)] hover:bg-[rgba(15,15,22,0.8)] transition-all duration-300"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(232, 85, 61, 0.1)" }}
                >
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
    desc: "For solo closers and freelancers getting started with outbound.",
    features: [
      "Up to 500 prospects",
      "3 folders",
      "Appointment booking",
      "Google Calendar sync",
      "CSV / XLSX import",
      "150 AI credits included",
      "Email support",
    ],
    cta: "Get Started",
    featured: false,
    creditBadge: "150 free credits",
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    desc: "For growing teams that need AI, automation, and deeper insights.",
    features: [
      "Unlimited prospects",
      "Unlimited folders",
      "AI meeting summaries",
      "AI smart import",
      "Voicemail drops",
      "Pipeline analytics",
      "Google Sheets import",
      "250 AI credits included",
      "Priority support",
    ],
    cta: "Get Started",
    featured: true,
    badge: "Most Popular",
    creditBadge: "250 free credits",
  },
];

function Pricing() {
  const headRef = useReveal<HTMLDivElement>();
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 glow-section pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={headRef} className="text-center mb-16 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Invest in closing, not software
          </h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Choose the plan that fits your workflow and get started right away.
          </p>

          {/* Credit offer CTA */}
          <div className="mt-8 inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-[rgba(232,85,61,0.15)] to-[rgba(255,138,106,0.1)] border border-[rgba(232,85,61,0.25)] backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e8553d] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e8553d]" />
            </span>
            <span className="text-sm font-medium text-[var(--foreground)]">
              Limited offer — free AI credits on every plan. Start building today.
            </span>
          </div>
        </div>

        <div
          ref={gridRef}
          className="grid lg:grid-cols-2 gap-6 max-w-4xl mx-auto items-start reveal-stagger"
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`reveal-child relative rounded-2xl p-8 ${
                plan.featured
                  ? "glass-card-featured lg:scale-[1.04]"
                  : "glass-card"
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold shadow-lg ${
                    plan.featured
                      ? "bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white"
                      : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {plan.badge}
                </div>
              )}

              <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">{plan.desc}</p>

              {plan.creditBadge && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                  <Sparkles className="w-3 h-3" />
                  {plan.creditBadge}
                </div>
              )}

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl sm:text-5xl font-bold">{plan.price}</span>
                <span className="text-[var(--muted)] text-sm">{plan.period}</span>
              </div>

              <Link
                href="/auth/signup"
                className={`block text-center py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  plan.featured
                    ? "bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white hover:from-[#f06a54] hover:to-[#e8553d] shadow-lg shadow-[#e8553d]/20 hover:shadow-[#e8553d]/40 hover:-translate-y-0.5"
                    : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card-hover)] hover:border-[rgba(232,85,61,0.3)] hover:-translate-y-0.5"
                }`}
              >
                {plan.cta}
              </Link>

              <div className="mt-8 space-y-3.5">
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

        {/* Money-back guarantee */}
        <div className="text-center mt-12">
          <p className="text-sm text-[var(--muted)]">
            <Shield className="w-4 h-4 inline-block mr-1.5 text-[var(--accent)] -mt-0.5" />
            All plans include free AI credits. Buy more anytime. Cancel your subscription whenever.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
const faqs = [
  {
    q: "Do I need a credit card to start?",
    a: "No. NextNote is a paid platform, and you can choose the plan that fits your workflow when you sign up.",
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
    a: "Voicemail drops let you send pre-recorded messages directly to a prospect's voicemail without their phone ringing. It's powered by Slybroadcast integration and lets you reach hundreds of prospects in minutes.",
  },
  {
    q: "How is NextNote different from other CRMs?",
    a: "NextNote is purpose-built for outbound sales teams and agencies. While most CRMs are bloated and generic, NextNote combines CRM, appointment booking, voicemail drops, AI summaries, and pipeline analytics in one focused platform. It's the operating system for closers.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All sessions are encrypted, passwords are hashed with bcrypt, and we use secure HTTP-only cookies. Your data stays yours — we never sell or share it.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term contracts. You can cancel, upgrade, or downgrade at any time from your account settings.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headRef = useReveal<HTMLDivElement>();
  const listRef = useReveal<HTMLDivElement>();

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div ref={headRef} className="text-center mb-16 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Frequently asked questions
          </h2>
          <p className="text-[var(--muted)] max-w-lg mx-auto">
            Everything you need to know before getting started.
          </p>
        </div>

        <div ref={listRef} className="space-y-3 reveal-stagger">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="reveal-child rounded-xl border border-[var(--border)] bg-[rgba(12,12,18,0.6)] backdrop-blur-sm overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--card-hover)] transition-colors"
              >
                <span className="font-medium text-sm pr-4">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp className="w-4 h-4 text-[var(--accent)] shrink-0" />
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
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 glow-bottom pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#e8553d]/[0.04] blur-[80px] pointer-events-none" />

      <div ref={ref} className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center reveal">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.06)] text-xs text-[var(--accent)] mb-6 backdrop-blur-sm">
          <Zap className="w-3 h-3" />
          Start closing more today
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5">
          Ready to scale your agency?
        </h2>
        <p className="text-[var(--muted)] text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Join 500+ agencies already using NextNote to organize leads, book more
          appointments, and close deals faster.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup" className="cta-primary !px-10 !py-4">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#pricing" className="cta-secondary">
            View Pricing
          </a>
        </div>

        <p className="text-xs text-[var(--muted)] mt-6">
          Set up in under 2 minutes.
        </p>
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
          <div className="lg:col-span-1">
            <div className="mb-4">
              <OrbitGridLogo size={28} />
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
              The sales operating system for agencies, closers, and outbound teams.
            </p>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-xs text-[var(--muted)] ml-1.5">4.9/5 from 200+ reviews</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-2.5">
              {["Features", "Pricing", "Integrations", "Changelog"].map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-2.5">
              {["About", "Blog", "Careers", "Contact"].map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {["Privacy Policy", "Terms of Service", "Security"].map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-divider mb-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--muted)]">
            &copy; {new Date().getFullYear()} NextNote by Apex Studio. All rights
            reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="#"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
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
    <div className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      <div className="grid-bg" />
      <CursorGlow />
      <FloatingOrbs />
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <div className="section-divider max-w-5xl mx-auto" />
      <HowItWorks />
      <div className="section-divider max-w-5xl mx-auto" />
      <WhySection />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
