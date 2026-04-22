"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  trialing: "bg-blue-500/15 text-blue-400",
  past_due: "bg-amber-500/15 text-amber-400",
  canceled: "bg-red-500/15 text-red-400",
  pending: "bg-neutral-500/15 text-neutral-400",
  incomplete: "bg-neutral-500/15 text-neutral-400",
};

export default function UsersTable() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
  }, [query, statusFilter]);

  const activeCount = useMemo(
    () => users?.filter((u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing").length ?? 0,
    [users],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, name, or agency"
          className="flex-1 min-w-[240px] rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm placeholder-neutral-500 focus:border-neutral-600 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
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
        <div className="text-xs text-neutral-500">
          {users.length} total · {activeCount} with access
        </div>
      )}

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">Credits</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {!users && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Loading...
                </td>
              </tr>
            )}
            {users && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No users found.
                </td>
              </tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-900/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="block">
                    <div className="font-medium text-neutral-100">{u.name || u.email}</div>
                    <div className="text-xs text-neutral-500">
                      {u.email}
                      {u.agencyName ? ` · ${u.agencyName}` : ""}
                      {u.isAdmin ? " · admin" : ""}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      STATUS_COLORS[u.subscriptionStatus ?? ""] ?? "bg-neutral-500/15 text-neutral-400"
                    }`}
                  >
                    {u.subscriptionStatus ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300">{u.subscriptionTier ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-200">
                  {u.creditBalance.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
