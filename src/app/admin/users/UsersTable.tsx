"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  agencyName: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  creditBalance: number;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  trialing: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  past_due: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  canceled: "bg-red-500/10 text-red-300 border-red-500/20",
  pending: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20",
  incomplete: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20",
};

const TIER_STYLES: Record<string, string> = {
  starter: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  pro: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  agency: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

function initials(name: string | null, email: string) {
  const src = (name || email).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return new Date(iso).toLocaleDateString();
}

export default function UsersTable() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const initialQuery = searchParams.get("q") ?? "";

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [compingId, setCompingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        if (!cancelled) setUsers(data.users);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, statusFilter, reloadKey]);

  async function compPro(userId: string, label: string) {
    if (!confirm(`Comp ${label} to Pro? They'll get immediate access, 100 bonus credits, and a welcome email.`)) return;
    setCompingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/comp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "pro" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed");
      if (Array.isArray(json.warnings) && json.warnings.length) {
        alert(`Comp succeeded but:\n\n• ${json.warnings.join("\n• ")}`);
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to comp account");
    } finally {
      setCompingId(null);
    }
  }

  const activeCount = useMemo(
    () => users?.filter((u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing").length ?? 0,
    [users],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name, or agency"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2 pl-9 pr-3 text-sm placeholder-neutral-500 focus:border-neutral-600 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
          <option value="pending">Pending</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>

      {users && (
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>
            <span className="font-mono text-neutral-300">{users.length}</span> total
          </span>
          <span className="h-3 w-px bg-neutral-800" />
          <span>
            <span className="font-mono text-emerald-400">{activeCount}</span> with access
          </span>
        </div>
      )}

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-950 text-[11px] uppercase tracking-wider text-neutral-500">
            <tr className="border-b border-neutral-900">
              <th className="px-5 py-3 text-left font-medium">User</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Tier</th>
              <th className="px-5 py-3 text-right font-medium">Credits</th>
              <th className="px-5 py-3 text-left font-medium">Joined</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 bg-neutral-950">
            {!users && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            )}
            {users && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-neutral-500">
                  No users match your filters.
                </td>
              </tr>
            )}
            {users?.map((u) => {
              const canComp = u.subscriptionStatus !== "active" && u.subscriptionStatus !== "trialing";
              return (
                <tr key={u.id} className="transition-colors hover:bg-neutral-900/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 text-[11px] font-medium text-neutral-200">
                        {initials(u.name, u.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-neutral-100">
                            {u.name || u.email}
                          </span>
                          {u.isAdmin && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                              admin
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {u.email}
                          {u.agencyName ? ` · ${u.agencyName}` : ""}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${
                        STATUS_STYLES[u.subscriptionStatus ?? ""] ??
                        "border-neutral-700 bg-neutral-500/10 text-neutral-300"
                      }`}
                    >
                      {u.subscriptionStatus ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.subscriptionTier ? (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] capitalize ${
                          TIER_STYLES[u.subscriptionTier] ??
                          "border-neutral-700 bg-neutral-500/10 text-neutral-300"
                        }`}
                      >
                        {u.subscriptionTier}
                      </span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-neutral-200">
                    {u.creditBalance.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-neutral-400">{timeAgo(u.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {canComp && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          compPro(u.id, u.name || u.email);
                        }}
                        disabled={compingId === u.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3" />
                        {compingId === u.id ? "Activating…" : "Comp Pro"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
