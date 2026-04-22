"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

function Card({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5 hover:border-neutral-700 transition-colors">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 font-mono text-2xl text-neutral-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-neutral-400">State of NextNote at a glance.</p>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Revenue</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card label="MRR" value={fmtUsd(m.subscriptions.mrrUsd)} hint="monthly recurring" />
          <Card label="Annual run rate" value={fmtUsd(m.subscriptions.annualRunRateUsd)} />
          <Card label="Active subs" value={m.users.active.toString()} href="/admin/users" />
          <Card label="Past due" value={m.users.pastDue.toString()} hint="payment issues" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Subscriptions by tier</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {Object.entries(m.subscriptions.byTier).map(([tier, count]) => (
            <Card key={tier} label={tier} value={count.toString()} />
          ))}
          {Object.keys(m.subscriptions.byTier).length === 0 && (
            <div className="text-sm text-neutral-500">No active subs yet.</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Growth</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card label="Total users" value={m.users.total.toString()} href="/admin/users" />
          <Card label="Signups · 24h" value={m.users.signups24h.toString()} />
          <Card label="Signups · 7d" value={m.users.signups7d.toString()} />
          <Card label="Signups · 30d" value={m.users.signups30d.toString()} />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Accounts needing attention</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card label="Pending" value={m.users.pending.toString()} hint="signed up, no sub" />
          <Card label="Canceled" value={m.users.canceled.toString()} />
          <Card label="Suspended" value={m.users.suspended.toString()} />
          <Card
            label="Support · unread"
            value={m.support.unreadByAdmin.toString()}
            hint={`${m.support.openThreads} open`}
            href="/admin/support"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Credits · this month</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            label="Purchased"
            value={m.credits.thisMonth.purchased.toLocaleString()}
            hint="from credit packs"
          />
          <Card
            label="Granted"
            value={m.credits.thisMonth.granted.toLocaleString()}
            hint="signup bonus, admin, other"
          />
          <Card label="Spent" value={m.credits.thisMonth.spent.toLocaleString()} hint="all usage" />
        </div>
      </section>
    </div>
  );
}
