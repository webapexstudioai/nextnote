"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquare } from "lucide-react";

type Props = {
  body: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
  /**
   * Optional callback fired after a successful send (e.g. to show a toast).
   */
  onSent?: () => void;
};

/**
 * One-click button that texts a piece of info to the signed-in user's verified
 * personal phone via /api/sms/send-to-me. Handles its own loading/success/error
 * micro-state so callers just pass `body` and drop it in.
 */
export function SendToMyPhoneButton({ body, label = "Text it to me", className, size = "sm", onSent }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/sms/send-to-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Couldn't send.");
        setState("error");
        setTimeout(() => setState("idle"), 4000);
        return;
      }
      setState("sent");
      onSent?.();
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setError("Network error.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const sizeClasses = size === "md"
    ? "text-sm px-3 py-2"
    : "text-xs px-2.5 py-1.5";

  const base = `inline-flex items-center gap-1.5 ${sizeClasses} rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors disabled:opacity-60`;

  if (state === "sent") {
    return (
      <button type="button" disabled className={`${base} ${className || ""} text-emerald-400`}>
        <Check className="w-3.5 h-3.5" /> Sent
      </button>
    );
  }
  if (state === "error") {
    return (
      <button type="button" onClick={send} title={error || "Couldn't send"} className={`${base} ${className || ""} text-red-400 border-red-500/40`}>
        <MessageSquare className="w-3.5 h-3.5" /> {error && error.length < 40 ? error : "Couldn't send"}
      </button>
    );
  }
  return (
    <button type="button" onClick={send} disabled={state === "sending"} className={`${base} ${className || ""}`}>
      {state === "sending" ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
      ) : (
        <><MessageSquare className="w-3.5 h-3.5" /> {label}</>
      )}
    </button>
  );
}
