"use client";

import { useEffect, useState, useMemo } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  DollarSign, TrendingUp, Users, BarChart3, Target, Trophy, Percent,
} from "lucide-react";
import { ProspectStatus } from "@/types";
import { useProspects } from "@/context/ProspectsContext";

const ACCENT = "#e8553d";

function money(n: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(n);
}

const statusMeta: Record<ProspectStatus, { label: string; color: string; bar: string }> = {
  New: { label: "New", color: "text-blue-400", bar: "bg-blue-500" },
  Contacted: { label: "Contacted", color: "text-amber-400", bar: "bg-amber-500" },
  Qualified: { label: "Qualified", color: "text-purple-400", bar: "bg-purple-500" },
  Booked: { label: "Booked", color: "text-emerald-400", bar: "bg-emerald-500" },
  Closed: { label: "Closed", color: "text-rose-400", bar: "bg-rose-500" },
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass rounded-xl px-4 py-3 text-xs border border-[var(--border)] shadow-xl space-y-1.5">
      <p className="text-[var(--muted)] font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--foreground)] font-semibold">{money(p.value)}</span>
          <span className="text-[var(--muted)]">{p.name}</span>
        </div>
      ))}
    </div>
  );
};

const CountTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass rounded-xl px-4 py-3 text-xs border border-[var(--border)] shadow-xl space-y-1.5">
      <p className="text-[var(--muted)] font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--foreground)] font-semibold">{p.value}</span>
          <span className="text-[var(--muted)]">{p.name}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { prospects } = useProspects();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const funnel = useMemo(() => {
    const counts: Record<ProspectStatus, number> = { New: 0, Contacted: 0, Qualified: 0, Booked: 0, Closed: 0 };
    prospects.forEach((p) => { counts[p.status]++; });
    const order: ProspectStatus[] = ["New", "Contacted", "Qualified", "Booked", "Closed"];
    return order.map((s) => ({ status: s, label: statusMeta[s].label, count: counts[s] }));
  }, [prospects]);

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      buckets.push({ key, label, value: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    prospects.forEach((p) => {
      if (!p.closedAt || !p.dealValue) return;
      const c = new Date(p.closedAt);
      if (isNaN(c.getTime())) return;
      const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`;
      const b = map.get(key);
      if (b) b.value += p.dealValue;
    });
    return buckets;
  }, [prospects]);

  const topServices = useMemo(() => {
    const agg = new Map<string, { service: string; count: number; total: number }>();
    prospects.forEach((p) => {
      const key = (p.service || "Uncategorized").trim() || "Uncategorized";
      const cur = agg.get(key) ?? { service: key, count: 0, total: 0 };
      cur.count++;
      cur.total += p.dealValue ?? 0;
      agg.set(key, cur);
    });
    return Array.from(agg.values())
      .sort((a, b) => b.total - a.total || b.count - a.count)
      .slice(0, 8);
  }, [prospects]);

  const winRate = useMemo(() => {
    const nonNew = prospects.filter((p) => p.status !== "New").length;
    const closed = prospects.filter((p) => p.status === "Closed").length;
    if (nonNew === 0) return { pct: 0, closed, nonNew };
    return { pct: (closed / nonNew) * 100, closed, nonNew };
  }, [prospects]);

  const avgDealSize = useMemo(() => {
    const withValue = prospects.filter((p) => p.status === "Closed" && (p.dealValue ?? 0) > 0);
    if (withValue.length === 0) return 0;
    const total = withValue.reduce((s, p) => s + (p.dealValue ?? 0), 0);
    return total / withValue.length;
  }, [prospects]);

  const totalClosedRevenue = useMemo(
    () => prospects.filter((p) => p.status === "Closed").reduce((s, p) => s + (p.dealValue ?? 0), 0),
    [prospects],
  );

  const maxServiceTotal = Math.max(1, ...topServices.map((s) => s.total));

  return (
    <div className={`min-h-full transition-all duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--accent)]" /> Pipeline Analytics
            </h1>
            <p className="text-xs text-[var(--muted)]">Conversion, revenue, and service breakdown from your prospects</p>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: "Closed Revenue",
              value: money(totalClosedRevenue),
              sub: "All-time logged",
              icon: DollarSign,
            },
            {
              label: "Win Rate",
              value: `${winRate.pct.toFixed(1)}%`,
              sub: `${winRate.closed} closed / ${winRate.nonNew} worked`,
              icon: Percent,
            },
            {
              label: "Avg Deal Size",
              value: money(avgDealSize),
              sub: "From closed deals",
              icon: TrendingUp,
            },
            {
              label: "Total Prospects",
              value: String(prospects.length),
              sub: "In pipeline",
              icon: Users,
            },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div
              key={label}
              className="liquid-glass rounded-2xl p-5 transition-all duration-500 hover:shadow-[0_0_0_1px_rgba(232,85,61,0.08),0_18px_40px_rgba(0,0,0,0.18)]"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[rgba(232,85,61,0.1)] text-[var(--accent)]">
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
              <p className="text-[11px] mt-1 font-medium text-[var(--muted)]">{sub}</p>
            </div>
          ))}
        </div>

        {/* Funnel + Monthly Revenue */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-[var(--accent)]" /> Conversion Funnel
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Prospects by stage</p>
              </div>
            </div>
            <div className="space-y-3">
              {funnel.map((f) => {
                const pct = (f.count / maxFunnel) * 100;
                return (
                  <div key={f.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-medium ${statusMeta[f.status].color}`}>{f.label}</span>
                      <span className="text-[var(--muted)]">{f.count}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${statusMeta[f.status].bar} transition-all duration-500`}
                        style={{ width: `${Math.max(pct, f.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="liquid-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold">Revenue Closed by Month</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Last 12 months</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.9} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Revenue" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Services */}
        <div className="liquid-glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Top Services</h2>
            <span className="ml-auto text-[11px] text-[var(--muted)]">By logged deal value</span>
          </div>
          {topServices.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">No services yet</div>
          ) : (
            <div>
              {topServices.map((s, i) => {
                const pct = (s.total / maxServiceTotal) * 100;
                return (
                  <div
                    key={s.service}
                    className={`px-5 py-4 ${i < topServices.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[rgba(232,85,61,0.1)] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[var(--accent)]">#{i + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.service}</p>
                          <p className="text-[11px] text-[var(--muted)]">{s.count} prospect{s.count === 1 ? "" : "s"}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold shrink-0 text-emerald-400">{money(s.total)}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                        style={{ width: `${Math.max(pct, s.total > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stage counts bar chart */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold">Prospects by Stage</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">Current pipeline distribution</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel.map((f) => ({ label: f.label, count: f.count }))} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="stageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.9} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="count" name="Prospects" fill="url(#stageGrad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
