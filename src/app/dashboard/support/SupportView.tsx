"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, UserRound, Plus, Send, MessageSquare, Inbox } from "lucide-react";

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

interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

type View = { kind: "ai" } | { kind: "new" } | { kind: "thread"; id: string } | { kind: "empty" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = 60000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return "just now";
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < d) return `${Math.floor(diff / h)}h`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}d`;
  return new Date(iso).toLocaleDateString();
}

export default function SupportView() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [view, setView] = useState<View>({ kind: "ai" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      content: "Hey! I'm NextNote's AI assistant. Ask me anything about importing prospects, sending voicedrops, booking appointments, or finding a feature. If I can't help, I'll hand you over to a real human.",
    },
  ]);
  const [aiDraft, setAiDraft] = useState("");
  const [aiTyping, setAiTyping] = useState(false);

  const humanScrollRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/support/threads");
      if (!res.ok) return;
      const json = await res.json();
      setThreads(json.threads ?? []);
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
    if (view.kind !== "thread") return;
    loadMessages(view.id);
    const int = setInterval(() => loadMessages(view.id), 5000);
    return () => clearInterval(int);
  }, [view, loadMessages]);

  useEffect(() => {
    humanScrollRef.current?.scrollTo({ top: humanScrollRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiMessages.length, aiTyping]);

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
      setView({ kind: "thread", id: json.threadId });
      await Promise.all([loadThreads(), loadMessages(json.threadId)]);
    } catch {
      alert("Failed to create conversation");
    } finally {
      setSending(false);
    }
  }

  async function reply() {
    if (view.kind !== "thread" || !draft.trim()) return;
    const threadId = view.id;
    setSending(true);
    try {
      const res = await fetch(`/api/support/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setDraft("");
      await loadMessages(threadId);
    } catch {
      alert("Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function sendAI() {
    const text = aiDraft.trim();
    if (!text || aiTyping) return;
    const next: AIMessage[] = [...aiMessages, { role: "user", content: text }];
    setAiMessages(next);
    setAiDraft("");
    setAiTyping(true);
    try {
      const res = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessages([...next, { role: "assistant", content: json.error || "I hit a snag. Try asking again or message a human." }]);
      } else {
        setAiMessages([...next, { role: "assistant", content: json.reply || "Sorry, I didn't catch that." }]);
      }
    } catch {
      setAiMessages([...next, { role: "assistant", content: "Network hiccup. Try again in a moment." }]);
    } finally {
      setAiTyping(false);
    }
  }

  const unreadCount = useMemo(() => threads.filter((t) => t.unread).length, [threads]);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col lg:h-screen">
      <div className="border-b border-white/5 px-6 py-5 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Support</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Get instant answers from our AI assistant, or message a real human.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 flex-col border-r border-white/5 bg-black/10">
          <div className="space-y-1 p-3">
            <TabButton
              active={view.kind === "ai"}
              onClick={() => setView({ kind: "ai" })}
              icon={Sparkles}
              label="AI assistant"
              hint="Instant answers"
              accent
            />
            <TabButton
              active={view.kind === "new"}
              onClick={() => setView({ kind: "new" })}
              icon={Plus}
              label="New conversation"
              hint="Message support"
            />
          </div>

          <div className="border-t border-white/5 px-3 pt-3 pb-1">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Your conversations
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
            {threads.length === 0 ? (
              <div className="px-3 py-4 text-xs text-[var(--muted)]">
                No conversations yet.
              </div>
            ) : (
              threads.map((t) => {
                const active = view.kind === "thread" && view.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setView({ kind: "thread", id: t.id })}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-white/10"
                        : t.unread
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {t.unread && !active && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-sm ${
                            t.unread && !active
                              ? "font-semibold text-[var(--foreground)]"
                              : "text-[var(--foreground)]"
                          }`}
                        >
                          {t.subject}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <span>{t.status}</span>
                          <span>·</span>
                          <span>{timeAgo(t.lastMessageAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {view.kind === "ai" && (
            <>
              <div ref={aiScrollRef} className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
                <div className="mx-auto max-w-3xl space-y-4">
                  {aiMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "rounded-br-sm bg-[color:var(--accent)] text-white"
                            : "rounded-bl-sm border border-white/10 bg-black/20 text-[var(--foreground)]"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  ))}
                  {aiTyping && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/10 bg-black/20 px-4 py-3">
                        <span className="ai-dot" />
                        <span className="ai-dot" style={{ animationDelay: "0.15s" }} />
                        <span className="ai-dot" style={{ animationDelay: "0.3s" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-white/5 px-6 py-4 lg:px-10">
                <div className="mx-auto flex max-w-3xl items-end gap-2">
                  <textarea
                    value={aiDraft}
                    onChange={(e) => setAiDraft(e.target.value)}
                    placeholder="Ask anything about NextNote…"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendAI();
                      }
                    }}
                    className="min-h-[42px] max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[color:var(--accent)]/50 focus:outline-none"
                  />
                  <button
                    onClick={sendAI}
                    disabled={aiTyping || !aiDraft.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-white transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mx-auto mt-2 max-w-3xl text-[11px] text-[var(--muted)]">
                  AI can be wrong. For account issues, use "New conversation" to reach a human.
                </p>
              </div>
            </>
          )}

          {view.kind === "new" && (
            <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/10 to-transparent p-5">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-[color:var(--accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--foreground)]">Message our team</h2>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    A real human will reply. Typical response within 24 hours.
                  </p>
                </div>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (e.g. Can't import file)"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-white/30 focus:outline-none"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe what's happening…"
                  rows={10}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-white/30 focus:outline-none"
                />
                <div className="flex items-center justify-end">
                  <button
                    onClick={createThread}
                    disabled={sending || !subject.trim() || !body.trim()}
                    className="rounded-lg bg-[color:var(--accent)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {view.kind === "thread" && (
            <>
              <div ref={humanScrollRef} className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
                <div className="mx-auto max-w-3xl space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-[var(--muted)]">
                      <MessageSquare className="h-8 w-8 opacity-40" />
                      <div className="text-sm">Loading messages…</div>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.isAdmin ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            m.isAdmin
                              ? "rounded-bl-sm border border-white/10 bg-black/20 text-[var(--foreground)]"
                              : "rounded-br-sm bg-[color:var(--accent)] text-white"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{m.body}</div>
                          <div className={`mt-1.5 text-[10px] ${m.isAdmin ? "text-[var(--muted)]" : "text-white/70"}`}>
                            {m.isAdmin ? "Support" : "You"} · {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="border-t border-white/5 px-6 py-4 lg:px-10">
                <div className="mx-auto max-w-3xl">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply…"
                    rows={3}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        void reply();
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-white/30 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-[var(--muted)]">⌘↵ to send</span>
                    <button
                      onClick={reply}
                      disabled={sending || !draft.trim()}
                      className="rounded-lg bg-[color:var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {view.kind === "empty" && (
            <div className="flex flex-1 flex-col items-center justify-center text-[var(--muted)]">
              <Inbox className="h-10 w-10 opacity-40" />
              <div className="mt-2 text-sm">Pick a conversation on the left.</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        active ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          accent
            ? "bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
            : "bg-white/5 text-[var(--foreground)]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--foreground)]">{label}</div>
        {hint && <div className="text-[11px] text-[var(--muted)]">{hint}</div>}
      </div>
    </button>
  );
}
