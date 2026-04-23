"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  UserPlus,
  MessageSquare,
  Coins,
  Ban,
  Clock,
  XCircle,
  ArrowRight,
} from "lucide-react";

interface Metrics {
  users: {
    total: number;
    signups24h: number;
    signups7d: number;
    signups30d: number;
    active: number;
    pending: number;
    canceled: number;
    pastDue: number;
    suspended: number;
  };
  subscriptions: {
    byTier: Record<string, number>;
    mrrUsd: number;
    annualRunRateUsd: number;
  };
  credits: {
    thisMonth: { purchased: number; granted: number; spent: number };
  };
  support: {
    openThreads: number;
    unreadByAdmin: number;
  };
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const TIER_COLORS: Record<string, string> = {
  starter: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  pro: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  agency: "text-amber-300 bg-amber-500/10 border-amber-500/20",
};

export default function MetricsHome() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/metrics");
        if (!res.ok) throw new Error("Failed");
        setM(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    })();
  }, []);

  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (!m) return <div className="text-sm text-neutral-500">Loading metrics…</div>;

  const attentionTotal = m.users.pastDue + m.users.suspended + m.support.unreadByAdmin;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">State of NextNote at a glance.</p>
        </div>
        <div className="text-xs text-neutral-500">
          Updated {new Date().toLocaleTimeString()}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          icon={DollarSign}
          iconTint="text-emerald-400 bg-emerald-500/10"
          label="MRR"
          value={fmtUsd(m.subscriptions.mrrUsd)}
          hint={`${fmtUsd(m.subscriptions.annualRunRateUsd)} ARR`}
        />
        <HeroStat
          icon={UserCheck}
          iconTint="text-violet-400 bg-violet-500/10"
          label="Active subs"
          value={m.users.active.toString()}
          hint={`${m.users.total.toLocaleString()} total users`}
          href="/admin/users?status=active"
        />
        <HeroStat
          icon={TrendingUp}
          iconTint="text-sky-400 bg-sky-500/10"
          label="New · 7d"
          value={m.users.signups7d.toString()}
          hint={`${m.users.signups30d} in last 30d`}
        />
        <HeroStat
          icon={AlertTriangle}
          iconTint={
            attentionTotal > 0
              ? "text-amber-400 bg-amber-500/10"
              : "text-neutral-400 bg-neutral-500/10"
          }
          label="Needs attention"
          value={attentionTotal.toString()}
          hint={attentionTotal > 0 ? "review below" : "all clear"}
        />
      </section>

      <section>
        <SectionHeading title="Needs attention" />
        <div className="grid gap-3 md:grid-cols-4">
          <AttentionCard
            icon={Clock}
            color="amber"
            label="Past due"
            value={m.users.pastDue}
            hint="payment failed"
            href="/admin/users?status=past_due"
          />
          <AttentionCard
            icon={MessageSquare}
            color="blue"
            label="Unread support"
            value={m.support.unreadByAdmin}
            hint={`${m.support.openThreads} open threads`}
            href="/admin/support"
          />
          <AttentionCard
            icon={Ban}
            color="red"
            label="Suspended"
            value={m.users.suspended}
            hint="manual review"
          />
          <AttentionCard
            icon={XCircle}
            color="neutral"
            label="Canceled"
            value={m.users.canceled}
            hint="lapsed subs"
            href="/admin/users?status=canceled"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <SectionHeading title="Subscriptions by tier" />
          <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5">
            {Object.keys(m.subscriptions.byTier).length === 0 ? (
              <div className="text-sm text-neutral-500">No active subs yet.</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(m.subscriptions.byTier).map(([tier, count]) => {
                  const totalActive = Object.values(m.subscriptions.byTier).reduce((a, b) => a + b, 0);
                  const pct = totalActive > 0 ? (count / totalActive) * 100 : 0;
                  return (
                    <div key={tier} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs capitalize ${
                            TIER_COLORS[tier] ?? "text-neutral-300 bg-neutral-500/10 border-neutral-700"
                          }`}
                        >
                          {tier}
                        </span>
                        <span className="font-mono text-neutral-200">
                          {count}{" "}
                          <span className="text-xs text-neutral-500">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionHeading title="Growth · signups" />
          <div className="grid grid-cols-3 gap-3">
            <TinyStat icon={UserPlus} label="24h" value={m.users.signups24h} />
            <TinyStat icon={UserPlus} label="7d" value={m.users.signups7d} />
            <TinyStat icon={UserPlus} label="30d" value={m.users.signups30d} />
          </div>
          <div className="mt-6">
            <SectionHeading title="Pending" subtle />
            <TinyStat
              icon={Clock}
              label="Signed up · no sub"
              value={m.users.pending}
              href="/admin/users?status=pending"
              wide
            />
          </div>
        </section>
      </div>

      <section>
        <SectionHeading title="Credits · month to date" />
        <div className="grid gap-4 md:grid-cols-3">
          <CreditCard
            label="Purchased"
            value={m.credits.thisMonth.purchased}
            hint="from top-ups"
            tint="text-emerald-400"
          />
          <CreditCard
            label="Granted"
            value={m.credits.thisMonth.granted}
            hint="signup bonus, admin, other"
            tint="text-violet-400"
          />
          <CreditCard
            label="Spent"
            value={m.credits.thisMonth.spent}
            hint="all usage"
            tint="text-amber-400"
          />
        </div>
      </section>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  iconTint,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconTint: string;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-900 bg-neutral-950 p-5 transition-colors hover:border-neutral-800">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTint}`}>
          <Icon className="h-4 w-4" />
        </div>
        {href && (
          <ArrowRight className="h-4 w-4 text-neutral-600 transition-colors group-hover:text-neutral-300" />
        )}
      </div>
      <div className="mt-5 text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-3xl tracking-tight text-neutral-50">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function AttentionCard({
  icon: Icon,
  color,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: "amber" | "red" | "blue" | "neutral";
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  const palettes = {
    amber: { border: "border-amber-500/20", icon: "text-amber-400 bg-amber-500/10", value: "text-amber-200" },
    red: { border: "border-red-500/20", icon: "text-red-400 bg-red-500/10", value: "text-red-200" },
    blue: { border: "border-sky-500/20", icon: "text-sky-400 bg-sky-500/10", value: "text-sky-200" },
    neutral: { border: "border-neutral-800", icon: "text-neutral-400 bg-neutral-500/10", value: "text-neutral-200" },
  } as const;
  const p = palettes[value > 0 ? color : "neutral"];
  const body = (
    <div
      className={`group flex items-center gap-3 rounded-xl border bg-neutral-950 p-4 transition-colors hover:border-neutral-700 ${p.border}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
        <div className={`font-mono text-xl ${p.value}`}>{value}</div>
        {hint && <div className="text-xs text-neutral-500">{hint}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function TinyStat({
  icon: Icon,
  label,
  value,
  href,
  wide,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href?: string;
  wide?: boolean;
}) {
  const body = (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4 transition-colors hover:border-neutral-800">
      <div className={`flex items-center gap-2 ${wide ? "justify-between" : ""}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-neutral-500" />
          <span className="text-xs uppercase tracking-wider text-neutral-500">{label}</span>
        </div>
      </div>
      <div className="mt-2 font-mono text-2xl text-neutral-100">{value.toLocaleString()}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function CreditCard({
  label,
  value,
  hint,
  tint,
}: {
  label: string;
  value: number;
  hint?: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5">
      <div className="flex items-center gap-2">
        <Coins className={`h-4 w-4 ${tint}`} />
        <span className="text-xs uppercase tracking-wider text-neutral-500">{label}</span>
      </div>
      <div className="mt-3 font-mono text-2xl text-neutral-100">{value.toLocaleString()}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

function SectionHeading({ title, subtle }: { title: string; subtle?: boolean }) {
  return (
    <h2
      className={`mb-3 text-xs font-medium uppercase tracking-wider ${
        subtle ? "text-neutral-600" : "text-neutral-500"
      }`}
    >
      {title}
    </h2>
  );
}
