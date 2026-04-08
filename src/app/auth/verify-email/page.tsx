"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, CheckCircle, Mail, RefreshCw } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function VerifyEmailPage() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send initial OTP on mount
  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-verification-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "Email already verified") {
          window.location.href = "/dashboard";
          return;
        }
        setError(data.error || "Failed to send code");
      } else {
        setSent(true);
        setCooldown(60);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    const fullCode = next.join("");
    if (fullCode.length === 6 && next.every((d) => d !== "")) {
      verifyCode(fullCode);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...code];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    setCode(next);
    if (pasted.length === 6) {
      verifyCode(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }

  async function verifyCode(otp: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setSuccess(true);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#e8553d]/[0.04] blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <OrbitGridIcon size={48} />
          </div>

          {success ? (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold">Email verified!</h1>
              <p className="text-[var(--muted)] text-sm mt-2">
                Welcome to NextNote. Redirecting to your dashboard...
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-[rgba(232,85,61,0.1)] border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[var(--accent)]" />
                </div>
              </div>
              <h1 className="text-2xl font-bold">Verify your email</h1>
              <p className="text-[var(--muted)] text-sm mt-2 leading-relaxed">
                {sent
                  ? "We sent a 6-digit code to your email. Enter it below to verify your account."
                  : "Sending verification code to your email..."}
              </p>
            </>
          )}
        </div>

        {!success && (
          <div className="space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading}
                  className="w-12 h-14 text-center text-xl font-bold bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[rgba(232,85,61,0.5)] focus:border-[rgba(232,85,61,0.5)] transition-colors disabled:opacity-50"
                />
              ))}
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </div>
            )}

            {/* Resend */}
            <div className="text-center">
              <p className="text-sm text-[var(--muted)]">
                Didn&apos;t receive the code?{" "}
                {cooldown > 0 ? (
                  <span className="text-[var(--muted)]">
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button
                    onClick={sendCode}
                    disabled={resending}
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors inline-flex items-center gap-1"
                  >
                    {resending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Resend code
                  </button>
                )}
              </p>
            </div>

            <div className="text-center">
              <button
                onClick={() => { window.location.href = "/dashboard"; }}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
