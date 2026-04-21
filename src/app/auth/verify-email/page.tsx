"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, RefreshCw, CheckCircle, Pencil } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [editEmail, setEditEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    const emailFromQuery = searchParams.get("email");

    fetch("/api/auth/me")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (data.user?.email) {
          setEmail(data.user.email);
          setNewEmail(data.user.email);
        } else if (emailFromQuery) {
          setEmail(emailFromQuery);
          setNewEmail(emailFromQuery);
        }

        if (data.user?.emailVerified) {
          window.location.href = "/pricing";
          return;
        }

        if (!ok && !emailFromQuery) {
          setError("We couldn't load your account details. Please sign in again.");
        }
      })
      .catch(() => {
        if (emailFromQuery) {
          setEmail(emailFromQuery);
          setNewEmail(emailFromQuery);
        }
      });
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-send on mount
  useEffect(() => {
    if (email && !sent) {
      sendVerification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function sendVerification() {
    setSending(true);
    setError("");
    try {
      if (!email && !newEmail) {
        setError("We couldn't determine which email to verify.");
        return;
      }
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail || email }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "Email already verified") {
          window.location.href = "/pricing";
          return;
        }
        setError(data.error || "Failed to send verification email");
      } else {
        setSent(true);
        setCooldown(60);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateEmail() {
    if (!newEmail.trim() || newEmail === email) {
      setEditEmail(false);
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      if (res.ok) {
        setEmail(newEmail);
        setEditEmail(false);
        setSent(false);
        setCooldown(0);
        // Re-send verification to new email
        setTimeout(() => sendVerification(), 500);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update email");
      }
    } catch {
      setError("Network error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      <div className="grid-bg" />
      <div className="glow-hero pointer-events-none absolute inset-0" />
      <div className="orb orb-1" style={{ top: "5%", right: "20%" }} />
      <div className="orb orb-3" style={{ bottom: "15%", left: "10%" }} />

      <div
        className={`w-full max-w-md relative z-10 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center mb-5 transition-all duration-700 delay-100 ${
              mounted ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
          >
            <div className="relative">
              <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-[#e8553d]/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
                <OrbitGridIcon size={36} />
              </div>
            </div>
          </div>

          <div
            className={`mx-auto w-14 h-14 rounded-full bg-[rgba(232,85,61,0.1)] border border-[rgba(232,85,61,0.2)] flex items-center justify-center mb-5 transition-all duration-700 delay-200 ${
              mounted ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
          >
            <Mail className="w-7 h-7 text-[var(--accent)]" />
          </div>

          <h1
            className={`text-3xl font-bold tracking-tight transition-all duration-700 delay-300 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Check your email
          </h1>
          <p
            className={`text-[var(--muted)] text-sm mt-3 leading-relaxed max-w-sm mx-auto transition-all duration-700 delay-400 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {sent
              ? "We sent a verification link to your email. Click it to verify your account."
              : "Sending verification link..."}
          </p>
        </div>

        <div
          className={`glass-card rounded-2xl p-6 space-y-5 transition-all duration-700 delay-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Email display */}
          <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
            {editEmail ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[rgba(232,85,61,0.4)]"
                  autoFocus
                />
                <button
                  onClick={handleUpdateEmail}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditEmail(false); setNewEmail(email); }}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Sending to</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">{email || "Loading..."}</p>
                </div>
                <button
                  onClick={() => setEditEmail(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--accent)] hover:bg-[rgba(232,85,61,0.1)] transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Animated email icon */}
          {sent && (
            <div className="flex justify-center py-2">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-[rgba(232,85,61,0.05)] border border-[rgba(232,85,61,0.1)] flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 animate-[fadeIn_0.5s_ease-out]" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border border-[rgba(232,85,61,0.2)] animate-ping opacity-20" />
              </div>
            </div>
          )}

          {/* Resend */}
          <div className="text-center space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Didn&apos;t receive it?{" "}
              {cooldown > 0 ? (
                <span className="text-[var(--muted)]">Resend in {cooldown}s</span>
              ) : (
                <button
                  onClick={sendVerification}
                  disabled={sending}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5 font-medium"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Resend email
                </button>
              )}
            </p>
            <p className="text-xs text-[var(--muted)]/60">
              Check your spam folder if you don&apos;t see it
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
