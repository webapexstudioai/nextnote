"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Phone, CalendarCheck, Mic, CheckCircle2, X, Sparkles, ArrowRight, Loader2,
} from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { maybeStartGuidedTour } from "@/components/dashboard/GuidedTour";

const DISMISS_KEY = "nextnote_tour_dismissed";

interface StepStatus {
  prospects: boolean;
  callerId: boolean;
  googleCalendar: boolean;
  voicedropSent: boolean;
}

export default function OnboardingTour() {
  const router = useRouter();
  const { prospects } = useProspects();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<StepStatus>({
    prospects: false,
    callerId: false,
    googleCalendar: false,
    voicedropSent: false,
  });

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setStatus({
          prospects: Boolean(json.prospects) || prospects.length > 0,
          callerId: Boolean(json.callerId),
          googleCalendar: Boolean(json.googleCalendar),
          voicedropSent: Boolean(json.voicedropSent),
        });
      } else {
        setStatus((prev) => ({ ...prev, prospects: prospects.length > 0 }));
      }
    } finally {
      setChecking(false);
    }
  }, [prospects.length]);

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1";
    if (!dismissed) setOpen(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, refresh]);

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setOpen(false);
  };

  // Triggered by X and "Skip for now". If it's their first time skipping the
  // setup guide, offer the guided tour as a softer intro before they're on their own.
  const dismissAndOfferTour = () => {
    dismiss();
    maybeStartGuidedTour();
  };

  const go = (href: string) => {
    router.push(href);
    dismiss();
  };

  const steps = [
    {
      icon: Users,
      title: "Import your first prospects",
      blurb: "Open Prospects, create a folder, then upload a CSV or XLSX. Claude auto-maps your columns — no manual setup.",
      cta: "Open Prospects",
      href: "/dashboard/prospects",
      done: status.prospects,
    },
    {
      icon: Phone,
      title: "Verify your phone for voicedrops",
      blurb: "Add and verify your caller ID so prospects see your number when you drop ringless voicemails. Takes 90 seconds.",
      cta: "Go to Caller ID",
      href: "/dashboard/settings?tab=caller_id",
      done: status.callerId,
    },
    {
      icon: CalendarCheck,
      title: "Connect Google Calendar",
      blurb: "Auto-generate Meet links and send booking confirmations. Required for the appointment scheduler.",
      cta: "Connect",
      href: "/dashboard/settings?tab=integrations",
      done: status.googleCalendar,
    },
    {
      icon: Mic,
      title: "Send your first voicedrop",
      blurb: "Select prospects on the Kanban, record a message, and drop it straight into their voicemail inbox.",
      cta: "Open Prospects",
      href: "/dashboard/prospects",
      done: status.voicedropSent,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);
  const allDone = currentIdx === -1;

  if (!open) return <OnboardingLauncher open={() => { setOpen(true); refresh(); }} completed={completed} total={steps.length} />;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={dismiss}
      />

      <div className="relative w-full max-w-2xl liquid-glass-strong rounded-3xl overflow-hidden liquid-in my-auto">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />

        <div className="p-6 sm:p-8 border-b border-white/5 flex items-start gap-4">
          <div className="relative w-12 h-12 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-[var(--accent)]" />
            <span className="setup-sparkle-ring" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {allDone ? "You're all set." : "Welcome to NextNote"}
            </h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              {allDone
                ? "Every step is complete — your outreach stack is ready."
                : `${steps.length} quick steps to turn NextNote into your outbound engine. ${completed}/${steps.length} done.`}
            </p>
          </div>
          <button
            onClick={dismissAndOfferTour}
            className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 sm:px-8 pt-5">
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full progress-shimmer transition-all duration-700"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-3">
          {steps.map((step, idx) => {
            const isCurrent = idx === currentIdx;
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className={`step-card relative rounded-2xl p-4 sm:p-5 border transition-all duration-500 ${
                  step.done
                    ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                    : isCurrent
                    ? "border-[var(--accent)]/45 bg-[var(--accent)]/[0.06] shadow-[0_0_40px_rgba(232,85,61,0.18)]"
                    : "border-white/5 bg-white/[0.015]"
                }`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {isCurrent && (
                  <span className="absolute -top-2 left-4 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)] text-white shadow-lg">
                    Up next
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      step.done
                        ? "bg-emerald-500/15 text-emerald-400"
                        : isCurrent
                        ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                        : "bg-white/5 text-[var(--muted)]"
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${isCurrent ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                        Step {idx + 1}
                      </span>
                      {step.done && <span className="text-[10px] text-emerald-400 font-semibold">Complete</span>}
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold mt-0.5">{step.title}</h3>
                    <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{step.blurb}</p>
                  </div>
                  {!step.done && (
                    <button
                      onClick={() => go(step.href)}
                      className={`shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
                        isCurrent
                          ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/30"
                          : "bg-white/5 text-[var(--foreground)] hover:bg-white/10"
                      }`}
                    >
                      {step.cta}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!step.done && (
                  <button
                    onClick={() => go(step.href)}
                    className="sm:hidden mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[var(--accent)] text-white"
                  >
                    {step.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 sm:px-8 pb-6 pt-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
            {checking && <Loader2 className="w-3 h-3 animate-spin" />}
            {checking ? "Checking progress…" : "Progress saves automatically as you complete each step."}
          </div>
          <button
            onClick={allDone ? dismiss : dismissAndOfferTour}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {allDone ? "Close" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingLauncher({ open, completed, total }: { open: () => void; completed: number; total: number }) {
  if (completed === total) return null;
  return (
    <button
      onClick={open}
      className="setup-launcher fixed bottom-6 right-6 z-40 liquid-glass-strong rounded-full pl-3 pr-4 py-2 flex items-center gap-2.5 text-xs font-medium hover:border-[var(--accent)]/40 hover:scale-105 transition-all shadow-xl group"
    >
      <span className="relative flex w-6 h-6 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
        <Sparkles className="w-3.5 h-3.5" />
        <span className="absolute inset-0 rounded-full bg-[var(--accent)]/30 animate-ping opacity-60" />
      </span>
      <span className="hidden sm:inline">Setup guide</span>
      <span className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
        {completed}/{total}
      </span>
    </button>
  );
}
