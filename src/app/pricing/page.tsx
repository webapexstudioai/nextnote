"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Loader2,
  ArrowRight,
  Crown,
  Zap,
  Gift,
  Phone,
  Globe,
  PhoneOff,
  Sparkles,
  Mail,
  Hammer,
} from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

type Plan = {
  id: "starter" | "pro" | "agency";
  name: string;
  price: number;
  tagline: string;
  icon: typeof Zap;
  featured?: boolean;
  comingSoon?: boolean;
  creditBadge?: string;
  highlight: string;
  features: string[];
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    tagline: "For owner-operators just trying it out",
    icon: Zap,
    creditBadge: "150 free AI credits",
    highlight: "Everything you need to stop missing calls.",
    features: [
      "Build AI receptionists for your clients · charge monthly, keep the markup",
      "Generate pitch sites for any prospect · close them with a personalized link",
      "Prospect pipeline + folders (up to 100 leads)",
      "Appointment booking + calendar invites",
      "150 AI credits included",
      "Email + chat support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    tagline: "For service businesses running full ops",
    icon: Crown,
    featured: true,
    creditBadge: "250 free AI credits",
    highlight: "Receptionist + voicemail drops + websites — all unlocked.",
    features: [
      "Everything in Starter",
      "Voicemail drops · ringless outreach at scale",
      "Google Calendar + Meet booking sync",
      "Gmail confirmation emails",
      "AI insights + meeting note summaries",
      "Spreadsheet import (XLSX)",
      "Up to 1,000 prospects · 25 folders",
      "250 AI credits included · full customization",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: 297,
    tagline: "Resell NextNote under your own brand",
    icon: Hammer,
    comingSoon: true,
    highlight: "White-label dashboard, sub-accounts, billing.",
    features: [
      "Everything in Pro",
      "White-label sites on your own subdomain",
      "Multi-tenant: manage 10+ client accounts",
      "Custom logo, colors, and email sender",
      "Bulk credits at agency-tier pricing",
      "Priority Slack / phone support",
    ],
  },
];

/* Credits explainer — what each AI feature actually costs (matches credits.ts) */
const CREDIT_EXAMPLES = [
  { icon: Phone, label: "AI receptionist call", cost: "16 credits / min" },
  { icon: Globe, label: "AI website (standard)", cost: "50 credits" },
  { icon: Globe, label: "Website (white-label)", cost: "200 credits" },
  { icon: PhoneOff, label: "Voicemail drop", cost: "13 credits" },
  { icon: Sparkles, label: "AI insights report", cost: "15 credits" },
  { icon: Mail, label: "AI follow-up summary", cost: "5 credits" },
];

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSelectPlan(plan: Plan) {
    if (plan.comingSoon) {
      window.location.href =
        `mailto:hello@nextnote.to?subject=${encodeURIComponent("Agency tier waitlist")}` +
        `&body=${encodeURIComponent("Hi — I'd like to join the waitlist for the Agency tier when it launches.")}`;
      return;
    }
    setSelectedPlan(plan.id);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      <div className="grid-bg" />
      <div className="glow-hero pointer-events-none absolute inset-0" />
      <div className="orb orb-1" style={{ top: "5%", left: "10%" }} />
      <div className="orb orb-2" style={{ bottom: "10%", right: "15%" }} />
      <div className="orb orb-3" style={{ top: "40%", right: "5%" }} />

      <div className="relative z-10 px-4 py-16 sm:py-24 max-w-6xl mx-auto">
        {/* Header */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-[#e8553d]/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
                <OrbitGridIcon size={36} />
              </div>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Pricing for <span className="text-shimmer">people on the job</span>
          </h1>
          <p className="text-[var(--muted)] text-lg max-w-xl mx-auto">
            Built for contractors, plumbers, electricians, HVAC, landscapers, and roofers — anyone who can&apos;t pick up the phone from a job site.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-[rgba(232,85,61,0.15)] to-[rgba(255,138,106,0.1)] border border-[rgba(232,85,61,0.25)] backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e8553d] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e8553d]" />
            </span>
            <span className="text-sm font-medium text-[var(--foreground)]">
              Limited offer — free AI credits on every plan
            </span>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Plans Grid — 3 tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            const isLoading = isSelected && loading;

            return (
              <div
                key={plan.id}
                className={`relative transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{ transitionDelay: mounted ? `${200 + i * 150}ms` : "0ms" }}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-[#e8553d] to-[#ff8a6a] text-white text-xs font-semibold shadow-lg shadow-[#e8553d]/30">
                      Most Popular
                    </span>
                  </div>
                )}
                {plan.comingSoon && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1 rounded-full bg-[rgba(255,255,255,0.06)] border border-[var(--border)] text-[var(--muted)] text-xs font-semibold">
                      Coming soon
                    </span>
                  </div>
                )}

                <div
                  className={`h-full rounded-2xl p-6 sm:p-7 flex flex-col ${
                    plan.featured ? "glass-card-featured" : "glass-card"
                  } ${plan.featured ? "ring-1 ring-[rgba(232,85,61,0.15)]" : ""} ${
                    plan.comingSoon ? "opacity-90" : ""
                  }`}
                >
                  {/* Plan header */}
                  <div className="mb-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                      plan.featured
                        ? "bg-gradient-to-br from-[#e8553d] to-[#d44429] text-white"
                        : "bg-[rgba(232,85,61,0.1)] text-[var(--accent)]"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-[var(--muted)] text-sm mt-1">{plan.tagline}</p>
                  </div>

                  {/* Highlight pull-quote */}
                  <div className="mb-4 text-[13px] text-[var(--foreground)] leading-snug font-medium">
                    {plan.highlight}
                  </div>

                  {/* Credit badge */}
                  {plan.creditBadge && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4 self-start">
                      <Gift className="w-3 h-3" />
                      {plan.creditBadge}
                    </div>
                  )}

                  {/* Price */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-[var(--muted)] text-sm">/month</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex-1 mb-7">
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px] text-[var(--muted)]">
                          <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? "text-[var(--accent)]" : "text-emerald-400"}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loading && !plan.comingSoon}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:cursor-not-allowed ${
                      plan.featured
                        ? "bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white shadow-lg shadow-[#e8553d]/25 hover:shadow-xl hover:shadow-[#e8553d]/35 hover:-translate-y-0.5 disabled:opacity-60"
                        : plan.comingSoon
                        ? "bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-[var(--foreground)] hover:border-[rgba(232,85,61,0.3)] hover:bg-[rgba(232,85,61,0.05)]"
                        : "bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:border-[rgba(232,85,61,0.3)] hover:bg-[rgba(232,85,61,0.05)] hover:-translate-y-0.5 disabled:opacity-60"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting to checkout...
                      </>
                    ) : plan.comingSoon ? (
                      <>
                        Join the waitlist
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Get {plan.name}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Credits explainer */}
        <div
          className={`max-w-4xl mx-auto mt-20 transition-all duration-700 delay-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight mb-2">
              Credits power the AI features
            </h2>
            <p className="text-[var(--muted)] text-sm max-w-xl mx-auto">
              Every plan ships with free credits. Use them across receptionist calls, voicemail drops, AI websites, and meeting summaries — top up anytime.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CREDIT_EXAMPLES.map((c) => {
                const I = c.icon;
                return (
                  <div
                    key={c.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--border)]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[rgba(232,85,61,0.1)] flex items-center justify-center text-[var(--accent)] shrink-0">
                      <I className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--foreground)] truncate">{c.label}</div>
                      <div className="text-[11px] text-[var(--muted)] font-mono">{c.cost}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted)]">
              <span>100 credits = $1 retail · top up from billing settings</span>
              <span className="font-mono">no hidden surcharges</span>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p
          className={`text-center text-xs text-[var(--muted)]/60 mt-12 transition-all duration-700 delay-700 ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
        >
          All plans include free AI credits. Secure payment via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
