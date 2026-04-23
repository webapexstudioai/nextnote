"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Zap, TrendingUp, AlertTriangle, Star, Target, DollarSign,
  Timer, RefreshCw, Wand2, Loader2, ArrowRight, Clock, Trophy,
} from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import type { Prospect, ProspectStatus } from "@/types";

const STAGES: ProspectStatus[] = ["New", "Contacted", "Qualified", "Booked", "Closed"];
const MILESTONE_GROWTH = 5;

function stageProgress(count: number) {
  if (count <= 0) return { tier: 0, pct: 0, prev: 0, next: 1 };
  let tier = 0;
  let prev = 0;
  let next = 1;
  while (count >= next) {
    tier++;
    prev = next;
    next *= MILESTONE_GROWTH;
  }
  const pct = ((count - prev) / (next - prev)) * 100;
  return { tier, pct, prev, next };
}
const STAGE_COLORS: Record<ProspectStatus, string> = {
  New: "bg-blue-500",
  Contacted: "bg-amber-500",
  Qualified: "bg-purple-500",
  Booked: "bg-emerald-500",
  Closed: "bg-rose-500",
};
const STAGE_TEXT: Record<ProspectStatus, string> = {
  New: "text-blue-400",
  Contacted: "text-amber-400",
  Qualified: "text-purple-400",
  Booked: "text-emerald-400",
  Closed: "text-rose-400",
};

const CACHE_KEY = "nextnote_ai_insights_cache_v1";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

interface StageStat { count: number; avgDaysInStage: number; revenue: number; }
interface Digest {
  totals: {
    prospects: number;
    closedThisWeek: number;
    closedLastWeek: number;
    revenueThisWeek: number;
    revenueLastWeek: number;
    revenueAllTime: number;
    bookingsThisWeek: number;
  };
  stages: Record<ProspectStatus, StageStat>;
  topServices: Array<{ service: string; count: number }>;
  stuck: Array<{ id: string; name: string; stage: string; daysSinceCreated: number; dealValue?: number; service?: string }>;
  recentWins: Array<{ name: string; dealValue?: number; closedAt?: string }>;
}
interface ActionItem {
  prospectId: string;
  prospectName: string;
  action: string;
  reason: string;
  priority: "high" | "med" | "low";
}
interface AIResponse {
  narrative: string;
  actions: ActionItem[];
  generatedAt: string;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function computeDigest(prospects: Prospect[]): Digest {
  const now = new Date();
  const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 7);
  const fourteenAgo = new Date(now); fourteenAgo.setDate(now.getDate() - 14);

  const closedThisWeek = prospects.filter((p) => p.closedAt && new Date(p.closedAt) >= sevenAgo);
  const closedLastWeek = prospects.filter((p) => p.closedAt && new Date(p.closedAt) >= fourteenAgo && new Date(p.closedAt) < sevenAgo);
  const bookingsThisWeek = prospects.filter((p) =>
    p.appointments.some((a) => new Date(a.createdAt) >= sevenAgo)
  ).length;

  const stages = Object.fromEntries(
    STAGES.map((s) => {
      const inStage = prospects.filter((p) => p.status === s);
      const avgDaysInStage =
        inStage.length > 0
          ? inStage.reduce((sum, p) => sum + daysBetween(new Date(p.createdAt), now), 0) / inStage.length
          : 0;
      const revenue = inStage.reduce((sum, p) => sum + (p.dealValue || 0), 0);
      return [s, { count: inStage.length, avgDaysInStage: Math.round(avgDaysInStage * 10) / 10, revenue }];
    })
  ) as Record<ProspectStatus, StageStat>;

  const serviceCount: Record<string, number> = {};
  prospects.forEach((p) => {
    if (p.service) serviceCount[p.service] = (serviceCount[p.service] || 0) + 1;
  });
  const topServices = Object.entries(serviceCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([service, count]) => ({ service, count }));

  const stuck = prospects
    .filter((p) => p.status !== "Closed")
    .map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.status,
      daysSinceCreated: daysBetween(new Date(p.createdAt), now),
      dealValue: p.dealValue,
      service: p.service,
    }))
    .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated)
    .slice(0, 10);

  const recentWins = [...closedThisWeek, ...closedLastWeek]
    .sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime())
    .slice(0, 5)
    .map((p) => ({ name: p.name, dealValue: p.dealValue, closedAt: p.closedAt }));

  return {
    totals: {
      prospects: prospects.length,
      closedThisWeek: closedThisWeek.length,
      closedLastWeek: closedLastWeek.length,
      revenueThisWeek: closedThisWeek.reduce((s, p) => s + (p.dealValue || 0), 0),
      revenueLastWeek: closedLastWeek.reduce((s, p) => s + (p.dealValue || 0), 0),
      revenueAllTime: prospects.filter((p) => p.status === "Closed").reduce((s, p) => s + (p.dealValue || 0), 0),
      bookingsThisWeek,
    },
    stages,
    topServices,
    stuck,
    recentWins,
  };
}

