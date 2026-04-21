"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Sparkles } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function PaymentSuccessPage() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"processing" | "success" | "transitioning">("processing");

  useEffect(() => {
    setMounted(true);
    // Phase 1: show processing spinner for 1.8s
    const t1 = setTimeout(() => setPhase("success"), 1800);
    // Phase 2: show success for 2.2s, then start transition out
    const t2 = setTimeout(() => setPhase("transitioning"), 4000);
    // Phase 3: navigate to onboarding
    const t3 = setTimeout(() => {
      window.location.href = "/onboarding";
    }, 4600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden
        transition-all duration-700 ease-in-out
        ${phase === "transitioning" ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
    >
      <div className="grid-bg" />
      <div className="glow-hero pointer-events-none absolute inset-0" />

      {/* Animated rings for success phase */}
      {phase === "success" && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-96 h-96 rounded-full border border-emerald-500/10 animate-ping" style={{ animationDuration: "2s" }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-72 rounded-full border border-emerald-500/15 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
          </div>
        </>
      )}

      <div
        className={`w-full max-w-md relative z-10 text-center transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Logo */}
        <div className="inline-flex items-center justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-[#e8553d]/20 blur-xl" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
              <OrbitGridIcon size={36} />
            </div>
          </div>
        </div>

        {phase === "processing" && (
          <div className="space-y-4 animate-[fadeInUp_0.5s_ease-out]">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin mx-auto" />
            <h1 className="text-2xl font-bold">Processing payment...</h1>
            <p className="text-[var(--muted)] text-sm">Confirming your subscription</p>
          </div>
        )}

        {(phase === "success" || phase === "transitioning") && (
          <div className="space-y-6 animate-[fadeInUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-emerald-500/25 blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">Payment successful!</h1>
              <p className="text-[var(--muted)] text-sm mt-3 leading-relaxed">
                Your subscription is active. Setting up your account...
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[var(--accent)] text-sm font-medium">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Preparing your workspace</span>
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>

            <div className="flex justify-center gap-1.5 pt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
