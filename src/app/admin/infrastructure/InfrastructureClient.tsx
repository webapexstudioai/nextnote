"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  Loader2,
  Wallet,
} from "lucide-react";

interface Provider {
  id: string;
  name: string;
  status: "ok" | "error" | "not_configured";
  balanceUsd?: number;
  usageLabel?: string;
  usagePct?: number;
  detail?: string;
  link: string;
  error?: string;
  fetchedAt: string;
}

function fmtUsd(n: number | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 1000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return new Date(iso).toLocaleTimeString();
}

export default function InfrastructureClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/infrastructure/balances", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setProviders(data.providers || []);
      setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const liveProviders = providers.filter((p) => !p.id.startsWith("fixed-"));
  const fixedProviders = providers.filter((p) => p.id.startsWith("fixed-"));

  const liveTotal = liveProviders.reduce((s, p) => s + (p.balanceUsd ?? 0), 0);
  const fixedTotal = fixedProviders.reduce((s, p) => s + (p.balanceUsd ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-violet-400" />
            Infrastructure
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Live balances and usage across every paid service NextNote depends on.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs text-neutral-500">Updated {timeAgo(fetchedAt)}</span>
          )}
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Aggregate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard
          label="Live balances"
          value={fmtUsd(liveTotal)}
          hint={`Across ${liveProviders.filter((p) => p.status === "ok" && p.balanceUsd != null).length} configured providers`}
        />
        <SummaryCard
          label="Fixed monthly"
          value={fmtUsd(fixedTotal)}
          hint={fixedProviders.length > 0 ? `${fixedProviders.length} flat-rate services` : "Set INFRA_FIXED_MONTHLY_USD env to track"}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Live cards */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Live providers</h2>
        {loading ? (
          <LoadingGrid />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveProviders.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )}
      </section>

      {fixedProviders.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Fixed monthly</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fixedProviders.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-4 text-xs text-neutral-500">
        <p className="font-semibold text-neutral-400 mb-1">Configuration notes</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Carrier + Stripe + ElevenLabs + Outscraper read from existing env vars and update live.</li>
          <li>Anthropic + OpenAI usage need <code className="text-neutral-300">ANTHROPIC_ADMIN_KEY</code> / <code className="text-neutral-300">OPENAI_ADMIN_KEY</code> (admin keys, not regular API keys) to render last-30d usage estimates.</li>
          <li>Fixed-cost services use <code className="text-neutral-300">INFRA_FIXED_MONTHLY_USD</code> like <code className="text-neutral-300">Vercel:20,Supabase:25,Resend:0</code>.</li>
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{hint}</div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  const isFixed = provider.id.startsWith("fixed-");
  return (
    <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={provider.status} />
          <span className="text-sm font-medium text-neutral-200 truncate">{provider.name}</span>
        </div>
        {provider.link && !isFixed && (
          <a
            href={provider.link}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-600 hover:text-neutral-300 transition-colors"
            title="Open dashboard"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {provider.status === "not_configured" && (
        <div className="text-sm text-neutral-500">Not configured</div>
      )}
      {provider.status === "error" && (
        <div className="text-sm text-red-400">Error: {provider.error || "unknown"}</div>
      )}
      {provider.status === "ok" && provider.balanceUsd != null && (
        <div className="text-2xl font-semibold tracking-tight text-neutral-100">
          {fmtUsd(provider.balanceUsd)}
        </div>
      )}
      {provider.status === "ok" && provider.usageLabel && (
        <>
          <div className="text-2xl font-semibold tracking-tight text-neutral-100">{provider.usageLabel}</div>
          {provider.usagePct != null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
              <div
                className={`h-full ${provider.usagePct >= 90 ? "bg-red-500" : provider.usagePct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, provider.usagePct)}%` }}
              />
            </div>
          )}
        </>
      )}

      {provider.detail && (
        <div className="mt-1 text-xs text-neutral-500">{provider.detail}</div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Provider["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  return <CircleSlash className="h-3.5 w-3.5 text-neutral-600" />;
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-lg border border-neutral-900 bg-neutral-950 p-4 h-28 animate-pulse" />
      ))}
    </div>
  );
}
