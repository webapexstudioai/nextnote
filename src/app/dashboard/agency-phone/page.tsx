"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Phone, Save, Loader2, AlertCircle, Sparkles, Clock, ShieldCheck, Zap } from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";

type AgencyPhone = {
  phone_number: string;
  label: string | null;
  twilio_sid: string | null;
  created_at?: string;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};
type AvailableNumber = { phone_number: string; friendly_name: string; locality?: string; region?: string };

const TRIAL_DAYS = 14;
const TRIAL_GRACE_DAYS = 3;

function trialState(p: AgencyPhone | null): {
  kind: "paid" | "trial" | "grace" | "expired";
  endsAt?: Date;
  graceEndsAt?: Date;
  daysLeft?: number;
} {
  if (!p?.trial_ends_at) return { kind: "paid" };
  const endsAt = new Date(p.trial_ends_at);
  const graceEndsAt = new Date(endsAt.getTime() + TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const now = Date.now();
  const msLeft = endsAt.getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  if (now < endsAt.getTime()) return { kind: "trial", endsAt, graceEndsAt, daysLeft };
  if (now < graceEndsAt.getTime()) return { kind: "grace", endsAt, graceEndsAt, daysLeft };
  return { kind: "expired", endsAt, graceEndsAt, daysLeft: 0 };
}

export default function AgencyPhonePage() {
  return (
    <Suspense fallback={null}>
      <AgencyPhoneInner />
    </Suspense>
  );
}

function AgencyPhoneInner() {
  const [agencyPhone, setAgencyPhone] = useState<AgencyPhone | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [forwardToNumber, setForwardToNumber] = useState<string>("");
  const [forwardSaving, setForwardSaving] = useState(false);
  const [agencyLoading, setAgencyLoading] = useState(false);
  const [agencyError, setAgencyError] = useState("");
  const [agencyAreaCode, setAgencyAreaCode] = useState("");
  const [agencySearching, setAgencySearching] = useState(false);
  const [agencyAvailable, setAgencyAvailable] = useState<AvailableNumber[]>([]);
  const [agencyBuying, setAgencyBuying] = useState<string | null>(null);
  const [agencyClaiming, setAgencyClaiming] = useState<string | null>(null);
  const [agencyReleasing, setAgencyReleasing] = useState(false);
  const [agencyPurchasePending, setAgencyPurchasePending] = useState(false);
  const [keepCheckoutLoading, setKeepCheckoutLoading] = useState(false);

  async function loadAgencyPhone() {
    setAgencyLoading(true);
    setAgencyError("");
    try {
      const res = await fetch("/api/agency/phone");
      const data = await res.json();
      if (res.ok) {
        setAgencyPhone(data.agency_phone || null);
        setForwardToNumber(data.forward_to_number || "");
        setTrialUsed(!!data.trial_used);
      } else {
        setAgencyError(data.error || "Failed to load agency phone");
      }
    } catch {
      setAgencyError("Network error");
    } finally {
      setAgencyLoading(false);
    }
  }

  useEffect(() => {
    loadAgencyPhone();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchased") === "success") {
      setAgencyPurchasePending(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts += 1;
        try {
          const res = await fetch("/api/agency/phone");
          const data = await res.json();
          if (res.ok && data.agency_phone) {
            setAgencyPhone(data.agency_phone);
            setForwardToNumber(data.forward_to_number || "");
            setTrialUsed(!!data.trial_used);
            setAgencyPurchasePending(false);
            clearInterval(interval);
          }
        } catch {}
        if (attempts >= 15) {
          setAgencyPurchasePending(false);
          clearInterval(interval);
        }
      }, 2000);
      window.history.replaceState({}, "", "/dashboard/agency-phone");
      return () => clearInterval(interval);
    }
    if (params.get("purchased") === "canceled" || params.get("kept") === "canceled" || params.get("kept") === "success") {
      window.history.replaceState({}, "", "/dashboard/agency-phone");
    }
  }, []);

  async function searchAgencyNumbers() {
    setAgencySearching(true);
    setAgencyError("");
    setAgencyAvailable([]);
    try {
      const res = await fetch("/api/agency/phone/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaCode: agencyAreaCode.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) setAgencyAvailable(data.numbers || []);
      else setAgencyError(data.error || "Search failed");
    } catch {
      setAgencyError("Network error");
    } finally {
      setAgencySearching(false);
    }
  }

  async function buyAgencyNumber(phoneNumber: string) {
    setAgencyBuying(phoneNumber);
    setAgencyError("");
    try {
      const res = await fetch("/api/agency/phone/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setAgencyError(data.error || "Checkout failed");
    } catch {
      setAgencyError("Network error");
    } finally {
      setAgencyBuying(null);
    }
  }

  async function claimTrialNumber(phoneNumber: string) {
    setAgencyClaiming(phoneNumber);
    setAgencyError("");
    try {
      const res = await fetch("/api/agency/phone/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadAgencyPhone();
        setAgencyAvailable([]);
        return;
      }
      setAgencyError(data.error || "Trial claim failed");
    } catch {
      setAgencyError("Network error");
    } finally {
      setAgencyClaiming(null);
    }
  }

  async function startKeepCheckout() {
    setKeepCheckoutLoading(true);
    setAgencyError("");
    try {
      const res = await fetch("/api/agency/phone/keep-checkout", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setAgencyError(data.error || "Checkout failed");
    } catch {
      setAgencyError("Network error");
    } finally {
      setKeepCheckoutLoading(false);
    }
  }

  async function saveForwardToNumber() {
    setForwardSaving(true);
    setAgencyError("");
    try {
      const res = await fetch("/api/agency/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forward_to_number: forwardToNumber.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setForwardToNumber(data.forward_to_number || "");
      } else {
        setAgencyError(data.error || "Save failed");
      }
    } catch {
      setAgencyError("Network error");
    } finally {
      setForwardSaving(false);
    }
  }

  async function releaseAgencyNumber() {
    if (!confirm("Release this agency number? Inbound calls and texts will stop routing here. No refund.")) return;
    setAgencyReleasing(true);
    setAgencyError("");
    try {
      const res = await fetch("/api/agency/phone", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setAgencyPhone(null);
      } else {
        setAgencyError(data.error || "Release failed");
      }
    } catch {
      setAgencyError("Network error");
    } finally {
      setAgencyReleasing(false);
    }
  }

  const trial = useMemo(() => trialState(agencyPhone), [agencyPhone]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
          <Phone className="w-5 h-5 text-[var(--accent)]" /> Agency Phone Line
        </h1>
        <p className="text-sm text-[var(--muted)]">
          A Twilio number dedicated to your agency for SMS follow-ups, replies, and call forwarding.
        </p>
      </div>

      <div className="rounded-xl liquid-glass p-5">
        {agencyPurchasePending && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--foreground)] text-sm mb-4">
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[var(--accent)]" />
            Payment received — provisioning your number on Twilio. This usually takes a few seconds…
          </div>
        )}

        {agencyError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {agencyError}
            <button onClick={() => setAgencyError("")} className="ml-auto text-red-400/60 hover:text-red-400">&times;</button>
          </div>
        )}

        {agencyLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
          </div>
        ) : agencyPhone ? (
          <div className="space-y-4">
            {trial.kind === "trial" && (
              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] mb-0.5">
                      You&apos;re on a free trial
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {trial.daysLeft === 0
                        ? "Trial ends today."
                        : `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left.`}{" "}
                      Pay $5 once to keep this number permanently.
                    </p>
                  </div>
                  <button
                    onClick={startKeepCheckout}
                    disabled={keepCheckoutLoading}
                    className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5"
                  >
                    {keepCheckoutLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                    Keep ($5)
                  </button>
                </div>
              </div>
            )}

            {trial.kind === "grace" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] mb-0.5">
                      Your trial ended
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Your number stays active for {TRIAL_GRACE_DAYS} more days. Pay $5 now to keep it forever, or it&apos;ll be released.
                    </p>
                  </div>
                  <button
                    onClick={startKeepCheckout}
                    disabled={keepCheckoutLoading}
                    className="text-xs px-3 py-1.5 rounded-md bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5"
                  >
                    {keepCheckoutLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                    Pay now ($5)
                  </button>
                </div>
              </div>
            )}

            <div
              className={`rounded-xl border p-4 ${
                trial.kind === "paid"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : trial.kind === "expired"
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-[var(--border)] bg-[var(--background)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mb-2 border ${
                      trial.kind === "paid"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : trial.kind === "trial"
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20"
                        : trial.kind === "grace"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {trial.kind === "paid"
                      ? "ACTIVE"
                      : trial.kind === "trial"
                      ? "TRIAL"
                      : trial.kind === "grace"
                      ? "GRACE PERIOD"
                      : "EXPIRED"}
                  </p>
                  <p className="text-base font-mono font-semibold text-[var(--foreground)]">
                    {agencyPhone.phone_number}
                  </p>
                  {agencyPhone.label && (
                    <p className="text-xs text-[var(--muted)] mt-0.5">{agencyPhone.label}</p>
                  )}
                </div>
                <button
                  onClick={releaseAgencyNumber}
                  disabled={agencyReleasing}
                  className="text-xs px-3 py-1.5 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {agencyReleasing ? "Releasing…" : "Release"}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2 block">
                Forward inbound calls to
              </label>
              <p className="text-[11px] text-[var(--muted)] mb-2">
                When a prospect calls your agency number, Twilio will dial this cell. Leave blank to play a fallback message.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <input
                  type="tel"
                  value={forwardToNumber}
                  onChange={(e) => setForwardToNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className={inputClass}
                />
                <button
                  onClick={saveForwardToNumber}
                  disabled={forwardSaving}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                >
                  {forwardSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save</>}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!trialUsed && (
              <div className="rounded-xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/5 to-transparent p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)] mb-0.5">
                      Try free for {TRIAL_DAYS} days
                    </p>
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      Pick any number below and start texting prospects today. After {TRIAL_DAYS} days, pay a one-time $5 to keep it — or it&apos;ll release automatically. One trial per account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={agencyAreaCode}
                onChange={(e) => setAgencyAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Area code (optional, e.g. 415)"
                className={inputClass}
              />
              <button
                onClick={searchAgencyNumbers}
                disabled={agencySearching}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {agencySearching ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Phone className="w-4 h-4" /> Search</>}
              </button>
            </div>

            {agencyAvailable.length > 0 && (
              <div className="space-y-2">
                {agencyAvailable.map((n) => {
                  const isClaiming = agencyClaiming === n.phone_number;
                  const isBuying = agencyBuying === n.phone_number;
                  const anyBusy = agencyClaiming !== null || agencyBuying !== null;
                  return (
                    <div key={n.phone_number} className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-[var(--foreground)] truncate">{n.friendly_name}</p>
                        {(n.locality || n.region) && (
                          <p className="text-[11px] text-[var(--muted)] truncate">
                            {[n.locality, n.region].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!trialUsed && (
                          <button
                            onClick={() => claimTrialNumber(n.phone_number)}
                            disabled={anyBusy}
                            className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                            {isClaiming ? "Claiming…" : `Try free ${TRIAL_DAYS}d`}
                          </button>
                        )}
                        <button
                          onClick={() => buyAgencyNumber(n.phone_number)}
                          disabled={anyBusy}
                          className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
                            trialUsed
                              ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-medium"
                              : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]/30"
                          }`}
                        >
                          {isBuying ? "Redirecting…" : trialUsed ? "Buy ($5)" : "Buy now ($5)"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {agencyAvailable.length === 0 && !agencySearching && (
              <p className="text-xs text-[var(--muted)] text-center py-6">
                Search for available numbers to get started.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
