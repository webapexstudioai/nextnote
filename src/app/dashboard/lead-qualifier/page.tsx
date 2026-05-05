"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  RefreshCcw,
  Flame,
  Snowflake,
  Wind,
  HelpCircle,
  Phone,
  Globe,
  AlertCircle,
  Search,
  Coins,
  Play,
  ExternalLink,
} from "lucide-react";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";

const LEAD_AUDIT_CREDITS = 50;

type AuditStatus = "pending" | "complete" | "failed";
type Confidence = "low" | "medium" | "high";

interface AuditSummary {
  id: string;
  status: AuditStatus;
  overall_score: number | null;
  ai_receptionist_score: number | null;
  website_score: number | null;
  confidence: Confidence | null;
  summary: string;
  top_hook: string | null;
  completed_at: string | null;
  expires_at: string | null;
  error_message: string | null;
}

interface QualifierItem {
  prospect_id: string;
  prospect_name: string;
  prospect_phone: string | null;
  prospect_email: string | null;
  prospect_website: string | null;
  prospect_service: string | null;
  prospect_status: string;
  audit: AuditSummary | null;
}

type Band = "hot" | "warm" | "cold" | "unaudited";
type SortKey = "score" | "name" | "audited";

function bandFor(item: QualifierItem): Band {
  const s = item.audit?.overall_score;
  if (item.audit?.status !== "complete" || s === null || s === undefined) return "unaudited";
  if (s >= 70) return "hot";
  if (s >= 40) return "warm";
  return "cold";
}

