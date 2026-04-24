"use client";

import { useEffect, useRef, useState } from "react";
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

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCountUp(target: number, start: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);
  return value;
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

// Synthetic but realistic 30-day trajectory (daily closed revenue $)
const DAILY_REVENUE = [
  180, 240, 190, 310, 280, 420, 380, 470, 540, 490, 620, 710, 660, 820, 860,
  820, 940, 1020, 960, 1100, 1080, 1230, 1180, 1340, 1280, 1410, 1390, 1520,
  1470, 1620,
];

const TODAY_REVENUE_TARGET = 4200;
const LAST_7_REVENUE_TARGET = DAILY_REVENUE.slice(-7).reduce((a, b) => a + b, 0);
const LAST_30_REVENUE_TARGET = DAILY_REVENUE.reduce((a, b) => a + b, 0);
const ACTIVE_PROSPECTS_TARGET = 127;

const PIPELINE = [
  { label: "New", count: 42, color: "text-blue-400", bar: "bg-blue-500" },
  { label: "Contacted", count: 28, color: "text-amber-400", bar: "bg-amber-500" },
  { label: "Qualified", count: 19, color: "text-purple-400", bar: "bg-purple-500" },
  { label: "Booked", count: 14, color: "text-emerald-400", bar: "bg-emerald-500" },
  { label: "Closed", count: 24, color: "text-rose-400", bar: "bg-rose-500" },
];
const PIPELINE_MAX = Math.max(...PIPELINE.map((s) => s.count));
const PIPELINE_TOTAL = PIPELINE.reduce((s, p) => s + p.count, 0);
const LOGGED_DEAL_VALUE_TARGET = 186400;

const TOP_EARNERS = [
  { name: "Horizon Dental Group", service: "Full-service CRM setup", status: "Closed", value: 18400 },
  { name: "Birch & Vale Law", service: "Inbound lead system", status: "Closed", value: 14200 },
  { name: "Nova Fitness Studio", service: "Website + follow-up", status: "Booked", value: 9800 },
  { name: "Sunset Auto Detailing", service: "Voicemail outreach", status: "Qualified", value: 7600 },
  { name: "Maple Ridge Roofing", service: "Pipeline cleanup", status: "Closed", value: 6200 },
];

const RECENT_WINS = [
  { name: "Horizon Dental Group", service: "Full-service CRM setup", value: 18400, when: "2h ago" },
  { name: "Birch & Vale Law", service: "Inbound lead system", value: 14200, when: "Yesterday" },
  { name: "Maple Ridge Roofing", service: "Pipeline cleanup", value: 6200, when: "2d ago" },
  { name: "Coastal Med Spa", service: "Booking automation", value: 5400, when: "4d ago" },
  { name: "Ironside Fitness", service: "Voicemail blast", value: 4800, when: "5d ago" },
];

