"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reset email.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(232,85,61,0.5)] focus:border-[rgba(232,85,61,0.5)] transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#e8553d]/[0.04] blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <OrbitGridIcon size={48} />
          </div>

          {sent ? (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-[var(--muted)] text-sm mt-2 leading-relaxed">
                We sent a password reset link to<br />
                <span className="text-[var(--foreground)] font-medium">{email}</span>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Forgot your password?</h1>
              <p className="text-[var(--muted)] text-sm mt-1">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </>
          )}
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
              If an account with that email exists, the reset link will arrive within a few minutes.
            </div>
            <p className="text-center text-sm text-[var(--muted)]">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                onClick={() => { setSent(false); setError(""); }}
                className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                try again
              </button>
            </p>
            <div className="text-center pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-medium text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#e8553d]/20"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
