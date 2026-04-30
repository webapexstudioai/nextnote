"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, FolderPlus, Folder as FolderIcon, DollarSign, TrendingUp,
  Users, Calendar, ArrowRight, Trophy, Zap, Phone,
} from "lucide-react";
import { ProspectStatus, FOLDER_COLORS } from "@/types";
import { useProspects } from "@/context/ProspectsContext";
import DetailPanel from "@/components/dashboard/DetailPanel";
import AddProspectModal from "@/components/dashboard/AddProspectModal";
import AppointmentReminder from "@/components/dashboard/AppointmentReminder";

const ACCENT = "#e8553d";
const money = (n: number, c = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c.toUpperCase(), minimumFractionDigits: 2 }).format(n);

const pipelineMeta: Record<ProspectStatus, { label: string; color: string; bar: string }> = {
  New: { label: "New", color: "text-blue-400", bar: "bg-blue-500" },
  Contacted: { label: "Contacted", color: "text-amber-400", bar: "bg-amber-500" },
  Qualified: { label: "Qualified", color: "text-purple-400", bar: "bg-purple-500" },
  Booked: { label: "Booked", color: "text-emerald-400", bar: "bg-emerald-500" },
  Closed: { label: "Closed", color: "text-rose-400", bar: "bg-rose-500" },
};

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
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

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

