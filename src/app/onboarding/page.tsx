"use client";

import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Loader2, MessageSquare, Star, Target } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

const steps = [
  {
    id: 1,
    icon: MessageSquare,
    title: "Why did you choose NextNote?",
    subtitle: "Help us understand what brought you here",
    field: "reason_chose" as const,
    placeholder: "I was looking for a smarter way to manage my agency's prospects and close more deals...",
  },
  {
    id: 2,
    icon: Star,
    title: "What made NextNote stand out?",
    subtitle: "What caught your eye about our platform",
    field: "what_stood_out" as const,
    placeholder: "The AI-powered insights and the clean interface really stood out compared to other CRMs...",
  },
  {
    id: 3,
    icon: Target,
    title: "How dedicated will you be to scaling?",
    subtitle: "Rate your commitment from 1 to 10",
    field: "dedication_score" as const,
    placeholder: "",
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState({
    reason_chose: "",
    what_stood_out: "",
    dedication_score: 7,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function goToStep(step: number) {
    if (step === currentStep) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentStep(step);
      setTransitioning(false);
    }, 300);
  }

  function handleNext() {
    const step = steps[currentStep];
    if (step.field === "dedication_score") {
      if (form.dedication_score < 1 || form.dedication_score > 10) {
        setError("Please select a score between 1 and 10");
        return;
      }
    } else {
      if (!form[step.field].trim()) {
        setError("This field is required");
        return;
      }
    }
    setError("");

    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      submitOnboarding();
    }
  }

  async function submitOnboarding() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      window.location.href = "/welcome";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const step = steps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative overflow-hidden">
      <div className="grid-bg" />
      <div className="glow-hero pointer-events-none absolute inset-0" />
      <div className="orb orb-1" style={{ top: "10%", left: "20%" }} />
      <div className="orb orb-2" style={{ bottom: "15%", right: "15%" }} />

      <div
        className={`w-full max-w-lg relative z-10 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-[#e8553d]/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e8553d]/10 to-transparent border border-[rgba(232,85,61,0.2)] flex items-center justify-center">
                <OrbitGridIcon size={36} />
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-[var(--border)] rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#e8553d] to-[#ff8a6a] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step content */}
        <div
          className={`glass-card rounded-2xl p-8 transition-all duration-300 ${
            transitioning ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-[rgba(232,85,61,0.1)] text-[var(--accent)]`}>
            <Icon className="w-6 h-6" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">{step.title}</h2>
          <p className="text-[var(--muted)] text-sm mb-6">{step.subtitle}</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {step.field === "dedication_score" ? (
            <div className="space-y-6">
              {/* Slider */}
              <div className="text-center">
                <div className="text-6xl font-bold text-[var(--accent)] mb-4">
                  {form.dedication_score}
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={form.dedication_score}
                  onChange={(e) => setForm({ ...form, dedication_score: parseInt(e.target.value) })}
                  className="w-full h-2 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-[#e8553d]"
                  style={{
                    background: `linear-gradient(to right, #e8553d 0%, #e8553d ${(form.dedication_score - 1) * 11.1}%, var(--border) ${(form.dedication_score - 1) * 11.1}%, var(--border) 100%)`,
                  }}
                />
                <div className="flex justify-between mt-2 text-xs text-[var(--muted)]">
                  <span>1 - Just exploring</span>
                  <span>10 - All in</span>
                </div>
              </div>
            </div>
          ) : (
            <textarea
              value={form[step.field]}
              onChange={(e) => setForm({ ...form, [step.field]: e.target.value })}
              placeholder={step.placeholder}
              rows={4}
              className="w-full px-4 py-3.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(232,85,61,0.4)] focus:border-[rgba(232,85,61,0.4)] transition-all duration-300 resize-none"
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 gap-4">
            {currentStep > 0 ? (
              <button
                onClick={() => goToStep(currentStep - 1)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[rgba(232,85,61,0.3)] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white font-semibold text-sm hover:from-[#f06a54] hover:to-[#e8553d] transition-all shadow-lg shadow-[#e8553d]/25 hover:shadow-xl hover:shadow-[#e8553d]/30 hover:-translate-y-0.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finishing...
                </>
              ) : currentStep === steps.length - 1 ? (
                <>
                  Complete
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
