"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, Loader2, CheckCircle, AlertCircle, Zap, RefreshCw } from "lucide-react";

interface Pack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  bonusLabel?: string;
}

export default function BillingPage() {
  const search = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        fetch("/api/credits/balance"),
        fetch("/api/credits/packs"),
      ]);
      const bData = await bRes.json();
      const pData = await pRes.json();
      setBalance(bData.balance ?? 0);
      setPacks(pData.packs || []);
    } catch {
      setError("Failed to load billing info");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // When Stripe redirects back with ?purchase=success, auto-reconcile in case
  // the webhook didn't reach us (common in local dev).
  useEffect(() => {
    if (search.get("purchase") === "success") {
      fetch("/api/credits/reconcile", { method: "POST" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.creditsAdded > 0) setSyncMsg(d.message);
        })
        .then(() => load())
        .catch(() => {});
    }
  }, [search, load]);

  const buy = async (packId: string) => {
    setPurchasing(packId);
    setError("");
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPurchasing(null);
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

  const purchaseStatus = search.get("purchase");

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
        <p className="text-xs text-[var(--muted)]">~{Math.floor((balance ?? 0) / 12)} minutes of voice calls remaining</p>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => {
          const highlight = pack.id === "growth";
          return (
            <div
              key={pack.id}
              className={`rounded-2xl p-5 flex flex-col liquid-in ${highlight ? "liquid-accent" : "liquid-glass"}`}
            >
              {highlight && (
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider mb-3">
                  <Zap className="w-3 h-3" /> Most popular
                </div>
              )}
              <div className="text-sm text-[var(--muted)] mb-1">{pack.name}</div>
              <div className="text-2xl font-semibold text-[var(--foreground)]">
                ${(pack.priceCents / 100).toFixed(0)}
              </div>
              <div className="text-sm text-[var(--foreground)] mt-2">
                {pack.credits.toLocaleString()} credits
              </div>
              {pack.bonusLabel && (
                <div className="text-xs text-emerald-400 mt-1">{pack.bonusLabel}</div>
              )}
              <div className="text-xs text-[var(--muted)] mt-2">
                ~{Math.floor(pack.credits / 12)} minutes of calls
              </div>
              <button
                onClick={() => buy(pack.id)}
                disabled={purchasing !== null}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {purchasing === pack.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                ) : (
                  "Top up"
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--muted)] mt-8">
        Credits never expire. Used for voice calls, AI agents, and voicemail drops across NextNote.
      </p>
    </div>
  );
}
