"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";

interface Thread {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unread: boolean;
}

interface Message {
  id: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | "thread">("list");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/support/threads");
      if (!res.ok) return;
      const json = await res.json();
      setThreads(json.threads ?? []);
      setUnreadCount((json.threads ?? []).filter((t: Thread) => t.unread).length);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/support/threads/${threadId}/messages`);
      if (!res.ok) return;
      const json = await res.json();
      setMessages(json.messages ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadThreads();
    const int = setInterval(loadThreads, 30_000);
    return () => clearInterval(int);
  }, [loadThreads]);

  useEffect(() => {
    if (view !== "thread" || !activeThread) return;
    loadMessages(activeThread);
    const int = setInterval(() => loadMessages(activeThread), 5000);
    return () => clearInterval(int);
  }, [view, activeThread, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function createThread() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/support/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setSubject("");
      setBody("");
      setActiveThread(json.threadId);
      setView("thread");
      await Promise.all([loadThreads(), loadMessages(json.threadId)]);
    } catch {
      alert("Failed to create thread");
    } finally {
      setSending(false);
    }
  }

  async function reply() {
    if (!draft.trim() || !activeThread) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/threads/${activeThread}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setDraft("");
      await loadMessages(activeThread);
    } catch {
      alert("Failed to send");
    } finally {
      setSending(false);
    }
  }

  function openThread(id: string) {
    setActiveThread(id);
    setView("thread");
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (view !== "thread") setView("list");
          loadThreads();
        }}
        aria-label="Contact support"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--accent)] text-white shadow-lg hover:opacity-90 transition-opacity"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-40 flex h-[540px] w-[380px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--background)] shadow-2xl"
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3">
            <div className="flex items-center gap-2">
              {view !== "list" && (
                <button
                  onClick={() => {
                    setView("list");
                    setActiveThread(null);
                  }}
                  className="text-neutral-400 hover:text-white text-sm"
                >
                  ←
                </button>
              )}
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {view === "new" ? "New conversation" : view === "thread" ? "Support" : "Support"}
              </h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {view === "list" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button
                onClick={() => setView("new")}
                className="w-full rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Start a new conversation
              </button>
              {threads.length === 0 ? (
                <div className="py-8 text-center text-sm text-neutral-500">
                  No conversations yet.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    Your conversations
                  </div>
                  {threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openThread(t.id)}
                      className="w-full rounded-md border border-white/10 bg-black/20 p-3 text-left hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`text-sm ${t.unread ? "font-semibold text-[var(--foreground)]" : "text-neutral-300"}`}
                        >
                          {t.subject}
                        </div>
                        {t.unread && <span className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                        <span>{t.status}</span>
                        <span>{new Date(t.lastMessageAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "new" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (e.g. Can't import file)"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--foreground)] focus:border-white/30 focus:outline-none"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe what's happening…"
                rows={8}
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--foreground)] focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={createThread}
                disabled={sending || !subject.trim() || !body.trim()}
                className="w-full rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
              <p className="text-xs text-neutral-500">
                A real human will reply. Expect a response within 24 hours.
              </p>
            </div>
          )}

          {view === "thread" && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isAdmin ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.isAdmin
                          ? "bg-black/30 text-[var(--foreground)] border border-white/10"
                          : "bg-[color:var(--accent)] text-white"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className={`mt-1 text-[10px] ${m.isAdmin ? "text-neutral-500" : "text-white/70"}`}>
                        {m.isAdmin ? "Support" : "You"} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply…"
                  rows={2}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void reply();
                    }
                  }}
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--foreground)] focus:border-white/30 focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={reply}
                    disabled={sending || !draft.trim()}
                    className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
