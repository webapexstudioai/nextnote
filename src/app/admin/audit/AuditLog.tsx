"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Entry {
  id: string;
  action: string;
  adminEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default function AuditLog() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/audit");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setEntries(json.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    })();
  }, []);

  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!entries) return <div className="text-neutral-500 text-sm">Loading…</div>;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 text-left">When</th>
            <th className="px-4 py-3 text-left">Admin</th>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3 text-left">Target</th>
            <th className="px-4 py-3 text-left">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                Nothing logged yet.
              </td>
            </tr>
          )}
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-neutral-900/60">
              <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-neutral-300">{e.adminEmail ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-200">{e.action}</td>
              <td className="px-4 py-3">
                {e.targetUserId ? (
                  <Link href={`/admin/users/${e.targetUserId}`} className="text-blue-400 hover:text-blue-300">
                    {e.targetEmail ?? e.targetUserId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-neutral-500">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-500 font-mono max-w-md">
                {e.metadata && Object.keys(e.metadata).length > 0
                  ? JSON.stringify(e.metadata)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