/** Renders an inline SVG line + area chart with stroke-draw animation on scroll. */
function RevenueChart({ animate }: { animate: boolean }) {
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

      {/* gridlines */}
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

      <path
        d={areaPath}
        fill="url(#dashRevGradHome)"
        style={{
          opacity: animate ? 1 : 0,
          transition: "opacity 900ms ease-out 500ms",
        }}
      />

      <path
        d={linePath}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={animate ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1800ms ease-in-out 200ms" }}
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
        strokeDashoffset={animate ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1800ms ease-in-out 500ms" }}
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
  trigger,
  delayMs,
}: {
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  accent: "accent" | "emerald";
  trigger: boolean;
  delayMs: number;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    const t = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(t);
  }, [trigger, delayMs]);

  const animated = useCountUp(value, armed, 1400);
  const isMoney = label !== "Active Prospects";
  const display = isMoney
    ? moneyCompact(animated)
    : Math.round(animated).toLocaleString();

  return (
    <div
      className="liquid-glass rounded-2xl p-4 sm:p-5"
      style={{
        opacity: armed ? 1 : 0,
        transform: armed ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 500ms ease-out, transform 500ms ease-out",
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
      <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
        {display}
      </p>
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
  const { ref, inView } = useInView<HTMLDivElement>(0.18);

  return (
    <section
      id="preview"
      className="relative py-20 sm:py-28"
    >
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
            Every dollar, every prospect, every win — rolled up into a dashboard that updates the second a deal closes. Scroll to see it come alive.
          </p>
        </div>

        <div
          ref={ref}
          className="relative rounded-3xl border border-white/10 bg-[rgba(10,10,14,0.85)] shadow-[0_40px_120px_-20px_rgba(232,85,61,0.25)] overflow-hidden"
        >
          {/* Fake browser chrome */}
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

          {/* Dashboard page content */}
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            {/* Header row */}
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

            {/* KPI row */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <Kpi
                label="Today's Revenue"
                sub="Closed deals today"
                icon={DollarSign}
                value={TODAY_REVENUE_TARGET}
                accent="accent"
                trigger={inView}
                delayMs={0}
              />
              <Kpi
                label="Last 7 Days"
                sub="Closed deal value"
                icon={TrendingUp}
                value={LAST_7_REVENUE_TARGET}
                accent="emerald"
                trigger={inView}
                delayMs={120}
              />
              <Kpi
                label="Last 30 Days"
                sub="Closed deal value"
                icon={Calendar}
                value={LAST_30_REVENUE_TARGET}
                accent="emerald"
                trigger={inView}
                delayMs={240}
              />
              <Kpi
                label="Active Prospects"
                sub="Not yet closed"
                icon={Users}
                value={ACTIVE_PROSPECTS_TARGET}
                accent="accent"
                trigger={inView}
                delayMs={360}
              />
            </div>

            {/* Chart + pipeline */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div
                className="liquid-glass rounded-2xl p-4 sm:p-5 xl:col-span-2"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(16px)",
                  transition:
                    "opacity 600ms ease-out 300ms, transform 600ms ease-out 300ms",
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
                      <Last30Total trigger={inView} />
                    </div>
                  </div>
                </div>
                <div className="h-48 sm:h-56">
                  <RevenueChart animate={inView} />
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
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(16px)",
                  transition:
                    "opacity 600ms ease-out 450ms, transform 600ms ease-out 450ms",
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
                    const pct = (s.count / PIPELINE_MAX) * 100;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-medium ${s.color}`}>{s.label}</span>
                          <span className="text-[var(--muted)] tabular-nums">
                            {s.count}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.bar}`}
                            style={{
                              width: inView ? `${pct}%` : "0%",
                              transition: `width 900ms cubic-bezier(0.22,1,0.36,1) ${600 + i * 110}ms`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--muted)]">Logged deal value</span>
                  <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                    <LoggedDealValue trigger={inView} />
                  </span>
                </div>
              </div>
            </div>

            {/* Top earners + recent wins */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div
                className="liquid-glass rounded-2xl overflow-hidden"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(16px)",
                  transition:
                    "opacity 600ms ease-out 700ms, transform 600ms ease-out 700ms",
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
                  {TOP_EARNERS.map((p, i) => (
                    <div
                      key={p.name}
                      className={`flex items-center justify-between px-4 sm:px-5 py-3 ${
                        i < TOP_EARNERS.length - 1 ? "border-b border-white/5" : ""
                      }`}
                      style={{
                        opacity: inView ? 1 : 0,
                        transform: inView ? "translateX(0)" : "translateX(-10px)",
                        transition: `opacity 450ms ease-out ${850 + i * 80}ms, transform 450ms ease-out ${850 + i * 80}ms`,
                      }}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-emerald-400">
                            #{i + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[11px] text-[var(--muted)] truncate">
                            {p.service} · {p.status}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400 tabular-nums shrink-0 ml-3">
                        {money(p.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="liquid-glass rounded-2xl overflow-hidden"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(16px)",
                  transition:
                    "opacity 600ms ease-out 850ms, transform 600ms ease-out 850ms",
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
                  {RECENT_WINS.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className={`flex items-center justify-between px-4 sm:px-5 py-3 ${
                        i < RECENT_WINS.length - 1 ? "border-b border-white/5" : ""
                      }`}
                      style={{
                        opacity: inView ? 1 : 0,
                        transform: inView ? "translateX(0)" : "translateX(10px)",
                        transition: `opacity 450ms ease-out ${1000 + i * 80}ms, transform 450ms ease-out ${1000 + i * 80}ms`,
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
                        {money(p.value)}
                      </p>
                    </div>
                  ))}
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

function Last30Total({ trigger }: { trigger: boolean }) {
  const v = useCountUp(LAST_30_REVENUE_TARGET, trigger, 1600);
  return <>{moneyCompact(v)}</>;
}

function LoggedDealValue({ trigger }: { trigger: boolean }) {
  const v = useCountUp(LOGGED_DEAL_VALUE_TARGET, trigger, 1600);
  return <>{moneyCompact(v)}</>;
}
