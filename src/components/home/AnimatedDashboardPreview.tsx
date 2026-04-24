"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
  Zap,
  Trophy,
  ArrowRight,
  Plus,
} from "lucide-react";

const ACCENT = "#e8553d";
const EMERALD = "#10b981";

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function subProgress(p: number, start: number, end: number) {
  if (end <= start) return p >= end ? 1 : 0;
  return clamp01((p - start) / (end - start));
}

/**
 * Monotonically-increasing scroll progress (0→1) tied to a section's position.
 * Progress only ever goes up — scrolling back up holds the max value.
 * Starts at 0 when the element is ~25% visible above the fold (user has just
 * scrolled it into view) and hits 1 after they've scrolled ~35% of the element's
 * height past the top — so the animation runs *while* the dashboard is on screen,
 * not before the user reaches it.
 */
function useMonotonicScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>,
) {
  const [progress, setProgress] = useState(0);
  const maxRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      maxRef.current = 1;
      setProgress(1);
      return;
    }

    let rafId = 0;
    const compute = () => {
      rafId = 0;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const startTop = vh * 0.75;
      const endTop = -rect.height * 0.35;
      const span = startTop - endTop;
      const raw = span > 0 ? (startTop - rect.top) / span : 0;
      const clamped = clamp01(raw);
      if (clamped > maxRef.current) {
        maxRef.current = clamped;
        setProgress(clamped);
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ref]);

  return progress;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const moneyCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const DAILY_REVENUE = [
  420, 560, 480, 720, 680, 940, 880, 1120, 1280, 1180, 1480, 1680, 1580, 1920,
  2040, 1940, 2240, 2420, 2320, 2620, 2560, 2880, 2780, 3140, 3020, 3360, 3280,
  3620, 3540, 3880,
];

const TODAY_REVENUE_TARGET = 12480;
const LAST_7_REVENUE_TARGET = DAILY_REVENUE.slice(-7).reduce((a, b) => a + b, 0);
const LAST_30_REVENUE_TARGET = DAILY_REVENUE.reduce((a, b) => a + b, 0);
const ACTIVE_PROSPECTS_TARGET = 312;

const PIPELINE = [
  { label: "New", count: 104, color: "text-blue-400", bar: "bg-blue-500" },
  { label: "Contacted", count: 68, color: "text-amber-400", bar: "bg-amber-500" },
  { label: "Qualified", count: 47, color: "text-purple-400", bar: "bg-purple-500" },
  { label: "Booked", count: 34, color: "text-emerald-400", bar: "bg-emerald-500" },
  { label: "Closed", count: 59, color: "text-rose-400", bar: "bg-rose-500" },
];
const PIPELINE_MAX = Math.max(...PIPELINE.map((s) => s.count));
const PIPELINE_TOTAL = PIPELINE.reduce((s, p) => s + p.count, 0);
const LOGGED_DEAL_VALUE_TARGET = 428600;

const TOP_EARNERS = [
  { name: "Horizon Dental Group", service: "Full-service CRM setup", status: "Closed", value: 42800 },
  { name: "Birch & Vale Law", service: "Inbound lead system", status: "Closed", value: 32400 },
  { name: "Nova Fitness Studio", service: "Website + follow-up", status: "Booked", value: 24600 },
  { name: "Sunset Auto Detailing", service: "Voicemail outreach", status: "Qualified", value: 18200 },
  { name: "Maple Ridge Roofing", service: "Pipeline cleanup", status: "Closed", value: 15400 },
];

const RECENT_WINS = [
  { name: "Horizon Dental Group", service: "Full-service CRM setup", value: 42800, when: "2h ago" },
  { name: "Birch & Vale Law", service: "Inbound lead system", value: 32400, when: "Yesterday" },
  { name: "Maple Ridge Roofing", service: "Pipeline cleanup", value: 15400, when: "2d ago" },
  { name: "Coastal Med Spa", service: "Booking automation", value: 13200, when: "4d ago" },
  { name: "Ironside Fitness", service: "Voicemail blast", value: 11600, when: "5d ago" },
];

