"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

interface FieldErrors {
  name?: string;
  agencyName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", agencyName: "", email: "", password: "", confirmPassword: "" });
  const passwordChecks = {
    minLength: form.password.length >= 6,
    uppercase: /[A-Z]/.test(form.password),
    number: /\d/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.agencyName.trim()) e.agencyName = "Agency name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email format";
    if (!form.password) e.password = "Password is required";
    else if (!/^.*(?=.{6,})(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/.test(form.password)) {
      e.password = "Must be 6+ chars with 1 uppercase, 1 number, and 1 special character";
    }
    if (!form.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, agencyName: form.agencyName, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ general: data.error || "Signup failed" });
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setErrors({ general: "Network error. Please try again." });
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Get started with NextNote</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Agency Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Agency Name</label>
            <input
              type="text"
              placeholder="Your agency name"
              value={form.agencyName}
              onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
              className={inputClass}
            />
            {errors.agencyName && <p className="text-red-400 text-xs mt-1">{errors.agencyName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
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
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              <p className={passwordChecks.minLength ? "text-emerald-400" : "text-[var(--muted)]"}>{passwordChecks.minLength ? "✓" : "•"} 6+ characters</p>
              <p className={passwordChecks.uppercase ? "text-emerald-400" : "text-[var(--muted)]"}>{passwordChecks.uppercase ? "✓" : "•"} 1 uppercase letter</p>
              <p className={passwordChecks.number ? "text-emerald-400" : "text-[var(--muted)]"}>{passwordChecks.number ? "✓" : "•"} 1 number</p>
              <p className={passwordChecks.special ? "text-emerald-400" : "text-[var(--muted)]"}>{passwordChecks.special ? "✓" : "•"} 1 special character</p>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
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
            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-medium text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#e8553d]/20"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted)] mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
