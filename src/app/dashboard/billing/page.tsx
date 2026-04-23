"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, Loader2, CheckCircle, AlertCircle, Zap, RefreshCw, ArrowRight } from "lucide-react";

const PRESETS = [100, 500, 1000, 2500];
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
  const [amount, setAmount] = useState<number>(500);
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

  const clamped = Math.min(MAX_TOPUP, Math.max(MIN_TOPUP, Math.floor(amount || 0)));
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

      <h2 className="text-sm font-medium text-[var(--foreground)] mb-3 uppercase tracking-wide">Top up</h2>
      <div className="liquid-glass rounded-2xl p-6">
        <p className="text-sm text-[var(--muted)] mb-4">
          Credits are <span className="text-[var(--foreground)] font-medium">$0.01 each</span>. Minimum top-up is {MIN_TOPUP} credits. Credits never expire.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {PRESETS.map((p) => {
            const active = clamped === p;
            return (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all border ${
                  active
                    ? "bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--foreground)]"
                    : "bg-[var(--background)] border-white/10 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-white/20"
                }`}
              >
                <div className="font-semibold">{p.toLocaleString()}</div>
                <div className="text-[11px] text-[var(--muted)]">${(p / 100).toFixed(2)}</div>
              </button>
            );
          })}
        </div>

        <label className="block text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">Or enter a custom amount</label>
        <div className="flex items-stretch gap-2">
          <input
            type="number"
            min={MIN_TOPUP}
            max={MAX_TOPUP}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="flex-1 px-4 py-3 bg-[var(--background)] border border-white/10 rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            placeholder="Credits"
          />
          <div className="flex items-center px-4 rounded-xl border border-white/10 bg-[var(--background)] text-sm font-mono text-[var(--muted)]">
            ${priceUsd}
          </div>
        </div>

        <button
          onClick={buy}
          disabled={purchasing}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-3 shadow-lg shadow-[var(--accent)]/25 transition-all disabled:opacity-60"
        >
          {purchasing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening Stripe…
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