// Progress ranges for each block. Tuned so the viewer scrolls through the
// section and each element completes before the next dominates the eye.
const RANGES = {
  kpiStart: 0.05,
  kpiEnd: 0.45,
  kpiStagger: 0.04,
  chartStart: 0.18,
  chartEnd: 0.65,
  pipelineStart: 0.25,
  pipelineEnd: 0.7,
  pipelineStagger: 0.05,
  earnersStart: 0.4,
  earnersEnd: 0.85,
  earnersStagger: 0.04,
  winsStart: 0.5,
  winsEnd: 0.95,
  winsStagger: 0.04,
};

function RevenueChart({ progress }: { progress: number }) {
  const W = 560;
  const H = 200;
  const PAD_X = 12;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 22;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(...DAILY_REVENUE);

  const points = DAILY_REVENUE.map((v, i) => {
    const x = PAD_X + (i / (DAILY_REVENUE.length - 1)) * innerW;
    const y = PAD_TOP + (1 - v / max) * innerH;
    return [x, y] as const;
  });

  let cumulative = 0;
  const cumulativeMax = LAST_30_REVENUE_TARGET;
  const cumPoints = DAILY_REVENUE.map((v, i) => {
    cumulative += v;
    const x = PAD_X + (i / (DAILY_REVENUE.length - 1)) * innerW;
    const y = PAD_TOP + (1 - cumulative / cumulativeMax) * innerH;
    return [x, y] as const;
  });

  const toPath = (pts: readonly (readonly [number, number])[]) =>
    pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const linePath = toPath(points);
  const cumPath = toPath(cumPoints);
  const areaPath = `${linePath} L${points[points.length - 1][0]},${H - PAD_BOTTOM} L${points[0][0]},${H - PAD_BOTTOM} Z`;

  const drawP = easeOutCubic(subProgress(progress, RANGES.chartStart, RANGES.chartEnd));
  const cumDrawP = easeOutCubic(subProgress(progress, RANGES.chartStart + 0.05, RANGES.chartEnd + 0.05));
  const areaOpacity = easeOutCubic(subProgress(progress, RANGES.chartStart + 0.1, RANGES.chartEnd));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="dashRevGradHome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="dashNetGradHome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={EMERALD} stopOpacity={0.18} />
          <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PAD_X}
          x2={W - PAD_X}
          y1={PAD_TOP + innerH * f}
          y2={PAD_TOP + innerH * f}
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="3 3"
        />
      ))}

      <path d={areaPath} fill="url(#dashRevGradHome)" style={{ opacity: areaOpacity }} />

      <path
        d={linePath}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - drawP}
      />
      <path
        d={cumPath}
        fill="none"
        stroke={EMERALD}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - cumDrawP}
      />
    </svg>
  );
}

