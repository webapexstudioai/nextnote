"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, Inbox } from "lucide-react";
import MessageThread from "@/components/messages/MessageThread";

interface Thread {
  key: string;
  prospect_id: string | null;
  prospect_name: string | null;
  remote_number: string;
  last_message: {
    body: string;
    direction: "inbound" | "outbound";
    created_at: string;
    status: string;
  };
  unread_count: number;
}

const POLL_MS = 8000;

function formatPhone(num: string): string {
  const d = num.replace(/^\+1/, "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return num;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesClient() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/sms/threads");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setThreads(json.threads || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const sortedThreads = useMemo(() => {
    const filtered = search.trim()
      ? threads.filter((t) => {
          const q = search.toLowerCase();
          return (
            (t.prospect_name || "").toLowerCase().includes(q) ||
            t.remote_number.toLowerCase().includes(q) ||
            t.last_message.body.toLowerCase().includes(q)
          );
        })
      : threads;
    return filtered.slice().sort(
      (a, b) =>
        new Date(b.last_message.created_at).getTime() -
        new Date(a.last_message.created_at).getTime(),
    );
  }, [threads, search]);

  // Default to first thread once loaded.
  useEffect(() => {
    if (!activeKey && sortedThreads.length > 0) {
      setActiveKey(sortedThreads[0].key);
    }
  }, [sortedThreads, activeKey]);

  const active = sortedThreads.find((t) => t.key === activeKey) || null;
  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
            <p className="text-xs text-[var(--muted)]">
              {totalUnread > 0
                ? `${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`
                : "All caught up"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Thread list */}
        <aside className="flex w-80 flex-col border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-xs focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && threads.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--muted)]">Loading…</div>
            ) : sortedThreads.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {sortedThreads.map((t) => (
                  <ThreadRow
                    key={t.key}
                    thread={t}
                    active={t.key === activeKey}
                    onClick={() => {
                      setActiveKey(t.key);
                      // Optimistically clear unread; server clears on thread mount too.
                      setThreads((prev) =>
                        prev.map((x) => (x.key === t.key ? { ...x, unread_count: 0 } : x)),
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Active thread */}
        <main className="flex-1 overflow-hidden">
          {active ? (
            <MessageThread
              key={active.key}
              prospectId={active.prospect_id}
              prospectName={active.prospect_name}
              remoteNumber={active.remote_number}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
              Pick a conversation on the left.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ThreadRow({ thread, active, onClick }: { thread: Thread; active: boolean; onClick: () => void }) {
  const display = thread.prospect_name || formatPhone(thread.remote_number);
  const sub = thread.prospect_name ? formatPhone(thread.remote_number) : null;
  const preview = thread.last_message.body.replace(/\s+/g, " ").trim();
  const isInbound = thread.last_message.direction === "inbound";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
        active
          ? "bg-[rgba(232,85,61,0.08)]"
          : "hover:bg-[var(--card)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${thread.unread_count > 0 ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--foreground)]"}`}>
            {display}
          </span>
          <span className="shrink-0 text-[10px] text-[var(--muted)]">
            {relativeTime(thread.last_message.created_at)}
          </span>
        </div>
        {sub && <div className="text-[11px] text-[var(--muted)]">{sub}</div>}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${thread.unread_count > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
            {!isInbound && <span className="text-[var(--muted)]">You: </span>}
            {preview}
          </span>
          {thread.unread_count > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#e8553d] px-1 text-[9px] font-bold text-white">
              {thread.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Inbox className="mb-3 h-8 w-8 text-[var(--muted)]" />
      <p className="text-sm font-medium text-[var(--foreground)]">No conversations yet</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Replies to your sequences will show up here. You can also send the first message from any prospect&apos;s file.
      </p>
    </div>
  );
}