function digestHash(d: Digest): string {
  return `${d.totals.prospects}-${d.totals.revenueAllTime}-${d.totals.closedThisWeek}-${d.stuck.length}`;
}

function formatMoney(cents: number): string {
  return `$${Math.round(cents).toLocaleString()}`;
}

function priorityStyle(p: "high" | "med" | "low"): string {
  if (p === "high") return "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30";
  if (p === "med") return "bg-amber-500/10 text-amber-400 border-amber-500/25";
  return "bg-white/5 text-[var(--muted)] border-white/10";
}

export default function AIInsightsPage() {
  const { prospects } = useProspects();
  const digest = useMemo(() => computeDigest(prospects), [prospects]);

  const [ai, setAi] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadAi = useCallback(async (force = false) => {
    const hash = digestHash(digest);
    if (!force) {
      try {
        const cached = window.localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as AIResponse & { _hash: string; _cachedAt: number };
          const fresh = Date.now() - parsed._cachedAt < CACHE_TTL_MS && parsed._hash === hash;
          if (fresh) {
            setAi(parsed);
            return;
          }
        }
      } catch {}
    }

    if (digest.totals.prospects === 0) return;

    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai-insights/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate insights");
      const payload: AIResponse = { narrative: data.narrative, actions: data.actions, generatedAt: data.generatedAt };
      setAi(payload);
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, _hash: hash, _cachedAt: Date.now() }));
      } catch {}
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [digest]);

  useEffect(() => { loadAi(false); }, [loadAi]);

  // Find bottleneck — open stage with highest avg days (excluding Closed/New)
  const bottleneck = useMemo(() => {
    const candidates = (["Contacted", "Qualified", "Booked"] as ProspectStatus[])
      .filter((s) => digest.stages[s].count > 0)
      .sort((a, b) => digest.stages[b].avgDaysInStage - digest.stages[a].avgDaysInStage);
    return candidates[0] ?? null;
  }, [digest]);

  // KPI deltas
  const revenueDelta = digest.totals.revenueLastWeek > 0
    ? Math.round(((digest.totals.revenueThisWeek - digest.totals.revenueLastWeek) / digest.totals.revenueLastWeek) * 100)
    : null;

  const conversionRate = digest.totals.prospects > 0
    ? ((digest.stages.Closed.count / digest.totals.prospects) * 100).toFixed(1)
    : "0";
  const bookingRate = digest.totals.prospects > 0
    ? ((digest.stages.Booked.count / digest.totals.prospects) * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--accent)]" /> AI Insights
            </h1>
            <p className="text-xs text-[var(--muted)]">Workflow analysis and next-best-actions for your pipeline</p>
          </div>
          <button
            onClick={() => loadAi(true)}
            disabled={aiLoading || digest.totals.prospects === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.04] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Generating…" : "Refresh insights"}
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ── AI Narrative Hero ── */}
        <div className="liquid-accent rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[var(--accent)]/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">This week's read</h2>
                  {ai && (
                    <span className="text-[10px] text-[var(--muted)]">
                      · updated {new Date(ai.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {digest.totals.prospects === 0 ? (
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Add some prospects and your first AI-generated workflow summary will appear here.
              </p>
            ) : aiLoading && !ai ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing your pipeline…
              </div>
            ) : aiError ? (
              <div className="text-sm text-amber-400">{aiError}</div>
            ) : ai ? (
              <p className="text-base leading-relaxed text-[var(--foreground)]">{ai.narrative}</p>
            ) : (
              <p className="text-sm text-[var(--muted)]">Click Refresh to generate your weekly read.</p>
            )}
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Revenue · 7d</span>
            </div>
            <p className="text-2xl font-bold">{formatMoney(digest.totals.revenueThisWeek)}</p>
            <p className="text-[11px] mt-1 flex items-center gap-1">
              {revenueDelta === null ? (
                <span className="text-[var(--muted)]">No prior week data</span>
              ) : revenueDelta >= 0 ? (
                <span className="text-emerald-400">▲ {revenueDelta}% vs last week</span>
              ) : (
                <span className="text-rose-400">▼ {Math.abs(revenueDelta)}% vs last week</span>
              )}
            </p>
          </div>
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Conversion</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{conversionRate}%</p>
            <p className="text-[11px] text-[var(--muted)] mt-1">{digest.stages.Closed.count} of {digest.totals.prospects} closed</p>
          </div>
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Booking Rate</span>
            </div>
            <p className="text-2xl font-bold text-[var(--accent)]">{bookingRate}%</p>
            <p className="text-[11px] text-[var(--muted)] mt-1">{digest.totals.bookingsThisWeek} booked this week</p>
          </div>
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Bottleneck</span>
            </div>
            {bottleneck ? (
              <>
                <p className={`text-2xl font-bold ${STAGE_TEXT[bottleneck]}`}>{bottleneck}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">avg {digest.stages[bottleneck].avgDaysInStage}d in stage</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-[var(--muted)]">—</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">No open stages to analyze</p>
              </>
            )}
          </div>
        </div>

        {/* ── Velocity + Revenue Funnel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Velocity */}
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--accent)]" /> Stage Velocity
              </h3>
              <span className="text-[10px] text-[var(--muted)]">avg days a lead sits</span>
            </div>
            <div className="space-y-2.5">
              {STAGES.map((s) => {
                const stat = digest.stages[s];
                const isLeak = bottleneck === s;
                return (
                  <div key={s} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isLeak ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.06]" : "border-transparent bg-white/[0.02]"
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${STAGE_COLORS[s]}`} />
                    <span className="text-sm font-medium w-24">{s}</span>
                    <span className="text-xs text-[var(--muted)] flex-1">{stat.count} lead{stat.count !== 1 ? "s" : ""}</span>
                    <span className={`text-sm font-mono ${isLeak ? "text-[var(--accent)] font-semibold" : "text-[var(--muted)]"}`}>
                      {stat.avgDaysInStage}d
                    </span>
                    {isLeak && (
                      <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">Leak</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Milestone progress */}
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" /> Pipeline Milestones
              </h3>
              <span className="text-[10px] text-[var(--muted)]">level up each stage</span>
            </div>
            <div className="space-y-3">
              {STAGES.map((s) => {
                const count = digest.stages[s].count;
                const { tier, pct, next } = stageProgress(count);
                const isClosed = s === "Closed";
                const cash = isClosed ? digest.stages.Closed.revenue : 0;
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-semibold ${STAGE_TEXT[s]}`}>{s}</span>
                        {tier > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STAGE_COLORS[s]} text-white shrink-0`}>
                            Tier {tier}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--muted)] shrink-0">
                        <span className="font-semibold text-[var(--foreground)]">{count.toLocaleString()}</span>
                        {isClosed && cash > 0 && (
                          <span className="text-emerald-400 font-semibold"> &middot; {formatMoney(cash)}</span>
                        )}
                      </span>
                    </div>
                    <div className="relative bg-[var(--background)] rounded-full h-3 overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${STAGE_COLORS[s]} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      {count === 0 ? (
                        <>First goal: get your first {s.toLowerCase()} prospect</>
                      ) : (
                        <>
                          Next goal:{" "}
                          <span className="text-[var(--foreground)] font-medium">
                            {next.toLocaleString()} {s.toLowerCase()}
                          </span>
                          {" "}&middot; {(next - count).toLocaleString()} to go
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Total cash earned</p>
                <p className="text-lg font-bold text-emerald-400">{formatMoney(digest.stages.Closed.revenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Open pipeline</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {formatMoney(
                    (["New", "Contacted", "Qualified", "Booked"] as ProspectStatus[])
                      .reduce((sum, st) => sum + digest.stages[st].revenue, 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Next-best-actions + Top services ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Actions (spans 3) */}
          <div className="lg:col-span-3 liquid-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--accent)]" /> Next Best Actions
              </h3>
              <Link href="/dashboard/prospects" className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1">
                Open prospects <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {ai && ai.actions.length > 0 ? (
              <div className="space-y-2">
                {ai.actions.map((a, i) => (
                  <div key={`${a.prospectId}-${i}`} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[var(--accent)]/30 transition-all">
                    <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border ${priorityStyle(a.priority)} shrink-0`}>
                      {a.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.action}{a.prospectName ? <span className="text-[var(--muted)] font-normal"> — {a.prospectName}</span> : null}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{a.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : digest.stuck.length > 0 ? (
              // Fallback: rule-based stuck list when AI hasn't run yet
              <div className="space-y-2">
                {digest.stuck.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border ${priorityStyle(s.daysSinceCreated > 7 ? "high" : "med")} shrink-0`}>
                      {s.daysSinceCreated}d
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Follow up with {s.name}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">Stuck in {s.stage} for {s.daysSinceCreated} day{s.daysSinceCreated !== 1 ? "s" : ""}{s.service ? ` · ${s.service}` : ""}</p>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-[var(--muted)] mt-2">Click Refresh above for AI-ranked recommendations.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-6 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <Zap className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-emerald-400">All caught up. No immediate action items.</p>
              </div>
            )}
          </div>

          {/* Right column (spans 2): top services + recent wins */}
          <div className="lg:col-span-2 space-y-6">
            <div className="liquid-glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Top Services
              </h3>
              {digest.topServices.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No data yet</p>
              ) : (
                <div className="space-y-1.5">
                  {digest.topServices.map((s, i) => (
                    <div key={s.service} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-[var(--muted)] shrink-0">#{i + 1}</span>
                        <span className="text-sm truncate">{s.service}</span>
                      </div>
                      <span className="text-xs text-[var(--muted)] shrink-0">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="liquid-glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" /> Recent Wins
              </h3>
              {digest.recentWins.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No closed deals in the last 14 days</p>
              ) : (
                <div className="space-y-1.5">
                  {digest.recentWins.map((w, i) => (
                    <div key={`${w.name}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
                      <span className="text-sm truncate">{w.name}</span>
                      <span className="text-xs text-emerald-400 font-semibold shrink-0">{w.dealValue ? formatMoney(w.dealValue) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
