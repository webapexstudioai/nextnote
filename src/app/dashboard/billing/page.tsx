"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, Loader2, CheckCircle, AlertCircle, Zap, RefreshCw, ArrowRight, Sparkles } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/creditPacks";

const MIN_TOPUP = 50;
const MAX_TOPUP = 100_000;

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}

function BillingInner() {
  const search = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<string>("500");
  const [purchasing, setPurchasing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credits/balance");
      const data = await res.json();
      setBalance(data.balance ?? 0);
    } catch {
      setError("Failed to load billing info");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ok = search.get("purchase") === "success" || search.get("topup") === "success";
    if (ok) {
      fetch("/api/credits/reconcile", { method: "POST" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.creditsAdded > 0) setSyncMsg(d.message);
        })
        .then(() => load())
        .catch(() => {});
    }
  }, [search, load]);

  const parsed = parseInt(amount, 10);
  const hasValidAmount = Number.isFinite(parsed) && parsed >= MIN_TOPUP;
  const clamped = Math.min(MAX_TOPUP, Math.max(MIN_TOPUP, Number.isFinite(parsed) ? parsed : MIN_TOPUP));
  const priceUsd = (clamped / 100).toFixed(2);

  const buy = async () => {
    setPurchasing(true);
    setError("");
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: clamped, returnTo: "/dashboard/billing" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPurchasing(false);
    }
  };

  const buyPack = async (packId: string) => {
    setPurchasing(true);
    setError("");
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, returnTo: "/dashboard/billing" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPurchasing(false);
    }
  };

  const reconcile = async () => {
    setSyncing(true);
    setSyncMsg("");
    setError("");
    try {
      const res = await fetch("/api/credits/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncMsg(data.message || "Sync complete");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const purchaseStatus = search.get("purchase") || search.get("topup");

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Billing &amp; Credits</h1>
        <p className="text-sm text-[var(--muted)]">Top up your NextNote credits to power voice calls, AI agents, and voicemail drops.</p>
      </div>

      {purchaseStatus === "success" && (
        <div className="mb-6 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Purchase complete. Credits will appear shortly.
        </div>
      )}
      {purchaseStatus === "canceled" && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Checkout was canceled.
        </div>
      )}

      <div className="liquid-accent rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Current Balance</div>
            <div className="text-3xl font-semibold text-[var(--foreground)]">
              {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : (balance ?? 0).toLocaleString()} <span className="text-sm text-[var(--muted)]">credits</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">~{Math.floor((balance ?? 0) / 16)} minutes of voice calls remaining</p>

        <button
          onClick={reconcile}
          disabled={syncing}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sync recent purchases
        </button>
        {syncMsg && <div className="mt-2 text-xs text-emerald-400">{syncMsg}</div>}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <h2 className="text-sm font-medium text-[var(--foreground)] mb-3 uppercase tracking-wide">Credit packs</h2>
      <div data-tour-id="billing-topup" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {CREDIT_PACKS.map((pack) => {
          const total = pack.credits + pack.bonus;
          const isBusy = purchasing;
          const isPopular = !!pack.popular;
          return (
            <button
              key={pack.id}
              onClick={() => buyPack(pack.id)}
              disabled={isBusy}
              className={`relative text-left rounded-2xl border p-5 transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed ${
                isPopular
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/8 hover:bg-[var(--accent)]/12 hover:border-[var(--accent)]/60"
                  : "border-white/10 bg-[var(--background)] hover:bg-white/5 hover:border-white/20"
              }`}
            >
              {pack.badge && (
                <div className={`absolute top-0 right-0 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-bl-lg ${
                  isPopular ? "bg-[var(--accent)] text-white" : "bg-white/10 text-[var(--muted)]"
                }`}>
                  {pack.badge}
                </div>
              )}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-base font-semibold text-[var(--foreground)]">{pack.label}</span>
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">${(pack.priceCents / 100).toFixed(0)}</div>
              <div className="mt-2 text-xs text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[var(--foreground)]">{total.toLocaleString()} credits</span>
                {pack.bonus > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-emerald-400">
                    <Sparkles className="w-3 h-3" /> +{pack.bonus.toLocaleString()} bonus
                  </span>
                )}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                Buy now <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      <h2 className="text-sm font-medium text-[var(--foreground)] mb-3 uppercase tracking-wide">Custom amount</h2>
      <div className="liquid-glass rounded-2xl p-6">
        <p className="text-sm text-[var(--muted)] mb-4">
          Credits are <span className="text-[var(--foreground)] font-medium">$0.01 each</span>. Minimum top-up is {MIN_TOPUP} credits. Credits never expire.
        </p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              const trimmed = digits.replace(/^0+(?=\d)/, "");
              setAmount(trimmed);
            }}
            className="flex-1 px-4 py-3 bg-[var(--background)] border border-white/10 rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            placeholder={`${MIN_TOPUP}+ credits`}
          />
          <div className="flex items-center px-4 rounded-xl border border-white/10 bg-[var(--background)] text-sm font-mono text-[var(--muted)]">
            ${hasValidAmount ? priceUsd : "0.00"}
          </div>
        </div>

        <button
          onClick={buy}
          disabled={purchasing || !hasValidAmount}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--foreground)] text-sm font-semibold px-4 py-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {purchasing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening Stripe…
            </>
          ) : !hasValidAmount ? (
            <>
              <Zap className="w-4 h-4" />
              Enter at least {MIN_TOPUP} credits
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Buy {clamped.toLocaleString()} credits — ${priceUsd}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--background)] p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[var(--foreground)]">Need more every month?</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            Upgrade to a Pro subscription to get 250 bonus credits included each month.
          </div>
        </div>
        <a
          href="/dashboard/settings?tab=subscription"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-[var(--foreground)] transition-colors"
        >
          Manage plan <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <p className="text-xs text-[var(--muted)] mt-8">
        Credits never expire. Used for voice calls, AI agents, and voicemail drops across NextNote.
      </p>
    </div>
  );
}
