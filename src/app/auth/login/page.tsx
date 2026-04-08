"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        return;
      }
      window.location.href = "/dashboard";
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
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Log in to your NextNote account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              autoFocus
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-medium text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#e8553d]/20"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted)] mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            Sign up
          </Link>
        </p>
        <p className="text-center text-sm mt-3">
          <Link href="/auth/forgot-password" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            Forgot Password?
          </Link>
        </p>

        <p className="text-center text-xs text-[var(--muted)] mt-4 opacity-60">
          You can connect Google Calendar after logging in from the Appointments page
        </p>
      </div>
    </div>
  );
}
