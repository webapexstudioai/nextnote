"use client";

import { useEffect, useState } from "react";
import { Coins, Zap, X, ArrowRight, Loader2 } from "lucide-react";

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  bonusLabel?: string;
}

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
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [buying, setBuying] = useState<"exact" | string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/credits/packs")
      .then((res) => (res.ok ? res.json() : { packs: [] }))
      .then((data) => setPacks(data.packs ?? []))
      .catch(() => setPacks([]));
  }, [open]);

  if (!open) return null;

  const shortfall = Math.max(0, required - balance);
  const topupCredits = Math.max(MIN_TOPUP, shortfall);
  const topupCents = topupCredits;
  const minBumped = topupCredits !== shortfall;

  const recommendedPack = packs.find((p) => p.credits >= topupCredits && p.bonusLabel);

  async function buyExact() {
    setError("");
    setBuying("exact");
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credits: topupCredits,
          returnTo: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/dashboard",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Couldn't start checkout. Try again in a moment.");
        setBuying(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error. Try again in a moment.");
      setBuying(null);
    }
  }

  async function buyPack(packId: string) {
    setError("");
    setBuying(packId);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Couldn't start checkout. Try again in a moment.");
        setBuying(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error. Try again in a moment.");
      setBuying(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md liquid-glass-strong rounded-3xl overflow-hidden liquid-in my-auto shadow-2xl">
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

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Shortfall</span>
              <span className="font-mono text-[var(--foreground)]">{shortfall.toLocaleString()} credits</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
              <span>You'd pay</span>
              <span className="font-mono text-[var(--foreground)]">{formatUsd(topupCents)}</span>
            </div>
            {minBumped && (
              <p className="mt-3 text-[11px] text-[var(--muted)] leading-relaxed">
                Minimum top-up is {MIN_TOPUP} credits — leftover sits in your balance for next time.
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={buyExact}
            disabled={buying !== null}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-3 shadow-lg shadow-[var(--accent)]/30 transition-all disabled:opacity-60"
          >
            {buying === "exact" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening Stripe…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Buy {topupCredits.toLocaleString()} credits — {formatUsd(topupCents)}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            One-click checkout. Credits appear instantly after payment.
          </p>
        </div>

        {recommendedPack && (
          <div className="border-t border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent px-6 py-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
              <Zap className="w-3 h-3" />
              Better value
            </div>
            <button
              onClick={() => buyPack(recommendedPack.id)}
              disabled={buying !== null}
              className="mt-2 w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 px-4 py-3 text-left transition-all disabled:opacity-60"
            >
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {recommendedPack.name} — {recommendedPack.credits.toLocaleString()} credits
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">
                  {recommendedPack.bonusLabel} · {formatUsd(recommendedPack.priceCents)}
                </div>
              </div>
              {buying === recommendedPack.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--muted)] shrink-0" />
              ) : (
                <ArrowRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
              )}
            </button>
          </div>
        )}

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
            See all packs →
          </a>
        </div>
      </div>
    </div>
  );
}
