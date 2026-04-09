"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function PaymentSuccessPage() {
  const [mounted, setMounted] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Give Stripe webhook a moment to process
    const timer = setTimeout(() => {
      setVerifying(false);
      // Redirect to onboarding after showing success
      setTimeout(() => {
        window.location.href = "/onboarding";
      }, 2000);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      <div className="grid-bg" />
      <div className="glow-hero pointer-events-none absolute inset-0" />

      <div
        className={`w-full max-w-md relative z-10 text-center transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="inline-flex items-center justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-[#e8553d]/20 blur-xl" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
              <OrbitGridIcon size={36} />
            </div>
          </div>
        </div>

        {verifying ? (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin mx-auto" />
            <h1 className="text-2xl font-bold">Processing payment...</h1>
            <p className="text-[var(--muted)] text-sm">Confirming your subscription</p>
          </div>
        ) : (
          <div className="space-y-6 animate-[fadeInUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Payment successful!</h1>
              <p className="text-[var(--muted)] text-sm mt-3">
                Your subscription is now active. Let&apos;s set up your account...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
