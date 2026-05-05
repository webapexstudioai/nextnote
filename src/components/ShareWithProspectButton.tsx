"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";

type Props = {
  prospectName: string;
  prospectPhone: string | null | undefined;
  prospectEmail: string | null | undefined;
  url: string;
  className?: string;
};

export function ShareWithProspectButton({
  prospectName,
  prospectPhone,
  prospectEmail,
  url,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const firstName = (prospectName || "").split(/\s+/)[0] || "there";
  const smsBody = `Hi ${firstName}, I built a quick site for you — take a look: ${url}`;
  const emailSubject = `A site preview for ${prospectName}`;
  const emailBody = `Hi ${firstName},\n\nI put together a quick site preview for you — feel free to take a look:\n${url}\n\nHappy to walk you through it.`;

  const smsHref = prospectPhone
    ? `sms:${prospectPhone.replace(/\s+/g, "")}${/iPhone|iPad|iPod|Mac OS/.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? "&" : "?"}body=${encodeURIComponent(smsBody)}`
    : undefined;
  const mailHref = prospectEmail
    ? `mailto:${prospectEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    : undefined;

  const canShare = !!(smsHref || mailHref);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => canShare && setOpen((v) => !v)}
        disabled={!canShare}
        title={canShare ? "Send to prospect" : "Add a phone or email to this prospect first"}
        className={`flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className || ""}`}
      >
        <Send className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5">
          <a
            href={smsHref}
            onClick={() => setOpen(false)}
            aria-disabled={!smsHref}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              smsHref ? "hover:bg-[var(--card-hover)] text-[var(--foreground)]" : "opacity-40 pointer-events-none text-[var(--muted)]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="flex-1 truncate">{smsHref ? `Text ${prospectPhone}` : "No phone on file"}</span>
          </a>
          <a
            href={mailHref}
            onClick={() => setOpen(false)}
            aria-disabled={!mailHref}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              mailHref ? "hover:bg-[var(--card-hover)] text-[var(--foreground)]" : "opacity-40 pointer-events-none text-[var(--muted)]"
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="flex-1 truncate">{mailHref ? `Email ${prospectEmail}` : "No email on file"}</span>
          </a>
          <p className="text-[10px] text-[var(--muted)] px-3 pt-1.5 pb-1 leading-snug">
            Opens your phone or mail app with the link pre-filled.
          </p>
        </div>
      )}
    </div>
  );
}