function Kpi({
  label,
  sub,
  icon: Icon,
  value,
  accent,
  progress,
  index,
}: {
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  accent: "accent" | "emerald";
  progress: number;
  index: number;
}) {
  const start = RANGES.kpiStart + index * RANGES.kpiStagger;
  const end = start + (RANGES.kpiEnd - RANGES.kpiStart) * 0.75;
  const local = easeOutCubic(subProgress(progress, start, end));
  const animated = value * local;
  const isMoney = label !== "Active Prospects";
  const display = isMoney
    ? moneyCompact(animated)
    : Math.round(animated).toLocaleString();

  return (
    <div
      className="liquid-glass rounded-2xl p-4 sm:p-5"
      style={{
        opacity: 0.35 + 0.65 * local,
        transform: `translateY(${(1 - local) * 14}px) scale(${0.985 + 0.015 * local})`,
      }}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
          accent === "emerald"
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-[rgba(232,85,61,0.12)] text-[#e8553d]"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">{display}</p>
      <p className="text-[11px] sm:text-xs text-[var(--muted)] mt-1">{label}</p>
      <p
        className={`text-[10px] sm:text-[11px] mt-0.5 font-medium ${
          accent === "emerald" ? "text-emerald-400" : "text-[var(--muted)]"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

export default function AnimatedDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useMonotonicScrollProgress(ref);

  const last30Local = easeOutCubic(subProgress(progress, RANGES.chartStart, RANGES.chartEnd));
  const loggedLocal = easeOutCubic(subProgress(progress, RANGES.pipelineStart, RANGES.pipelineEnd));

  const chartCardLocal = easeOutCubic(subProgress(progress, RANGES.chartStart - 0.04, RANGES.chartStart + 0.18));
  const pipelineCardLocal = easeOutCubic(subProgress(progress, RANGES.pipelineStart - 0.04, RANGES.pipelineStart + 0.18));
  const earnersCardLocal = easeOutCubic(subProgress(progress, RANGES.earnersStart - 0.04, RANGES.earnersStart + 0.18));
  const winsCardLocal = easeOutCubic(subProgress(progress, RANGES.winsStart - 0.04, RANGES.winsStart + 0.18));

  const frameLocal = easeOutCubic(subProgress(progress, 0, 0.15));

  return (
    <section id="preview" className="relative py-20 sm:py-28">
      <div className="absolute inset-0 glow-section pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
            Your command center
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            This is what closing looks like
          </h2>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Every dollar, every prospect, every win — rolled up into a dashboard that updates the second a deal closes. Scroll and watch it come alive.
          </p>
        </div>

        <div
          ref={ref}
          className="relative rounded-3xl border border-white/10 bg-[rgba(10,10,14,0.85)] overflow-hidden"
          style={{
            opacity: 0.6 + 0.4 * frameLocal,
            transform: `translateY(${(1 - frameLocal) * 24}px)`,
            boxShadow: `0 40px 120px -20px rgba(232,85,61,${0.08 + 0.2 * frameLocal})`,
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/30">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <div className="flex-1 mx-4 h-6 rounded-md bg-white/5 flex items-center justify-center">
              <span className="text-[10px] font-mono text-[var(--muted)]">
                app.nextnote.to/dashboard
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight">Dashboard</h3>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">
                  Revenue, pipeline, and activity at a glance
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Prospect</span>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <Kpi
                label="Today's Revenue"
                sub="Closed deals today"
                icon={DollarSign}
                value={TODAY_REVENUE_TARGET}
                accent="accent"
                progress={progress}
                index={0}
              />
              <Kpi
                label="Last 7 Days"
                sub="Closed deal value"
                icon={TrendingUp}
                value={LAST_7_REVENUE_TARGET}
                accent="emerald"
                progress={progress}
                index={1}
              />
              <Kpi
                label="Last 30 Days"
                sub="Closed deal value"
                icon={Calendar}
                value={LAST_30_REVENUE_TARGET}
                accent="emerald"
                progress={progress}
                index={2}
              />
              <Kpi
                label="Active Prospects"
                sub="Not yet closed"
                icon={Users}
                value={ACTIVE_PROSPECTS_TARGET}
                accent="accent"
                progress={progress}
                index={3}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div
                className="liquid-glass rounded-2xl p-4 sm:p-5 xl:col-span-2"
                style={{
                  opacity: 0.35 + 0.65 * chartCardLocal,
                  transform: `translateY(${(1 - chartCardLocal) * 16}px)`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold">Closed Revenue — Last 30 Days</h4>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">
                      Daily closed deal value and cumulative total
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">30d total</div>
                    <div className="text-sm font-semibold text-emerald-400 tabular-nums">
                      {moneyCompact(LAST_30_REVENUE_TARGET * last30Local)}
                    </div>
                  </div>
                </div>
                <div className="h-48 sm:h-56">
                  <RevenueChart progress={progress} />
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] sm:text-[11px] text-[var(--muted)]">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-0.5 rounded" style={{ background: ACCENT }} />
                    Daily revenue
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-0.5 rounded bg-emerald-400" />
                    Cumulative
                  </span>
                </div>
              </div>

              <div
                className="liquid-glass rounded-2xl p-4 sm:p-5 flex flex-col"
                style={{
                  opacity: 0.35 + 0.65 * pipelineCardLocal,
                  transform: `translateY(${(1 - pipelineCardLocal) * 16}px)`,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold">Pipeline Snapshot</h4>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">
                      {PIPELINE_TOTAL} total prospects
                    </p>
                  </div>
                  <Zap className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="space-y-3 flex-1">
                  {PIPELINE.map((s, i) => {
                    const start = RANGES.pipelineStart + i * RANGES.pipelineStagger;
                    const end = start + (RANGES.pipelineEnd - RANGES.pipelineStart) * 0.65;
                    const local = easeOutCubic(subProgress(progress, start, end));
                    const pct = (s.count / PIPELINE_MAX) * 100;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-medium ${s.color}`}>{s.label}</span>
                          <span className="text-[var(--muted)] tabular-nums">
                            {Math.round(s.count * local)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.bar}`}
                            style={{ width: `${pct * local}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--muted)]">Logged deal value</span>
                  <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                    {moneyCompact(LOGGED_DEAL_VALUE_TARGET * loggedLocal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div
                className="liquid-glass rounded-2xl overflow-hidden"
                style={{
                  opacity: 0.35 + 0.65 * earnersCardLocal,
                  transform: `translateY(${(1 - earnersCardLocal) * 16}px)`,
                }}
              >
                <div className="px-4 sm:px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-semibold">Top Earning Prospects</h4>
                  <span className="ml-auto text-[11px] text-[var(--muted)] hidden sm:inline">
                    By logged deal value
                  </span>
                </div>
                <div>
                  {TOP_EARNERS.map((p, i) => {
                    const start = RANGES.earnersStart + i * RANGES.earnersStagger;
                    const end = start + 0.12;
                    const local = easeOutCubic(subProgress(progress, start, end));
                    return (
                      <div
                        key={p.name}
                        className={`flex items-center justify-between px-4 sm:px-5 py-3 ${
                          i < TOP_EARNERS.length - 1 ? "border-b border-white/5" : ""
                        }`}
                        style={{
                          opacity: local,
                          transform: `translateX(${(1 - local) * -14}px)`,
                        }}
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-emerald-400">#{i + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-[11px] text-[var(--muted)] truncate">
                              {p.service} · {p.status}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-emerald-400 tabular-nums shrink-0 ml-3">
                          {money(p.value * local)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="liquid-glass rounded-2xl overflow-hidden"
                style={{
                  opacity: 0.35 + 0.65 * winsCardLocal,
                  transform: `translateY(${(1 - winsCardLocal) * 16}px)`,
                }}
              >
                <div className="px-4 sm:px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold">Recent Wins</h4>
                  <span className="ml-auto text-[11px] text-[var(--accent)]">
                    View all <ArrowRight className="w-3 h-3 inline" />
                  </span>
                </div>
                <div>
                  {RECENT_WINS.map((p, i) => {
                    const start = RANGES.winsStart + i * RANGES.winsStagger;
                    const end = start + 0.12;
                    const local = easeOutCubic(subProgress(progress, start, end));
                    return (
                      <div
                        key={`${p.name}-${i}`}
                        className={`flex items-center justify-between px-4 sm:px-5 py-3 ${
                          i < RECENT_WINS.length - 1 ? "border-b border-white/5" : ""
                        }`}
                        style={{
                          opacity: local,
                          transform: `translateX(${(1 - local) * 14}px)`,
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-[var(--muted)] truncate">
                              {p.service} · {p.when}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-emerald-400 tabular-nums shrink-0 ml-3">
                          {money(p.value * local)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Sample data shown. Your real dashboard updates the second a deal closes.
        </p>
      </div>
    </section>
  );
}
