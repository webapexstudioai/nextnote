"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, AlertTriangle, Check, CheckCheck, Clock, Smartphone, MessageSquarePlus } from "lucide-react";

export interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  to_number: string;
  from_number: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface FromNumber {
  phone_number: string;
  label: string;
  source: "caller_id" | "purchased";
}

interface MessageThreadProps {
  // Pass either prospectId (matched conversation) or remoteNumber (unmatched).
  prospectId?: string | null;
  prospectName?: string | null;
  remoteNumber?: string | null;
  onSent?: () => void;
}

const POLL_MS = 6000;

function formatPhone(num: string): string {
  const d = num.replace(/^\+1/, "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return num;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MessageThread({ prospectId, prospectName, remoteNumber, onSent }: MessageThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fromNumbers, setFromNumbers] = useState<FromNumber[]>([]);
  const [fromNumber, setFromNumber] = useState<string>("");
  const [sendingPersonal, setSendingPersonal] = useState(false);
  const [logReplyOpen, setLogReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [loggingReply, setLoggingReply] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (prospectId) p.set("prospect_id", prospectId);
    else if (remoteNumber) p.set("remote_number", remoteNumber);
    return p.toString();
  }, [prospectId, remoteNumber]);

  // Load message history (polling).
  useEffect(() => {
    if (!queryString) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/sms/messages?${queryString}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        // Server returns desc; reverse for chronological display.
        const ordered = ((json.messages ?? []) as ThreadMessage[]).slice().reverse();
        setMessages(ordered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [queryString]);

  // Mark inbound as read once on mount when we have something to clear.
  useEffect(() => {
    if (!prospectId && !remoteNumber) return;
    fetch("/api/sms/threads/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prospectId ? { prospect_id: prospectId } : { remote_number: remoteNumber }),
    }).catch(() => {});
  }, [prospectId, remoteNumber]);

  // Load available "from" numbers — only needed if this thread can be replied to.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms/from-numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const nums = (j.numbers ?? []) as FromNumber[];
        setFromNumbers(nums);
        if (nums.length > 0) {
          // Prefer the number used in the most recent outbound message.
          const lastOutbound = messages.slice().reverse().find((m) => m.direction === "outbound");
          const preferred = lastOutbound
            ? nums.find((n) => n.phone_number === lastOutbound.from_number)?.phone_number
            : null;
          setFromNumber(preferred || nums[0].phone_number);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Intentionally only run once — re-running on every messages tick would
    // thrash the from-number selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    setError(null);
    const body = draft.trim();
    if (!body) return;
    if (!prospectId) {
      setError("Cannot send to unmatched threads — add this number as a prospect first.");
      return;
    }
    if (!fromNumber) {
      setError("Pick a From number first. Visit Agency Phone if you don't have one.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, body, from_number: fromNumber }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Send failed");
        return;
      }
      setDraft("");
      // Optimistic refresh — actual persisted message will appear on next poll.
      const optimistic: ThreadMessage = {
        id: json.message_id,
        direction: "outbound",
        body: json.body || body,
        to_number: "",
        from_number: fromNumber,
        status: json.status || "sent",
        error_message: null,
        sent_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleSendPersonal() {
    setError(null);
    const body = draft.trim();
    if (!body) return;
    if (!prospectId) {
      setError("Cannot send to unmatched threads — add this number as a prospect first.");
      return;
    }
    setSendingPersonal(true);
    try {
      const res = await fetch("/api/sms/log-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not prepare personal send");
        return;
      }
      if (json.sms_link && typeof window !== "undefined") {
        window.location.href = json.sms_link;
      }
      setDraft("");
      const optimistic: ThreadMessage = {
        id: json.message_id,
        direction: "outbound",
        body: json.body || body,
        to_number: json.to || "",
        from_number: "personal",
        status: "sent_via_personal",
        error_message: null,
        sent_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare personal send");
    } finally {
      setSendingPersonal(false);
    }
  }

  async function handleLogReply() {
    setError(null);
    const body = replyDraft.trim();
    if (!body || !prospectId) return;
    setLoggingReply(true);
    try {
      const res = await fetch("/api/sms/log-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not log reply");
        return;
      }
      const optimistic: ThreadMessage = {
        id: json.message_id,
        direction: "inbound",
        body: json.body || body,
        to_number: "personal",
        from_number: "",
        status: "logged_inbound",
        error_message: null,
        sent_at: null,
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setReplyDraft("");
      setLogReplyOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log reply");
    } finally {
      setLoggingReply(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const headerLabel = prospectName || (remoteNumber && formatPhone(remoteNumber)) || "Conversation";
  const subLabel = remoteNumber ? formatPhone(remoteNumber) : null;
  const canReply = !!prospectId;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--foreground)]">{headerLabel}</div>
          {prospectName && subLabel && (
            <div className="truncate text-xs text-[var(--muted)]">{subLabel}</div>
          )}
        </div>
        {!canReply && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
            Unmatched contact
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-[var(--muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--muted)]">
            No messages yet. Send the first one below.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const showTimestamp =
                !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
              return (
                <div key={m.id}>
                  {showTimestamp && (
                    <div className="my-2 text-center text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {formatTime(m.created_at)}
                    </div>
                  )}
                  <Bubble m={m} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canReply && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {fromNumbers.length > 1 && (
            <div className="mb-2">
              <select
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px] focus:border-[var(--accent)] focus:outline-none"
              >
                {fromNumbers.map((n) => (
                  <option key={n.phone_number} value={n.phone_number}>
                    From {n.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={2}
              className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              onClick={handleSendPersonal}
              disabled={sendingPersonal || sending || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
              title="Send via my phone — opens your Messages app"
            >
              {sendingPersonal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || sendingPersonal || !draft.trim() || !fromNumber}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8553d] text-white transition-colors hover:bg-[#d44429] disabled:cursor-not-allowed disabled:opacity-50"
              title="Send via NextNote (Enter)"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>
              <Smartphone className="mr-1 inline h-3 w-3" />
              Phone icon opens iMessage / Messages on your device — no 10DLC needed.
            </span>
            <button
              onClick={() => setLogReplyOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            >
              <MessageSquarePlus className="h-3 w-3" />
              {logReplyOpen ? "Close" : "Log a reply"}
            </button>
          </div>
          {logReplyOpen && (
            <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                Paste what they replied on your phone
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Their reply…"
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  onClick={handleLogReply}
                  disabled={loggingReply || !replyDraft.trim()}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-[var(--foreground)] px-3 text-[11px] font-medium text-[var(--background)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquarePlus className="h-3 w-3" />}
                  Log
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: ThreadMessage }) {
  const isOutbound = m.direction === "outbound";
  const isPersonalOut = isOutbound && m.status === "sent_via_personal";
  const isLoggedIn = !isOutbound && m.status === "logged_inbound";
  const isFailed = isOutbound && (m.status === "failed" || m.status === "undelivered");

  const bubbleClass = isOutbound
    ? isFailed
      ? "border border-rose-500/40 bg-rose-500/10 text-rose-200"
      : isPersonalOut
        ? "border border-dashed border-[#e8553d]/60 bg-[#e8553d]/15 text-[var(--foreground)]"
        : "bg-[#e8553d] text-white"
    : isLoggedIn
      ? "border border-dashed border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
      : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug ${bubbleClass}`}>
        <div className="whitespace-pre-wrap break-words">{m.body}</div>
        {isOutbound && (
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
              isFailed ? "text-rose-300" : isPersonalOut ? "text-[var(--muted)]" : "text-white/70"
            }`}
          >
            <StatusIcon status={m.status} />
            {isFailed ? (
              <span className="text-right">
                {m.status === "failed" ? "Failed" : "Undelivered"}
                {m.error_message ? ` · ${m.error_message}` : ""}
              </span>
            ) : isPersonalOut ? (
              <span>Sent from your phone</span>
            ) : (
              <span className="capitalize">{m.status}</span>
            )}
          </div>
        )}
        {isLoggedIn && (
          <div className="mt-1 flex items-center justify-start gap-1 text-[10px] text-[var(--muted)]">
            <MessageSquarePlus className="h-3 w-3" />
            <span>Logged from your phone</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "queued":
    case "accepted":
    case "sending":
      return <Clock className="h-3 w-3" />;
    case "sent":
      return <Check className="h-3 w-3" />;
    case "delivered":
    case "read":
      return <CheckCheck className="h-3 w-3" />;
    case "failed":
    case "undelivered":
      return <AlertTriangle className="h-3 w-3" />;
    case "sent_via_personal":
      return <Smartphone className="h-3 w-3" />;
    default:
      return null;
  }
}
