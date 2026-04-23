"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, CircleDot } from "lucide-react";

interface Thread {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unread: boolean;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = 60000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return "just now";
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const FILTERS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "", label: "All" },
];

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

  if (error) return <div className="text-sm text-red-400">{error}</div>;

  const unreadCount = threads?.filter((t) => t.unread).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 p-1 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusFilter === f.value
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {threads && (
          <div className="text-xs text-neutral-500">
            <span className="font-mono text-neutral-300">{threads.length}</span> shown
            {unreadCount > 0 && (
              <>
                {" · "}
                <span className="font-mono text-amber-300">{unreadCount}</span> unread
              </>
            )}
          </div>
        )}
      </div>

      {!threads && <div className="text-sm text-neutral-500">Loading…</div>}

      {threads && (
        <div className="overflow-hidden rounded-xl border border-neutral-900">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-neutral-500">
              <Inbox className="h-8 w-8 text-neutral-700" />
              <div className="text-sm">No threads to show.</div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-900">
              {threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/support/${t.id}`}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                    t.unread ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-neutral-900/60"
                  }`}
                >
                  <div className="flex w-4 justify-center">
                    {t.unread ? (
                      <CircleDot className="h-3 w-3 text-amber-400" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-sm ${
                        t.unread ? "font-semibold text-amber-100" : "text-neutral-200"
                      }`}
                    >
                      {t.subject}
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {t.user?.name || t.user?.email || "—"}
                      {t.user?.name && t.user?.email ? ` · ${t.user.email}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] ${
                      t.status === "open"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-neutral-700 bg-neutral-500/10 text-neutral-400"
                    }`}
                  >
                    {t.status}
                  </span>
                  <div className="w-24 shrink-0 text-right text-xs text-neutral-500">
                    {timeAgo(t.lastMessageAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