export default function DashboardPage() {
  const { prospects, folders, createFolder } = useProspects();

  const [selectedProspect, setSelectedProspect] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].value);

  // Agency phone migration nudge — show once per user until dismissed.
  const [showAgencyNudge, setShowAgencyNudge] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("nn_agency_nudge_dismissed") === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agency/phone");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && !data.agency_phone) setShowAgencyNudge(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  function dismissAgencyNudge() {
    localStorage.setItem("nn_agency_nudge_dismissed", "1");
    setShowAgencyNudge(false);
  }

  const pipelineCounts = useMemo(() => {
    const counts: Record<ProspectStatus, number> = { New: 0, Contacted: 0, Qualified: 0, Booked: 0, Closed: 0 };
    prospects.forEach((p) => { counts[p.status]++; });
    return counts;
  }, [prospects]);

  const totalProspects = prospects.length;
  const maxPipeline = Math.max(1, ...Object.values(pipelineCounts));

  const topEarners = useMemo(() => {
    return [...prospects]
      .filter((p) => p.dealValue && p.dealValue > 0)
      .sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0))
      .slice(0, 5);
  }, [prospects]);

  const totalProspectRevenue = useMemo(
    () => prospects.reduce((sum, p) => sum + (p.dealValue ?? 0), 0),
    [prospects],
  );

  const activeProspectsCount = useMemo(
    () => prospects.filter((p) => p.status !== "Closed").length,
    [prospects],
  );

  const { todayRevenue, last7Revenue, last30Revenue } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
    let t = 0, s7 = 0, s30 = 0;
    prospects.forEach((p) => {
      if (!p.closedAt || !p.dealValue) return;
      const c = new Date(p.closedAt);
      if (isNaN(c.getTime())) return;
      if (c >= today) t += p.dealValue;
      if (c >= d7) s7 += p.dealValue;
      if (c >= d30) s30 += p.dealValue;
    });
    return { todayRevenue: t, last7Revenue: s7, last30Revenue: s30 };
  }, [prospects]);

  const daily30Chart = useMemo(() => {
    const today = startOfDay(new Date());
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      buckets.push({ key, label, value: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    prospects.forEach((p) => {
      if (!p.closedAt || !p.dealValue) return;
      const c = new Date(p.closedAt);
      if (isNaN(c.getTime())) return;
      const key = startOfDay(c).toISOString().slice(0, 10);
      const b = map.get(key);
      if (b) b.value += p.dealValue;
    });
    let running = 0;
    return buckets.map((b) => {
      running += b.value;
      return { label: b.label, revenue: b.value, net: running };
    });
  }, [prospects]);

  const recentWins = useMemo(() => {
    return [...prospects]
      .filter((p) => p.status === "Closed" && p.closedAt)
      .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
      .slice(0, 5);
  }, [prospects]);

  const selected = selectedProspect ? prospects.find((p) => p.id === selectedProspect) : null;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), newFolderColor);
    setShowCreateFolder(false);
    setNewFolderName("");
    setNewFolderColor(FOLDER_COLORS[0].value);
  };

  return (
    <>
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">Revenue, pipeline, and activity at a glance</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowAddModal(true)} className="liquid-btn">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Prospect</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 p-4 sm:p-6 space-y-6">
        <AppointmentReminder />

        {showAgencyNudge && (
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Set up your agency phone line
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Send SMS follow-ups, take inbound replies, and forward calls to your cell — all from one Twilio number tied to your agency.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/agency-phone"
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                Set up
              </Link>
              <button
                onClick={dismissAgencyNudge}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-2"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* Revenue KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: "Today's Revenue",
              value: money(todayRevenue),
              sub: "Closed deals today",
              icon: DollarSign,
              up: null as boolean | null,
            },
            {
              label: "Last 7 Days",
              value: money(last7Revenue),
              sub: "Closed deal value",
              icon: TrendingUp,
              up: true as boolean | null,
            },
            {
              label: "Last 30 Days",
              value: money(last30Revenue),
              sub: "Closed deal value",
              icon: Calendar,
              up: true as boolean | null,
            },
            {
              label: "Active Prospects",
              value: String(activeProspectsCount),
              sub: "Not yet closed",
              icon: Users,
              up: null as boolean | null,
            },
          ].map(({ label, value, sub, icon: Icon, up }) => (
            <div key={label} className="liquid-glass rounded-2xl p-5 liquid-in">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${up === true ? "bg-emerald-500/10 text-emerald-400" : up === false ? "bg-red-500/10 text-red-400" : "bg-[rgba(232,85,61,0.1)] text-[var(--accent)]"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
              <p className={`text-[11px] mt-1 font-medium ${up === true ? "text-emerald-400" : up === false ? "text-red-400" : "text-[var(--muted)]"}`}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart + Pipeline snapshot */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="liquid-glass rounded-2xl p-5 xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Closed Revenue — Last 30 Days</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Daily closed deal value and cumulative total</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">30d total</div>
                  <div className="text-sm font-semibold text-emerald-400">{money(last30Revenue)}</div>
                </div>
                <Link href="/dashboard/analytics" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                  Full analytics <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily30Chart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashNetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis yAxisId="left" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#10b981", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" name="Daily revenue" stroke={ACCENT} strokeWidth={2} fill="url(#dashRevGrad)" dot={false} />
                  <Area yAxisId="right" type="monotone" dataKey="net" name="Cumulative" stroke="#10b981" strokeWidth={2} fill="url(#dashNetGrad)" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2.5} dot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-2"><span className="w-4 h-0.5 rounded" style={{ background: ACCENT }} /> Daily revenue</span>
              <span className="flex items-center gap-2"><span className="w-4 h-0.5 rounded bg-emerald-400" /> Cumulative</span>
            </div>
          </div>

          <div className="liquid-glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Pipeline Snapshot</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">{totalProspects} total prospects</p>
              </div>
              <Zap className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="space-y-3 flex-1">
              {(Object.keys(pipelineMeta) as ProspectStatus[]).map((status) => {
                const count = pipelineCounts[status];
                const pct = (count / maxPipeline) * 100;
                return (
                  <Link
                    key={status}
                    href="/dashboard/prospects"
                    className="block group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-medium ${pipelineMeta[status].color}`}>{pipelineMeta[status].label}</span>
                      <span className="text-[var(--muted)]">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pipelineMeta[status].bar} transition-all duration-500 group-hover:opacity-80`}
                        style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted)]">Logged deal value</span>
              <span className="text-sm font-semibold text-emerald-400">{money(totalProspectRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Top earning prospects + Recent Wins */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="liquid-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Top Earning Prospects</h2>
              <span className="ml-auto text-[11px] text-[var(--muted)]">By logged deal value</span>
            </div>
            {topEarners.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-40" />
                No deal values logged yet.
                <div className="text-[11px] mt-1">Open a prospect and add the deal value when you close them.</div>
              </div>
            ) : (
              <div>
                {topEarners.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProspect(p.id)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.04] transition-colors ${i < topEarners.length - 1 ? "border-b border-white/5" : ""}`}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-400">#{i + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-[var(--muted)] truncate">{p.service || "No service"} · {p.status}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-semibold text-emerald-400">{money(p.dealValue ?? 0)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="liquid-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold">Recent Wins</h2>
              <Link href="/dashboard/prospects" className="ml-auto text-[11px] text-[var(--accent)] hover:underline">View all</Link>
            </div>
            {recentWins.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">No closed deals yet</div>
            ) : (
              <div>
                {recentWins.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProspect(p.id)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.04] transition-colors ${i < recentWins.length - 1 ? "border-b border-white/5" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--muted)] truncate">
                          {p.service || "No service"} · {p.closedAt ? formatRelative(p.closedAt) : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold shrink-0 ml-4 text-emerald-400">
                      {money(p.dealValue ?? 0)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Folder quick-access */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Folders</h2>
            <Link href="/dashboard/prospects" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
              Open pipeline <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {showCreateFolder && (
            <div className="liquid-glass rounded-2xl p-5 mb-3 liquid-in">
              <h3 className="text-sm font-bold mb-3">Create New Folder</h3>
              <div className="space-y-3">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  placeholder="Folder name..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
                />
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewFolderColor(c.value)}
                      className={`w-7 h-7 rounded-lg transition-all ${newFolderColor === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--card)] scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }} className="flex-1 liquid-btn-ghost justify-center">Cancel</button>
                  <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="flex-1 liquid-btn justify-center disabled:opacity-50">Create</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {folders.slice(0, 9).map((folder, idx) => {
              const fp = prospects.filter((p) => p.folderId === folder.id);
              return (
                <Link
                  key={folder.id}
                  href={`/dashboard/prospects?folder=${folder.id}`}
                  className={`liquid-glass rounded-2xl p-4 group liquid-in ${idx < 6 ? `liquid-d${Math.min(idx + 1, 6)}` : ""}`}
                >
                  <FolderIcon className="w-6 h-6 mb-2" style={{ color: folder.color }} />
                  <h3 className="text-sm font-medium text-[var(--foreground)] truncate">{folder.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--muted)]">{fp.length} prospects</span>
                    <span className="text-[10px] text-[var(--muted)]">·</span>
                    <span className="text-[10px] text-[var(--muted)]">{folder.files.length} files</span>
                  </div>
                </Link>
              );
            })}
            <button
              onClick={() => setShowCreateFolder(true)}
              className="liquid-glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-[var(--muted)] hover:text-white transition-all min-h-[100px]"
              style={{ borderStyle: "dashed" }}
            >
              <FolderPlus className="w-5 h-5" />
              <span className="text-xs font-medium">New Folder</span>
            </button>
          </div>
        </div>
      </div>

      {selected && <DetailPanel prospect={selected} onClose={() => setSelectedProspect(null)} />}
      {showAddModal && (
        <AddProspectModal onClose={() => setShowAddModal(false)} folders={folders} />
      )}
    </>
  );
}
