"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";
import { checkPassword } from "@/lib/password";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = useMemo(() => checkPassword(password), [password]);
  const allPassed = checks.minLength && checks.hasUppercase && checks.hasNumber && checks.hasSpecial;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!allPassed) {
      setError("Please meet all password requirements.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(232,85,61,0.5)] focus:border-[rgba(232,85,61,0.5)] transition-colors";

  const requirements = [
    { key: "minLength" as const, label: "At least 6 characters" },
    { key: "hasUppercase" as const, label: "One uppercase letter" },
    { key: "hasNumber" as const, label: "One number" },
    { key: "hasSpecial" as const, label: "One special character" },
  ];

  return (
    <>
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <OrbitGridIcon size={48} />
        </div>

        {success ? (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold">Password reset!</h1>
            <p className="text-[var(--muted)] text-sm mt-1">
              Your password has been updated successfully.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Set new password</h1>
            <p className="text-[var(--muted)] text-sm mt-1">
              Choose a strong password for your account
            </p>
          </>
        )}
      </div>

      {success ? (
        <div className="space-y-4">
          <Link
            href="/auth/login"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-medium text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#e8553d]/20"
          >
            Go to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!token && (
            <div className="px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              No reset token found. Please use the link from your email.
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password strength indicators */}
          {password.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-1">
              {requirements.map((r) => (
                <div key={r.key} className="flex items-center gap-1.5 text-xs">
                  {checks[r.key] ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                  )}
                  <span className={checks[r.key] ? "text-emerald-400" : "text-[var(--muted)]"}>
                    {r.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1.5 pl-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-medium text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#e8553d]/20"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Resetting..." : "Reset Password"}
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
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#e8553d]/[0.04] blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <Suspense fallback={
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#e8553d] to-[#ff8a6a] mb-4">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <p className="text-[var(--muted)] text-sm">Loading...</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
