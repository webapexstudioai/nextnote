"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function VerifyCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setErrorMsg("Missing verification token");
      return;
    }

    fetch(`/api/auth/verify-token?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Network error. Please try again.");
      });
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
        {/* Logo */}
        <div className="inline-flex items-center justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-[#e8553d]/20 blur-xl" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
              <OrbitGridIcon size={36} />
            </div>
          </div>
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin mx-auto" />
            <h1 className="text-2xl font-bold">Verifying your email...</h1>
            <p className="text-[var(--muted)] text-sm">Please wait a moment</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6 animate-[fadeInUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Your account is now verified!</h1>
              <p className="text-[var(--muted)] text-sm mt-3 leading-relaxed">
                You can close out of this window now.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 inline-block">
              <p className="text-xs text-[var(--muted)]">
                If you&apos;re logged in, you&apos;ll be automatically redirected to continue setup.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6 animate-[fadeInUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Verification failed</h1>
              <p className="text-[var(--muted)] text-sm mt-2">{errorMsg}</p>
            </div>
            <a
              href="/auth/verify-email"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-semibold text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all shadow-lg shadow-[#e8553d]/25"
            >
              Request new verification link
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
