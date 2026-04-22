"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Thread {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unread: boolean;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
}

export default function SupportInbox() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/admin/support/threads?${params}`);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        if (!cancelled) setThreads(json.threads);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      }
    }
    load();
    const int = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(int);
    };
  }, [statusFilter]);

  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-xs">
        {["open", "closed", ""].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1.5 ${
              statusFilter === s ? "bg-neutral-200 text-neutral-900" : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {!threads && <div className="text-sm text-neutral-500">Loading…</div>}

      {threads && (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {threads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No threads.
                  </td>
                </tr>
              )}
              {threads.map((t) => (
                <tr key={t.id} className={t.unread ? "bg-amber-500/5" : "hover:bg-neutral-900/60"}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/support/${t.id}`} className="block">
                      <div
                        className={`${t.unread ? "font-semibold text-amber-200" : "text-neutral-200"}`}
                      >
                        {t.subject}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {t.user?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        t.status === "open"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-neutral-500/15 text-neutral-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {new Date(t.lastMessageAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
