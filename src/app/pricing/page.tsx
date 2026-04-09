"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, ArrowRight, Sparkles, Crown, Zap } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    tagline: "For solo agents getting started",
    icon: Zap,
    featured: false,
    features: [
      "Basic CRM / prospect pipeline",
      "Folders + lead organization",
      "Manual lead entry",
      "Appointment booking",
      "Up to 100 prospects",
      "5 folders",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    tagline: "For growing agencies",
    icon: Sparkles,
    featured: true,
    features: [
      "Everything in Starter",
      "AI summaries & insights",
      "Spreadsheet import (XLSX)",
      "Google Calendar sync",
      "Voicemail tools",
      "API key support",
      "Up to 1,000 prospects",
      "25 folders",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: 199,
    tagline: "For teams and power users",
    icon: Crown,
    featured: false,
    features: [
      "Everything in Pro",
      "Advanced customization",
      "Team / multi-user",
      "Up to 10,000 prospects",
      "100 folders",
      "Priority support",
      "Automation-ready architecture",
    ],
  },
];

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSelectPlan(planId: string) {
    setSelectedPlan(planId);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        setLoading(false);
        return;
      }
      // Redirect to Stripe Checkout
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
            Choose your{" "}
            <span className="text-shimmer">plan</span>
          </h1>
          <p className="text-[var(--muted)] text-lg max-w-lg mx-auto">
            Select the plan that fits your agency. Upgrade or downgrade anytime.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
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

                <div
                  className={`h-full rounded-2xl p-6 sm:p-8 flex flex-col ${
                    plan.featured ? "glass-card-featured" : "glass-card"
                  } ${plan.featured ? "ring-1 ring-[rgba(232,85,61,0.15)]" : ""}`}
                >
                  {/* Plan header */}
                  <div className="mb-6">
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

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-[var(--muted)] text-sm">/month</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex-1 mb-8">
                    <ul className="space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
                          <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? "text-[var(--accent)]" : "text-emerald-400"}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:cursor-not-allowed ${
                      plan.featured
                        ? "bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white shadow-lg shadow-[#e8553d]/25 hover:shadow-xl hover:shadow-[#e8553d]/35 hover:-translate-y-0.5 disabled:opacity-60"
                        : "bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:border-[rgba(232,85,61,0.3)] hover:bg-[rgba(232,85,61,0.05)] hover:-translate-y-0.5 disabled:opacity-60"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting to checkout...
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

        {/* Footer note */}
        <p
          className={`text-center text-xs text-[var(--muted)]/60 mt-12 transition-all duration-700 delay-700 ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
        >
          All plans include a secure payment via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
