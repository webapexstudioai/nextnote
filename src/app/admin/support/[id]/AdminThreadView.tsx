"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Message {
  id: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  user: { id: string; email: string; name: string | null; agencyName: string | null } | null;
}

export default function AdminThreadView({ threadId }: { threadId: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/threads/${threadId}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setThread(json.thread);
      setMessages(json.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }, [threadId]);

  useEffect(() => {
    load();
    const int = setInterval(load, 5000);
    return () => clearInterval(int);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/threads/${threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed");
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  async function toggleStatus() {
    if (!thread) return;
    const next = thread.status === "open" ? "closed" : "open";
    const res = await fetch(`/api/admin/support/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) await load();
  }

  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!thread) return <div className="text-neutral-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{thread.subject}</h2>
            <div className="mt-1 text-sm text-neutral-400">
              {thread.user ? (
                <>
                  <Link href={`/admin/users/${thread.user.id}`} className="text-blue-400 hover:text-blue-300">
                    {thread.user.email}
                  </Link>
                  {thread.user.agencyName ? ` · ${thread.user.agencyName}` : ""}
                </>
              ) : (
                "(user removed)"
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-1 text-xs ${
                thread.status === "open"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-neutral-500/15 text-neutral-400"
              }`}
            >
              {thread.status}
            </span>
            <button
              onClick={toggleStatus}
              className="rounded bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              {thread.status === "open" ? "Close" : "Reopen"}
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[520px] space-y-3 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/40 p-4"
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.isAdmin ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                m.isAdmin
                  ? "bg-amber-600 text-white"
                  : "bg-neutral-800 text-neutral-100"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className={`mt-1 text-[10px] ${m.isAdmin ? "text-amber-100" : "text-neutral-500"}`}>
                {m.isAdmin ? "You" : "Customer"} · {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-8">No messages yet.</div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a reply… (Cmd/Ctrl+Enter to send)"
          rows={3}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
