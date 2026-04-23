"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Crown, Zap } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";
import { TIERS, SubscriptionTier } from "@/lib/subscriptions";

const planIcons = {
  starter: Zap,
  pro: Crown,
} as const;

export default function WelcomePage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");
  const [tier, setTier] = useState<SubscriptionTier>("starter");

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const user = data.user;
        if (!user) {
          window.location.href = "/auth/login";
          return;
        }
        if (!user.emailVerified) {
          window.location.href = "/auth/verify-email";
          return;
        }
        if (user.subscriptionStatus !== "active") {
          window.location.href = "/pricing";
          return;
        }
        setUserName(user.name || "there");
        setTier((user.subscriptionTier || "starter") as SubscriptionTier);
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/auth/login";
      });
  }, []);

  const tierConfig = TIERS[tier];
  const TierIcon = planIcons[tier];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
        <div className="grid-bg" />
        <div className="glow-hero pointer-events-none absolute inset-0" />
        <div className="relative z-10 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin mx-auto" />
          <p className="text-sm text-[var(--muted)]">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      <div className="grid-bg" />
      <div className="glow-hero pointer-events-none absolute inset-0" />
      <div className="orb orb-1" style={{ top: "10%", left: "15%" }} />
      <div className="orb orb-2" style={{ bottom: "10%", right: "15%" }} />

      <div className={`w-full max-w-2xl relative z-10 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-[#e8553d]/20 blur-xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
                <OrbitGridIcon size={42} />
              </div>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Welcome to NextNote</h1>
          <p className="text-[var(--muted)] mt-3 text-base sm:text-lg">Glad to have you here, {userName}. Your workspace is ready.</p>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.08)] px-4 py-2 text-sm text-[var(--accent)]">
            <TierIcon className="w-4 h-4" />
            {tierConfig.name} plan unlocked
          </div>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            {tierConfig.features.slice(0, 6).map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-[var(--foreground)]">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={() => { window.location.href = "/dashboard"; }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-semibold text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all shadow-lg shadow-[#e8553d]/25"
            >
              Enter your dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-[var(--muted)]">The future for AI Agencys</p>
          </div>
        </div>
      </div>
    </div>
  );
}
