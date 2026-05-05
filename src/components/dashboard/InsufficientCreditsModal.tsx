"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, Zap, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { CREDIT_PACKS, type CreditPack } from "@/lib/creditPacks";

interface Props {
  open: boolean;
  onClose: () => void;
  required: number;
  balance: number;
  action: string;
}

const MIN_TOPUP = 50;

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InsufficientCreditsModal({ open, onClose, required, balance, action }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  const shortfall = Math.max(0, required - balance);
  const exactCredits = Math.max(MIN_TOPUP, shortfall);
  const exactCents = exactCredits;

  // Highlight the smallest pack that covers the shortfall — that's the
  // user's natural "this fixes my problem" choice and the one we should
  // visually nudge toward by default.
  const recommended =
    CREDIT_PACKS.find((p) => p.credits + p.bonus >= shortfall) ?? CREDIT_PACKS[CREDIT_PACKS.length - 1];

  async function startCheckout(payload: Record<string, unknown>, key: string) {
    setError("");
    setBusy(key);
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          returnTo: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/dashboard",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Couldn't start checkout. Try again in a moment.");
        setBusy(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error. Try again in a moment.");
      setBusy(null);
    }
  }

  const buyPack = (pack: CreditPack) => startCheckout({ packId: pack.id }, pack.id);
  const buyExact = () => startCheckout({ credits: exactCredits }, "exact");

  return createPortal(
    <>
      <div
        className="fixed z-[220] bg-black/70 backdrop-blur-md"
        style={{ top: 0, left: 0, width: "100vw", height: "100vh" }}
        onClick={onClose}
      />
      <div
        className="fixed z-[221] flex items-start justify-center p-4 overflow-y-auto"
        style={{ top: 0, left: 0, width: "100vw", height: "100vh" }}
      >
        <div className="relative w-full max-w-lg liquid-glass-strong rounded-3xl overflow-hidden liquid-in my-auto shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
              <Coins className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                A little short on credits
              </h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {action} needs {required.toLocaleString()} credits. You've got {balance.toLocaleString()}.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {CREDIT_PACKS.map((pack) => {
              const total = pack.credits + pack.bonus;
              const isRecommended = pack.id === recommended.id;
              const isBusy = busy === pack.id;
              const anyBusy = busy !== null;
              return (
                <button
                  key={pack.id}
                  onClick={() => buyPack(pack)}
                  disabled={anyBusy}
                  className={`w-full text-left rounded-2xl border p-4 transition-all relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed ${
                    isRecommended
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/8 hover:bg-[var(--accent)]/12 hover:border-[var(--accent)]/60"
                      : "border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20"
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute top-0 right-0 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-[var(--accent)] text-white rounded-bl-lg">
                      Recommended
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--foreground)]">{pack.label}</span>
                        {pack.badge && !isRecommended && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/5 text-[var(--muted)] border border-white/10">
                            {pack.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[var(--foreground)]">{total.toLocaleString()} credits</span>
                        {pack.bonus > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-400">
                            <Sparkles className="w-3 h-3" /> +{pack.bonus.toLocaleString()} bonus
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-[var(--foreground)]">{formatUsd(pack.priceCents)}</div>
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted)] ml-auto mt-1" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] ml-auto mt-1" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={buyExact}
              disabled={busy !== null}
              className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
            >
              {busy === "exact" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Opening Stripe…
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" /> Or just cover the shortfall — {exactCredits.toLocaleString()} credits, {formatUsd(exactCents)}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Not now
          </button>
          <a
            href="/dashboard/billing"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Billing →
          </a>
        </div>
        </div>
      </div>
    </>,
    document.body
  );
}