const bandStyle: Record<Band, { label: string; cls: string; ring: string; iconCls: string; Icon: typeof Flame }> = {
  hot:       { label: "Hot",       cls: "text-emerald-300", ring: "border-emerald-500/30 bg-emerald-500/8",  iconCls: "text-emerald-400", Icon: Flame },
  warm:      { label: "Warm",      cls: "text-amber-300",   ring: "border-amber-500/30 bg-amber-500/8",      iconCls: "text-amber-400",   Icon: Wind },
  cold:      { label: "Cold",      cls: "text-sky-300",     ring: "border-sky-500/25 bg-sky-500/8",          iconCls: "text-sky-400",     Icon: Snowflake },
  unaudited: { label: "Unaudited", cls: "text-zinc-400",    ring: "border-[var(--border)] bg-[var(--background)]/40", iconCls: "text-zinc-500",    Icon: HelpCircle },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface CreditsBalance {
  balance: number;
}

export default function LeadQualifierPage() {
  const [items, setItems] = useState<QualifierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Band | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [search, setSearch] = useState("");

  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [paywall, setPaywall] = useState<{ required: number; balance: number } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/leads/audits");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance");
      if (!res.ok) return;
      const data = (await res.json()) as CreditsBalance;
      setCreditsBalance(data.balance);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    loadCredits();
  }, [load, loadCredits]);

  const runOne = useCallback(
    async (prospectId: string, force = false): Promise<boolean> => {
      setRunningIds((prev) => new Set(prev).add(prospectId));
      try {
        const res = await fetch("/api/leads/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospect_id: prospectId, force }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 402 && typeof data?.required === "number" && typeof data?.balance === "number") {
            setPaywall({ required: data.required, balance: data.balance });
            return false;
          }
          setItems((curr) =>
            curr.map((it) =>
              it.prospect_id !== prospectId
                ? it
                : {
                    ...it,
                    audit: {
                      ...(it.audit ?? {
                        id: "tmp",
                        status: "failed",
                        overall_score: null,
                        ai_receptionist_score: null,
                        website_score: null,
                        confidence: null,
                        summary: "",
                        top_hook: null,
                        completed_at: null,
                        expires_at: null,
                        error_message: null,
                      }),
                      status: "failed",
                      error_message: data?.error ?? "Audit failed",
                    },
                  },
            ),
          );
          return false;
        }
        const a = data.audit;
        setItems((curr) =>
          curr.map((it) =>
            it.prospect_id !== prospectId
              ? it
              : {
                  ...it,
                  audit: {
                    id: a.id,
                    status: a.status,
                    overall_score: a.overall_score,
                    ai_receptionist_score: a.ai_receptionist_score,
                    website_score: a.website_score,
                    confidence: a.confidence,
                    summary: a.summary ?? "",
                    top_hook: Array.isArray(a.pitch_hooks) && a.pitch_hooks[0]?.hook ? a.pitch_hooks[0].hook : null,
                    completed_at: a.completed_at,
                    expires_at: a.expires_at,
                    error_message: a.error_message,
                  },
                },
          ),
        );
        loadCredits();
        return true;
      } catch (err) {
        console.error(err);
        return false;
      } finally {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(prospectId);
          return next;
        });
      }
    },
    [loadCredits],
  );

  async function bulkRun() {
    const targets = items.filter((it) => bandFor(it) === "unaudited" && (it.prospect_phone || it.prospect_website));
    if (targets.length === 0) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const ok = await runOne(targets[i].prospect_id);
      if (!ok) failed += 1;
      setBulkProgress({ done: i + 1, total: targets.length, failed });
      if (creditsBalance !== null && creditsBalance - (i + 1) * LEAD_AUDIT_CREDITS < LEAD_AUDIT_CREDITS) break;
    }
    setBulkRunning(false);
  }

  const stats = useMemo(() => {
    let hot = 0, warm = 0, cold = 0, unaudited = 0;
    for (const it of items) {
      const b = bandFor(it);
      if (b === "hot") hot += 1;
      else if (b === "warm") warm += 1;
      else if (b === "cold") cold += 1;
      else unaudited += 1;
    }
    return { hot, warm, cold, unaudited, total: items.length };
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items;
    if (filter !== "all") out = out.filter((it) => bandFor(it) === filter);
    if (q) {
      out = out.filter(
        (it) =>
          it.prospect_name.toLowerCase().includes(q) ||
          (it.prospect_service ?? "").toLowerCase().includes(q) ||
          (it.audit?.summary ?? "").toLowerCase().includes(q) ||
          (it.audit?.top_hook ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...out].sort((a, b) => {
      if (sortKey === "name") return a.prospect_name.localeCompare(b.prospect_name);
      if (sortKey === "audited") {
        const ai = a.audit?.completed_at ? new Date(a.audit.completed_at).getTime() : 0;
        const bi = b.audit?.completed_at ? new Date(b.audit.completed_at).getTime() : 0;
        return bi - ai;
      }
      // score: complete audits first (highest score), then unaudited
      const av = a.audit?.status === "complete" ? a.audit.overall_score ?? -1 : -2;
      const bv = b.audit?.status === "complete" ? b.audit.overall_score ?? -1 : -2;
      return bv - av;
    });
    return sorted;
  }, [items, filter, sortKey, search]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[var(--accent)]" /> Lead Qualifier
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
            Score every prospect on AI receptionist + website fit. We pull reviews and run a Lighthouse audit, then synthesize a fit score and a pitch hook you can use today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {creditsBalance !== null && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs">
              <Coins className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="font-medium">{creditsBalance.toLocaleString()}</span>
              <span className="text-[var(--muted)]">credits</span>
            </div>
          )}
          <button
            onClick={() => { setLoading(true); load(); }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--card-hover)] text-xs transition-colors"
            title="Refresh"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={bulkRun}
            disabled={bulkRunning || stats.unaudited === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {bulkRunning
              ? `Running ${bulkProgress.done}/${bulkProgress.total}`
              : `Audit ${stats.unaudited} unaudited (${LEAD_AUDIT_CREDITS}cr each)`}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Stat cards / filters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {([
          { key: "all" as const, label: "All", count: stats.total, ring: "border-[var(--border)] bg-[var(--card)]", cls: "text-[var(--foreground)]", Icon: Sparkles, iconCls: "text-[var(--accent)]" },
          { key: "hot" as const, label: "Hot", count: stats.hot, ring: bandStyle.hot.ring, cls: bandStyle.hot.cls, Icon: bandStyle.hot.Icon, iconCls: bandStyle.hot.iconCls },
          { key: "warm" as const, label: "Warm", count: stats.warm, ring: bandStyle.warm.ring, cls: bandStyle.warm.cls, Icon: bandStyle.warm.Icon, iconCls: bandStyle.warm.iconCls },
          { key: "cold" as const, label: "Cold", count: stats.cold, ring: bandStyle.cold.ring, cls: bandStyle.cold.cls, Icon: bandStyle.cold.Icon, iconCls: bandStyle.cold.iconCls },
          { key: "unaudited" as const, label: "Unaudited", count: stats.unaudited, ring: bandStyle.unaudited.ring, cls: bandStyle.unaudited.cls, Icon: bandStyle.unaudited.Icon, iconCls: bandStyle.unaudited.iconCls },
        ]).map((s) => {
          const active = filter === s.key;
          const Icon = s.Icon;
          return (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`text-left rounded-xl border px-3 py-3 transition-all ${s.ring} ${active ? "ring-2 ring-[var(--accent)]" : "hover:ring-1 hover:ring-[var(--border)]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{s.label}</span>
                <Icon className={`w-3.5 h-3.5 ${s.iconCls}`} />
              </div>
              <div className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.count}</div>
            </button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, service, summary, or pitch hook"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--background)] border border-[var(--border)] rounded-xl p-1">
          {([
            { key: "score" as const, label: "Score" },
            { key: "name" as const, label: "Name" },
            { key: "audited" as const, label: "Audited" },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortKey === s.key ? "bg-[var(--card)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
          <Sparkles className="w-10 h-10 text-[var(--accent)] mx-auto mb-3" />
          <p className="text-sm font-medium">
            {items.length === 0 ? "No prospects yet" : "Nothing matches that filter"}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {items.length === 0
              ? "Add prospects from the Sources page, then come back to qualify them."
              : "Try clearing search or switching the filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((it) => {
            const band = bandFor(it);
            const style = bandStyle[band];
            const BandIcon = style.Icon;
            const score = it.audit?.overall_score;
            const isRunning = runningIds.has(it.prospect_id);
            const canAudit = !!(it.prospect_phone || it.prospect_website);
            return (
              <div
                key={it.prospect_id}
                className={`rounded-2xl border p-4 hover:bg-[var(--card)]/40 transition-colors ${style.ring}`}
              >
                <div className="flex items-start gap-4">
                  {/* Score block */}
                  <div className="w-16 shrink-0 flex flex-col items-center">
                    {it.audit?.status === "complete" && score !== null && score !== undefined ? (
                      <>
                        <div className="relative h-14 w-14">
                          <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
                            <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="none" />
                            <circle
                              cx="28"
                              cy="28"
                              r="22"
                              stroke={band === "hot" ? "#34d399" : band === "warm" ? "#fbbf24" : "#60a5fa"}
                              strokeWidth="5"
                              fill="none"
                              strokeDasharray={`${(score / 100) * 2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-base font-semibold text-[var(--foreground)]">
                            {score}
                          </div>
                        </div>
                        <span className={`text-[10px] mt-1 inline-flex items-center gap-1 ${style.cls}`}>
                          <BandIcon className="w-3 h-3" />
                          {style.label}
                        </span>
                      </>
                    ) : (
                      <div className="h-14 w-14 rounded-full border border-dashed border-[var(--border)] flex items-center justify-center">
                        <BandIcon className={`w-5 h-5 ${style.iconCls}`} />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/prospects?prospect=${it.prospect_id}`}
                          className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1"
                        >
                          {it.prospect_name}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--muted)] flex-wrap">
                          {it.prospect_service && <span>{it.prospect_service}</span>}
                          {it.prospect_phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {it.prospect_phone}
                            </span>
                          )}
                          {it.prospect_website && (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              <a
                                href={it.prospect_website.startsWith("http") ? it.prospect_website : `https://${it.prospect_website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[var(--accent)] truncate max-w-[180px]"
                              >
                                {it.prospect_website.replace(/^https?:\/\//, "")}
                              </a>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[10px]">
                            {it.prospect_status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {it.audit?.status === "complete" && (
                          <span className="text-[10px] text-[var(--muted)]">
                            Audited {formatRelative(it.audit.completed_at)}
                          </span>
                        )}
                        <button
                          onClick={() => runOne(it.prospect_id, it.audit?.status === "complete")}
                          disabled={isRunning || bulkRunning || !canAudit}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-medium hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title={canAudit ? "" : "Add a phone or website first"}
                        >
                          {isRunning ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCcw className="w-3 h-3" />
                          )}
                          {it.audit?.status === "complete" ? "Re-run" : "Audit"}
                        </button>
                      </div>
                    </div>

                    {it.audit?.status === "complete" && (
                      <>
                        {it.audit.summary && (
                          <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed line-clamp-2">{it.audit.summary}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {it.audit.ai_receptionist_score !== null && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)]">
                              AI receptionist <strong className="text-[var(--foreground)]">{it.audit.ai_receptionist_score}</strong>
                            </span>
                          )}
                          {it.audit.website_score !== null && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)]">
                              Website <strong className="text-[var(--foreground)]">{it.audit.website_score}</strong>
                            </span>
                          )}
                          {it.audit.confidence && (
                            <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
                              {it.audit.confidence} confidence
                            </span>
                          )}
                        </div>
                        {it.audit.top_hook && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-[rgba(232,85,61,0.06)] border border-[rgba(232,85,61,0.18)]">
                            <div className="text-[9px] uppercase tracking-wider text-[var(--accent)] font-semibold mb-0.5">Top pitch hook</div>
                            <p className="text-xs text-[var(--foreground)] leading-relaxed">{it.audit.top_hook}</p>
                          </div>
                        )}
                      </>
                    )}

                    {it.audit?.status === "failed" && it.audit.error_message && (
                      <p className="text-[11px] text-rose-400 mt-2 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {it.audit.error_message}
                      </p>
                    )}

                    {!it.audit && !canAudit && (
                      <p className="text-[11px] text-[var(--muted)] mt-2">
                        Add a phone or website to this prospect to enable auditing.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paywall && (
        <InsufficientCreditsModal
          open
          onClose={() => setPaywall(null)}
          required={paywall.required}
          balance={paywall.balance}
          action="Running a Lead Qualifier audit"
        />
      )}
    </div>
  );
}
