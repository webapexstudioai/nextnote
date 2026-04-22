"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Sparkles, UserRound, ArrowLeft, Send } from "lucide-react";

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

type View = "home" | "ai" | "human_list" | "human_new" | "human_thread";

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    if (view !== "human_thread" || !activeThread) return;
    loadMessages(activeThread);
    const int = setInterval(() => loadMessages(activeThread), 5000);
    return () => clearInterval(int);
  }, [view, activeThread, loadMessages]);

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
      setActiveThread(json.threadId);
      setView("human_thread");
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

  function openThread(id: string) {
    setActiveThread(id);
    setView("human_thread");
  }

  function goBack() {
    if (view === "human_thread") {
      setView("human_list");
      setActiveThread(null);
    } else if (view === "human_new" || view === "human_list" || view === "ai") {
      setView("home");
    }
  }

  const showBack = view !== "home";
  const title =
    view === "home" ? "Help center"
    : view === "ai" ? "AI assistant"
    : view === "human_new" ? "New conversation"
    : view === "human_thread" ? "Support"
    : "Your conversations";

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          loadThreads();
        }}
        aria-label="Contact support"
        className="support-bubble fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--accent)] text-white shadow-lg hover:scale-105 transition-transform"
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
          className="support-panel fixed bottom-24 right-6 z-40 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--background)] shadow-2xl"
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[color:var(--accent)]/25 via-black/30 to-black/20 px-4 py-3">
            <div className="flex items-center gap-2">
              {showBack && (
                <button
                  onClick={goBack}
                  className="text-neutral-400 hover:text-white transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {view === "home" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/10 to-transparent p-4">
                <div className="text-sm font-semibold text-[var(--foreground)]">How can we help?</div>
                <p className="mt-1 text-xs text-neutral-400">
                  Ask our AI assistant for instant answers, or message our team directly.
                </p>
              </div>

              <button
                onClick={() => setView("ai")}
                className="group w-full rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent)]/5 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--accent)]/15 text-[color:var(--accent)] group-hover:scale-110 transition-transform">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                      Chat with AI assistant
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">INSTANT</span>
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      "How do I import prospects?" — get answers in seconds.
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setView(threads.length > 0 ? "human_list" : "human_new")}
                className="group w-full rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-white/25 hover:bg-white/5 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-neutral-300 group-hover:scale-110 transition-transform">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--foreground)]">
                      <span>Message support team</span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{unreadCount} new</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      A real human replies. Typical reply within 24 hours.
                    </div>
                  </div>
                </div>
              </button>

              <p className="pt-2 text-center text-[10px] text-neutral-600">
                Built by an agency owner, for agency owners.
              </p>
            </div>
          )}

          {view === "ai" && (
            <>
              <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {aiMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`ai-bubble flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-[color:var(--accent)] text-white rounded-br-sm"
                          : "bg-black/30 border border-white/10 text-[var(--foreground)] rounded-bl-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  </div>
                ))}
                {aiTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/10 bg-black/30 px-3.5 py-2.5">
                      <span className="ai-dot" />
                      <span className="ai-dot" style={{ animationDelay: "0.15s" }} />
                      <span className="ai-dot" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 p-3">
                <div className="flex items-end gap-2">
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
                    className="min-h-[38px] max-h-24 flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--foreground)] focus:border-[color:var(--accent)]/50 focus:outline-none"
                  />
                  <button
                    onClick={sendAI}
                    disabled={aiTyping || !aiDraft.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent)] text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-neutral-600">
                  AI can be wrong. For account issues, use "Message support team".
                </p>
              </div>
            </>
          )}

          {view === "human_list" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button
                onClick={() => setView("human_new")}
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

          {view === "human_new" && (
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

          {view === "human_thread" && (
            <>
              <div ref={humanScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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
