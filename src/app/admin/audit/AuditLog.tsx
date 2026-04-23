"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

interface Entry {
  id: string;
  action: string;
  adminEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function actionStyle(action: string): string {
  if (action.includes("refund") || action.includes("suspend") || action.includes("delete")) {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }
  if (action.includes("comp") || action.includes("grant") || action.includes("credit")) {
    return "border-violet-500/20 bg-violet-500/10 text-violet-300";
  }
  if (action.includes("impersonate") || action.includes("password")) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }
  if (action.includes("subscription") || action.includes("stripe")) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  return "border-neutral-700 bg-neutral-500/10 text-neutral-300";
}

function fmtMetadata(m: Record<string, unknown> | null): string {
  if (!m || Object.keys(m).length === 0) return "—";
  return Object.entries(m)
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}: ${s}`;
    })
    .join(" · ");
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

  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (!entries) return <div className="text-sm text-neutral-500">Loading…</div>;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-900">
      <table className="w-full text-sm">
        <thead className="bg-neutral-950 text-[11px] uppercase tracking-wider text-neutral-500">
          <tr className="border-b border-neutral-900">
            <th className="px-5 py-3 text-left font-medium">When</th>
            <th className="px-5 py-3 text-left font-medium">Admin</th>
            <th className="px-5 py-3 text-left font-medium">Action</th>
            <th className="px-5 py-3 text-left font-medium">Target</th>
            <th className="px-5 py-3 text-left font-medium">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900 bg-neutral-950">
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-neutral-500">
                  <FileText className="h-8 w-8 text-neutral-700" />
                  <div className="text-sm">No admin actions logged yet.</div>
                </div>
              </td>
            </tr>
          )}
          {entries.map((e) => (
            <tr key={e.id} className="transition-colors hover:bg-neutral-900/60">
              <td className="whitespace-nowrap px-5 py-3 text-xs text-neutral-400">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td className="px-5 py-3 text-sm text-neutral-300">{e.adminEmail ?? "—"}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${actionStyle(e.action)}`}
                >
                  {e.action}
                </span>
              </td>
              <td className="px-5 py-3 text-sm">
                {e.targetUserId ? (
                  <Link
                    href={`/admin/users/${e.targetUserId}`}
                    className="text-sky-400 transition-colors hover:text-sky-300"
                  >
                    {e.targetEmail ?? e.targetUserId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-neutral-600">—</span>
                )}
              </td>
              <td className="max-w-md truncate px-5 py-3 font-mono text-xs text-neutral-500">
                {fmtMetadata(e.metadata)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
