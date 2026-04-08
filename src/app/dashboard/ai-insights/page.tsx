"use client";

import { useMemo } from "react";
import { Zap, TrendingUp, AlertTriangle, Star, BarChart3, Target } from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";

export default function AIInsightsPage() {
  const { prospects } = useProspects();

  const insights = useMemo(() => {
    const total = prospects.length;
    const byStatus = {
      New: prospects.filter((p) => p.status === "New"),
      Contacted: prospects.filter((p) => p.status === "Contacted"),
      Qualified: prospects.filter((p) => p.status === "Qualified"),
      Booked: prospects.filter((p) => p.status === "Booked"),
      Closed: prospects.filter((p) => p.status === "Closed"),
    };

    const conversionRate = total > 0 ? ((byStatus.Closed.length / total) * 100).toFixed(1) : "0";
    const bookingRate = total > 0 ? ((byStatus.Booked.length / total) * 100).toFixed(1) : "0";

    // Service popularity
    const serviceCount: Record<string, number> = {};
    prospects.forEach((p) => {
      serviceCount[p.service] = (serviceCount[p.service] || 0) + 1;
    });
    const topServices = Object.entries(serviceCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Stale leads (New for more than 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const staleLeads = byStatus.New.filter((p) => new Date(p.createdAt) < threeDaysAgo);

    // Leads without appointments in Qualified stage
    const qualifiedNoAppt = byStatus.Qualified.filter((p) => p.appointments.length === 0);

    return { total, byStatus, conversionRate, bookingRate, topServices, staleLeads, qualifiedNoAppt };
  }, [prospects]);

  const pipelineBars = [
    { label: "New", count: insights.byStatus.New.length, color: "bg-blue-500" },
    { label: "Contacted", count: insights.byStatus.Contacted.length, color: "bg-amber-500" },
    { label: "Qualified", count: insights.byStatus.Qualified.length, color: "bg-purple-500" },
    { label: "Booked", count: insights.byStatus.Booked.length, color: "bg-emerald-500" },
    { label: "Closed", count: insights.byStatus.Closed.length, color: "bg-rose-500" },
  ];

  const maxCount = Math.max(...pipelineBars.map((b) => b.count), 1);

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--accent)]" /> AI Insights
          </h1>
          <p className="text-xs text-[var(--muted)]">Intelligent analysis of your prospect pipeline</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Conversion Rate</span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{insights.conversionRate}%</p>
            <p className="text-xs text-[var(--muted)] mt-1">{insights.byStatus.Closed.length} of {insights.total} prospects closed</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Booking Rate</span>
            </div>
            <p className="text-3xl font-bold text-[var(--accent)]">{insights.bookingRate}%</p>
            <p className="text-xs text-[var(--muted)] mt-1">{insights.byStatus.Booked.length} prospects booked</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Pipeline Size</span>
            </div>
            <p className="text-3xl font-bold">{insights.total}</p>
            <p className="text-xs text-[var(--muted)] mt-1">Total active prospects</p>
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4">Pipeline Funnel</h3>
          <div className="space-y-3">
            {pipelineBars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)] w-20 shrink-0">{bar.label}</span>
                <div className="flex-1 bg-[var(--background)] rounded-full h-6 overflow-hidden">
                  <div
                    className={`${bar.color} h-full rounded-full flex items-center px-2 transition-all duration-500`}
                    style={{ width: `${Math.max((bar.count / maxCount) * 100, 8)}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">{bar.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Services */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" /> Top Services
            </h3>
            {insights.topServices.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No data yet</p>
            ) : (
              <div className="space-y-2">
                {insights.topServices.map(([service, count], i) => (
                  <div key={service} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--muted)]">#{i + 1}</span>
                      <span className="text-sm">{service}</span>
                    </div>
                    <span className="text-xs text-[var(--muted)]">{count} leads</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Items */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Action Items
            </h3>
            <div className="space-y-2">
              {insights.staleLeads.length > 0 && (
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-400">
                      {insights.staleLeads.length} stale lead{insights.staleLeads.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {insights.staleLeads.map((l) => l.name).join(", ")} — marked as &quot;New&quot; for 3+ days
                    </p>
                  </div>
                </div>
              )}
              {insights.qualifiedNoAppt.length > 0 && (
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <Target className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-purple-400">
                      {insights.qualifiedNoAppt.length} qualified without appointment
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {insights.qualifiedNoAppt.map((l) => l.name).join(", ")} — ready to book
                    </p>
                  </div>
                </div>
              )}
              {insights.staleLeads.length === 0 && insights.qualifiedNoAppt.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs text-emerald-400">All caught up! No immediate action items.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
