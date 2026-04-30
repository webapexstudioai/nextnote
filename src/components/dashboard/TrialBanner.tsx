"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Clock, X, AlertTriangle } from "lucide-react";
import { getAgencyTrialState, type AgencyTrialKind } from "@/lib/agencyPhoneState";

const DISMISS_KEY = "nextnote_trial_banner_dismissed_v1";

export default function TrialBanner() {
  const pathname = usePathname();
  const [kind, setKind] = useState<AgencyTrialKind>("none");
  const [daysLeft, setDaysLeft] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agency/phone");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const state = getAgencyTrialState({
          trialEndsAt: data.agency_phone?.trial_ends_at,
          hasRow: !!data.agency_phone,
        });
        setKind(state.kind);
        setDaysLeft(state.daysLeft);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;
  if (pathname === "/dashboard/agency-phone") return null;
  if (kind !== "trial" && kind !== "grace") return null;

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  }

  if (kind === "grace") {
    return (
      <div className="px-4 py-3 border-b border-amber-500/30 bg-amber-500/10 flex items-center gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <div className="flex-1 text-amber-100">
          <strong className="font-semibold">Your free phone trial ended.</strong>{" "}
          SMS sending is paused. Keep your number for $5 to resume.
        </div>
        <Link
          href="/dashboard/agency-phone"
          className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium text-xs whitespace-nowrap"
        >
          Pay $5 to keep
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 rounded hover:bg-amber-500/20 text-amber-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const urgent = daysLeft <= 3;
  return (
    <div
      className={`px-4 py-3 border-b flex items-center gap-3 text-sm ${
        urgent
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-[var(--accent)]/30 bg-[var(--accent)]/10"
      }`}
    >
      <Clock className={`w-4 h-4 flex-shrink-0 ${urgent ? "text-amber-400" : "text-[var(--accent)]"}`} />
      <div className={`flex-1 ${urgent ? "text-amber-100" : "text-[var(--foreground)]"}`}>
        <strong className="font-semibold">
          {daysLeft} {daysLeft === 1 ? "day" : "days"} left
        </strong>{" "}
        on your free phone trial. Keep your number for $5 before it expires.
      </div>
      <Link
        href="/dashboard/agency-phone"
        className={`px-3 py-1.5 rounded-md font-medium text-xs whitespace-nowrap ${
          urgent
            ? "bg-amber-500 hover:bg-amber-400 text-amber-950"
            : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
        }`}
      >
        Keep ($5)
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 rounded hover:bg-white/10 text-[var(--foreground)]/70"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
