"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Search, Loader2, Coins, CheckCircle, AlertCircle,
  Globe, ArrowRight, Info, Wand2, FolderPlus, Folder,
} from "lucide-react";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";
import { useProspects } from "@/context/ProspectsContext";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
  "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
];

const NICHE_SUGGESTIONS = [
  "Plumbers", "Roofers", "HVAC contractors", "Electricians",
  "Landscapers", "Dentists", "Chiropractors", "Med spas",
  "Gyms", "Auto repair shops", "Real estate agents", "Law firms",
];

const COUNT_OPTIONS = [25, 50, 100];
const CREDITS_PER_PROSPECT = 5;

interface ImportedProspect {
  id: string;
  name: string;
  phone: string;
  address?: string;
  website?: string;
}

interface FolderOption {
  id: string;
  name: string;
  color: string;
}

interface ImportResponse {
  folder: { id: string; name: string; color: string; createdAt: string };
  prospects: ImportedProspect[];
  imported: number;
  creditsSpent: number;
}

type Destination = { mode: "new" } | { mode: "existing"; folderId: string };

export default function SourcesPage() {
  const router = useRouter();
  const { refresh } = useProspects();
  const [niche, setNiche] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [count, setCount] = useState(25);
  const [balance, setBalance] = useState<number | null>(null);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [destination, setDestination] = useState<Destination>({ mode: "new" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [creditsPaywall, setCreditsPaywall] = useState<{ required: number; balance: number } | null>(null);

  useEffect(() => {
    fetch("/api/credits/balance")
      .then((r) => (r.ok ? r.json() : { balance: 0 }))
      .then((d) => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0));

    fetch("/api/crm")
      .then((r) => (r.ok ? r.json() : { folders: [] }))
      .then((d) => {
        const list: FolderOption[] = (d.folders ?? []).map((f: { id: string; name: string; color: string }) => ({
          id: f.id,
          name: f.name,
          color: f.color,
        }));
        setFolders(list);
      })
      .catch(() => {});
  }, []);

  const maxCost = count * CREDITS_PER_PROSPECT;
  const maxCostUsd = (maxCost / 100).toFixed(2);
  const canAfford = balance === null ? true : balance >= maxCost;
  const locationLabel = city.trim() ? `${city.trim()}, ${state}` : state;

  async function handleImport() {
    if (!niche.trim() || !state) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/sources/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          location: locationLabel,
          count,
          folderId: destination.mode === "existing" ? destination.folderId : undefined,
        }),
      });
      const data = await res.json();

      if (res.status === 402) {
        setCreditsPaywall({ required: data.required ?? maxCost, balance: data.balance ?? 0 });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Import failed. Try again.");
        setLoading(false);
        return;
      }

      setResult(data as ImportResponse);
      // Pull the new folder + prospects into the shared CRM context so they
      // appear on the Prospects page without a hard refresh.
      refresh().catch(() => {});
      // Refresh balance
      fetch("/api/credits/balance")
        .then((r) => (r.ok ? r.json() : { balance }))
        .then((d) => setBalance(d.balance ?? balance));
    } catch {
      setError("Network error. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setResult(null);
    setError("");
    setNiche("");
    setCity("");
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-2">
          <Wand2 className="w-3.5 h-3.5 text-[var(--accent)]" />
          New — Prospect sourcing
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Sources</h1>
        <p className="text-sm text-[var(--muted)]">
          Pull local businesses straight from Google Maps into a new prospect folder. Name, phone,
          address, and website included — no scraping extensions required.
        </p>
      </div>

      {/* Balance */}
      <div className="liquid-accent rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Balance</div>
            <div className="text-xl font-semibold text-[var(--foreground)]">
              {balance === null ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : (
                <>
                  {balance.toLocaleString()} <span className="text-xs text-[var(--muted)]">credits</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/billing"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1"
        >
          Top up <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {result ? (
        <div className="liquid-glass-strong rounded-2xl p-6 border border-emerald-500/20">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Imported {result.imported} prospect{result.imported === 1 ? "" : "s"}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-0.5">
                Saved to folder <span className="text-[var(--foreground)] font-medium">{result.folder.name}</span>.
                Spent {result.creditsSpent.toLocaleString()} credits.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden mb-5">
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {result.prospects.slice(0, 20).map((p) => (
                <div key={p.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[var(--foreground)] truncate">{p.name}</div>
                    {p.address && (
                      <div className="text-[11px] text-[var(--muted)] truncate">{p.address}</div>
                    )}
                  </div>
                  <div className="text-xs font-mono text-[var(--muted)] shrink-0">{p.phone}</div>
                </div>
              ))}
              {result.prospects.length > 20 && (
                <div className="px-4 py-2.5 text-xs text-[var(--muted)] text-center">
                  + {result.prospects.length - 20} more…
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/prospects")}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-2.5 shadow-lg shadow-[var(--accent)]/30 transition-all"
            >
              Open prospects <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] text-sm font-medium px-4 py-2.5 transition-colors"
            >
              Import another batch
            </button>
          </div>
        </div>
      ) : (
        <div className="liquid-glass-strong rounded-2xl p-6 space-y-5">
          {/* Niche */}
          <div>
            <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Niche
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                data-tour-id="sources-niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Plumbers, Roofers, HVAC contractors"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/20 border border-white/10 focus:border-[var(--accent)]/50 focus:outline-none text-sm transition-colors"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NICHE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setNiche(s)}
                  className="text-[11px] px-2 py-1 rounded-lg border border-white/10 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-white/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div data-tour-id="sources-location">
              <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                State
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none" />
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/20 border border-white/10 focus:border-[var(--accent)]/50 focus:outline-none text-sm transition-colors appearance-none"
                >
                  <option value="">Select a state…</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                City <span className="text-[var(--muted)] normal-case">(optional)</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Austin"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/20 border border-white/10 focus:border-[var(--accent)]/50 focus:outline-none text-sm transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Count */}
          <div data-tour-id="sources-count">
            <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              How many prospects
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COUNT_OPTIONS.map((n) => {
                const active = count === n;
                return (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--foreground)]"
                        : "border-white/10 bg-black/20 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-white/20"
                    }`}
                  >
                    <div className="text-base font-semibold">{n}</div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">
                      {(n * CREDITS_PER_PROSPECT).toLocaleString()} credits
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Where should they go
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDestination({ mode: "new" })}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  destination.mode === "new"
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--foreground)]"
                    : "border-white/10 bg-black/20 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FolderPlus className="w-4 h-4" />
                  New folder
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                  {niche.trim() && (state || city.trim())
                    ? `"${niche.trim()} — ${locationLabel || state}"`
                    : "Auto-named after your search"}
                </div>
              </button>
              <button
                onClick={() =>
                  setDestination(
                    folders.length > 0
                      ? { mode: "existing", folderId: folders[0].id }
                      : { mode: "new" },
                  )
                }
                disabled={folders.length === 0}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  destination.mode === "existing"
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--foreground)]"
                    : "border-white/10 bg-black/20 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-white/20"
                } ${folders.length === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Folder className="w-4 h-4" />
                  Existing folder
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                  {folders.length === 0
                    ? "You don't have any folders yet"
                    : `Pick from ${folders.length} folder${folders.length === 1 ? "" : "s"}`}
                </div>
              </button>
            </div>
            {destination.mode === "existing" && folders.length > 0 && (
              <div className="relative mt-2">
                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none" />
                <select
                  value={destination.folderId}
                  onChange={(e) => setDestination({ mode: "existing", folderId: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/20 border border-white/10 focus:border-[var(--accent)]/50 focus:outline-none text-sm transition-colors appearance-none"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cost summary */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <div className="text-sm text-[var(--foreground)]">
                  Max cost: <span className="font-semibold">{maxCost.toLocaleString()} credits</span>
                  <span className="text-[var(--muted)]"> (~${maxCostUsd})</span>
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">
                  You&apos;re only charged for prospects that come back with a phone number.
                </div>
              </div>
            </div>
          </div>

          {/* Compliance note */}
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 flex items-start gap-2.5 text-[11px] text-yellow-200/80 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
            <span>
              You&apos;re responsible for confirming you have consent to contact every prospect, and for
              scrubbing against the Do Not Call registry where required. NextNote provides data — you
              operate it lawfully.
            </span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={loading || !niche.trim() || !state}
            data-tour-id="sources-import"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-3 shadow-lg shadow-[var(--accent)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Pulling prospects… (up to 60s)
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Import {count} prospects — {maxCost.toLocaleString()} credits
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          {!canAfford && balance !== null && (
            <p className="text-center text-[11px] text-[var(--muted)]">
              You&apos;re short {(maxCost - balance).toLocaleString()} credits — we&apos;ll offer a top-up when
              you click import.
            </p>
          )}
        </div>
      )}

      <InsufficientCreditsModal
        open={creditsPaywall !== null}
        onClose={() => setCreditsPaywall(null)}
        required={creditsPaywall?.required ?? 0}
        balance={creditsPaywall?.balance ?? 0}
        action="Importing prospects"
      />
    </div>
  );
}
