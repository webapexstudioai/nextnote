"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Globe2, Loader2, Copy, Check, ExternalLink, AlertCircle, Trash2, RefreshCw, Sparkles, Search, ShoppingCart,
} from "lucide-react";

type DnsRow = { type: "A" | "CNAME"; host: string; value: string; ttl: number };
type Verification = { type: string; host: string; value: string; reason?: string };

type DomainState = {
  domain: string | null;
  status: "pending" | "verified" | "error" | null;
  attachedAt: string | null;
  error: string | null;
  isApex?: boolean;
  misconfigured?: boolean;
  dns: DnsRow[];
  verification: Verification[];
};

type DomainSearchResult = {
  name: string;
  available: boolean;
  retailPriceCents: number;
  wholesalePriceCents: number | null;
  premium: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  siteId: string;
  defaultSearchTerm?: string | null;
  onAttachedDomainChange?: (domain: string | null) => void;
}

const POLL_MS = 8000;

export default function CustomDomainModal({ open, onClose, siteId, defaultSearchTerm, onAttachedDomainChange }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"attach" | "verify" | "detach" | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<DomainState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [tab, setTab] = useState<"buy" | "connect">("buy");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<DomainSearchResult[] | null>(null);
  const [searchRetailCents, setSearchRetailCents] = useState(1999);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const autoSearchedRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Pre-fill the search box from the company name and immediately fire off a
  // search so the user lands on a list of available domains without having
  // to type anything. We only auto-search once per modal open — if they
  // change the term and re-open, that's an intentional new search.
  useEffect(() => {
    if (!open) {
      autoSearchedRef.current = false;
      return;
    }
    if (!defaultSearchTerm) return;
    if (autoSearchedRef.current) return;
    autoSearchedRef.current = true;
    const seed = defaultSearchTerm.trim();
    if (!seed) return;
    setSearchTerm(seed);
    void doSearch(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultSearchTerm]);

  // Initial load + poll while pending
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/websites/${siteId}/domain`, { cache: "no-store" });
        const json = (await res.json()) as DomainState;
        if (!active) return;
        setState(json);
        setLoading(false);
      } catch {
        if (!active) return;
        setError("Couldn't load domain status");
        setLoading(false);
      }
    };
    load();
    const id = setInterval(() => {
      if (state?.status === "pending") load();
    }, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [open, siteId, state?.status]);

  if (!open || !mounted) return null;

  const attach = async () => {
    setError("");
    setBusy("attach");
    try {
      const res = await fetch(`/api/websites/${siteId}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: input.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Couldn't attach domain");
        return;
      }
      setState(json);
      setInput("");
      onAttachedDomainChange?.(json.domain);
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setError("");
    setBusy("verify");
    try {
      const res = await fetch(`/api/websites/${siteId}/domain`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Verification check failed");
        return;
      }
      setState((prev) => prev ? { ...prev, ...json } : json);
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  };

  const detach = async () => {
    if (!confirm("Detach this domain? Your site will stop serving on it.")) return;
    setError("");
    setBusy("detach");
    try {
      const res = await fetch(`/api/websites/${siteId}/domain`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Couldn't detach");
        return;
      }
      setState({
        domain: null, status: null, attachedAt: null, error: null, dns: [], verification: [],
      });
      onAttachedDomainChange?.(null);
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  };

  const doSearch = async (q: string) => {
    if (!q || searching) return;
    setError("");
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch("/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Couldn't search domains");
        return;
      }
      setSearchResults(json.results || []);
      if (typeof json.retailPriceCents === "number") {
        setSearchRetailCents(json.retailPriceCents);
      }
    } catch {
      setError("Network error");
    } finally {
      setSearching(false);
    }
  };

  const runSearch = () => doSearch(searchTerm.trim());

  const buy = async (domain: string) => {
    if (buying) return;
    setError("");
    setBuying(domain);
    try {
      const res = await fetch("/api/domains/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, domain }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Couldn't start checkout");
        setBuying(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error");
      setBuying(null);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1400);
    } catch {
      // ignore
    }
  };

  const empty = !state?.domain;
  const pending = state?.status === "pending";
  const verified = state?.status === "verified";

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
        <div className="relative w-full max-w-xl liquid-glass-strong rounded-3xl overflow-hidden my-auto shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 pb-5">
            <div className="flex items-start gap-3 mb-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
                <Globe2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold tracking-tight">
                  {empty ? "Get a domain" : "Your domain"}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {empty
                    ? "Buy one through us, or connect a domain you already own."
                    : <>Serving on <span className="font-mono text-[var(--foreground)]/80">{state?.domain}</span></>}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
              </div>
            ) : verified ? (
              <VerifiedState
                state={state!}
                detaching={busy === "detach"}
                detach={detach}
              />
            ) : pending ? (
              <PendingState
                state={state!}
                copy={copy}
                copied={copied}
                verifying={busy === "verify"}
                verify={verify}
                detaching={busy === "detach"}
                detach={detach}
              />
            ) : (
              <>
                <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    onClick={() => setTab("buy")}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      tab === "buy"
                        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Buy a domain
                  </button>
                  <button
                    onClick={() => setTab("connect")}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      tab === "connect"
                        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Globe2 className="w-3.5 h-3.5" /> Connect one I own
                  </button>
                </div>

                {tab === "buy" ? (
                  <BuyTab
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    searching={searching}
                    runSearch={runSearch}
                    results={searchResults}
                    retailCents={searchRetailCents}
                    buy={buy}
                    buying={buying}
                  />
                ) : (
                  <EmptyState
                    input={input}
                    setInput={setInput}
                    attaching={busy === "attach"}
                    attach={attach}
                  />
                )}
              </>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> HTTPS issued automatically
            </span>
            <button onClick={onClose} className="hover:text-[var(--foreground)] transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function BuyTab({
  searchTerm, setSearchTerm, searching, runSearch, results, retailCents, buy, buying,
}: {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  searching: boolean;
  runSearch: () => void;
  results: DomainSearchResult[] | null;
  retailCents: number;
  buy: (domain: string) => void;
  buying: string | null;
}) {
  const sorted = results
    ? [...results].sort((a, b) => {
        const aRank = a.available && !a.premium ? 0 : a.premium ? 1 : 2;
        const bRank = b.available && !b.premium ? 0 : b.premium ? 1 : 2;
        return aRank - bRank;
      })
    : null;

  return (
    <div>
      <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Search domain names</label>
      <div className="flex gap-2">
        <input
          type="text"
          autoFocus
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && searchTerm.trim()) runSearch(); }}
          placeholder="mybiz"
          disabled={searching}
          className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-60"
        />
        <button
          onClick={runSearch}
          disabled={searching || !searchTerm.trim()}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        We&apos;ll check .com, .net, .org, .co, .io, and .biz. {formatPrice(retailCents)} / year, registered and attached automatically.
      </p>

      {sorted && (
        <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
          {sorted.length === 0 ? (
            <div className="px-4 py-6 text-xs text-[var(--muted)] text-center">No results — try a different name.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {sorted.map((r) => {
                const buyable = r.available && !r.premium;
                const isBuying = buying === r.name;
                return (
                  <div key={r.name} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex flex-col min-w-0">
                      <div className="font-mono text-sm text-[var(--foreground)] truncate">{r.name}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {buyable
                          ? `${formatPrice(retailCents)} / year`
                          : r.premium
                            ? "Premium — not available at standard price"
                            : "Already taken"}
                      </div>
                    </div>
                    {buyable ? (
                      <button
                        onClick={() => buy(r.name)}
                        disabled={!!buying}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors shrink-0 disabled:opacity-60 inline-flex items-center gap-1.5"
                      >
                        {isBuying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                        {isBuying ? "Opening…" : `Buy ${formatPrice(retailCents)}`}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[var(--muted)] shrink-0">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ input, setInput, attaching, attach }: {
  input: string; setInput: (v: string) => void; attaching: boolean; attach: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Domain</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) attach(); }}
          placeholder="go.mybiz.com"
          disabled={attaching}
          className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-60"
        />
        <button
          onClick={attach}
          disabled={attaching || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />}
          Connect
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Use a domain you already own. We&apos;ll show you the one DNS record to add at your registrar — or use a subdomain you control.
      </p>
    </div>
  );
}

function PendingState({
  state, copy, copied, verifying, verify, detaching, detach,
}: {
  state: DomainState;
  copy: (key: string, value: string) => void;
  copied: string | null;
  verifying: boolean;
  verify: () => void;
  detaching: boolean;
  detach: () => void;
}) {
  return (
    <div>
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 mb-4">
        <div className="flex items-start gap-3">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-200">Awaiting DNS</div>
            <div className="text-xs text-amber-200/70 mt-0.5">
              Add the record below at your registrar. We check every {Math.round(POLL_MS / 1000)} seconds.
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-[var(--muted)] mb-2">
        Domain: <span className="font-mono text-[var(--foreground)]">{state.domain}</span>
      </div>

      <div className="rounded-2xl border border-white/10 overflow-hidden mb-4">
        <div className="grid grid-cols-[auto_1fr_2fr_auto] text-[10px] uppercase tracking-wider text-[var(--muted)] bg-white/3 border-b border-white/5">
          <div className="px-3 py-2">Type</div>
          <div className="px-3 py-2">Host</div>
          <div className="px-3 py-2">Value</div>
          <div className="px-3 py-2 text-right">TTL</div>
        </div>
        {state.dns.map((row, i) => (
          <DnsRowDisplay
            key={`dns-${i}`}
            row={row}
            copy={copy}
            copied={copied}
            keyPrefix={`dns-${i}`}
          />
        ))}
        {state.verification.map((v, i) => (
          <DnsRowDisplay
            key={`v-${i}`}
            row={{ type: v.type as "A" | "CNAME", host: v.host, value: v.value, ttl: 60 }}
            copy={copy}
            copied={copied}
            keyPrefix={`v-${i}`}
            note={v.reason || "Ownership verification"}
          />
        ))}
      </div>

      {state.misconfigured && (
        <div className="text-[11px] text-amber-400/80 mb-3">
          Vercel still sees the old DNS. Propagation can take up to a few minutes.
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={detach}
          disabled={detaching || verifying}
          className="text-xs text-[var(--muted)] hover:text-red-400 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {detaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Detach
        </button>
        <button
          onClick={verify}
          disabled={verifying || detaching}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Verify now
        </button>
      </div>
    </div>
  );
}

function DnsRowDisplay({
  row, copy, copied, keyPrefix, note,
}: {
  row: DnsRow;
  copy: (key: string, value: string) => void;
  copied: string | null;
  keyPrefix: string;
  note?: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_2fr_auto] items-center text-xs">
        <div className="px-3 py-2 font-mono font-semibold text-[var(--accent)]">{row.type}</div>
        <CopyCell label={row.host} onClick={() => copy(`${keyPrefix}-host`, row.host)} copied={copied === `${keyPrefix}-host`} />
        <CopyCell label={row.value} onClick={() => copy(`${keyPrefix}-value`, row.value)} copied={copied === `${keyPrefix}-value`} />
        <div className="px-3 py-2 text-right text-[var(--muted)] font-mono">{row.ttl}</div>
      </div>
      {note && <div className="px-3 pb-2 text-[10px] text-[var(--muted)]">{note}</div>}
    </div>
  );
}

function CopyCell({ label, onClick, copied }: { label: string; onClick: () => void; copied: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 font-mono text-left hover:bg-white/5 transition-colors flex items-center gap-1.5 group min-w-0"
      title="Click to copy"
    >
      <span className="truncate">{label}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}

function VerifiedState({ state, detaching, detach }: {
  state: DomainState; detaching: boolean; detach: () => void;
}) {
  return (
    <div>
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Check className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-200">Live</div>
            <div className="text-xs text-emerald-200/70 mt-0.5">
              Visitors can now reach your site at this domain over HTTPS.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Domain</div>
          <div className="font-mono text-sm truncate">{state.domain}</div>
        </div>
        <a
          href={`https://${state.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Visit
        </a>
      </div>

      <div className="flex justify-end">
        <button
          onClick={detach}
          disabled={detaching}
          className="text-xs text-[var(--muted)] hover:text-red-400 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {detaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Detach domain
        </button>
      </div>
    </div>
  );
}
