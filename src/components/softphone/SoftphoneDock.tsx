"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Mic, MicOff, X, Hash, DollarSign, Briefcase, Mail, CalendarClock, Sparkles } from "lucide-react";
import { useSoftphone, type ActiveCall, type ProspectPreview } from "@/context/SoftphoneProvider";

function formatDuration(startedAt: number | null): string {
  if (!startedAt) return "0:00";
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatNumber(num: string): string {
  const cleaned = num.replace(/^\+1/, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return num;
}

export default function SoftphoneDock() {
  const { call, answer, hangup, reject, toggleMute, sendDigit, callError } = useSoftphone();
  const [showDialpad, setShowDialpad] = useState(false);
  const [, force] = useState(0);

  // Tick every second while in-progress so the duration label updates.
  useEffect(() => {
    if (call?.status !== "in-progress") return;
    const i = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [call?.status]);

  if (!call) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] w-[340px] rounded-2xl border border-[rgba(232,85,61,0.25)] bg-[#101018] shadow-2xl shadow-black/50 backdrop-blur">
      <CallHeader call={call} />
      <CallBody call={call} />

      {showDialpad && call.status === "in-progress" && (
        <Dialpad onDigit={sendDigit} onClose={() => setShowDialpad(false)} />
      )}

      <div className="flex items-center justify-center gap-3 border-t border-white/5 px-4 py-3">
        {call.status === "incoming" && (
          <>
            <ControlButton variant="danger" onClick={reject} label="Decline">
              <PhoneOff className="h-5 w-5" />
            </ControlButton>
            <ControlButton variant="accept" onClick={answer} label="Answer">
              <Phone className="h-5 w-5" />
            </ControlButton>
          </>
        )}

        {call.status === "ringing-out" && (
          <ControlButton variant="danger" onClick={hangup} label="Cancel">
            <PhoneOff className="h-5 w-5" />
          </ControlButton>
        )}

        {call.status === "in-progress" && (
          <>
            <ControlButton
              variant={call.muted ? "active" : "ghost"}
              onClick={toggleMute}
              label={call.muted ? "Unmute" : "Mute"}
            >
              {call.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </ControlButton>
            <ControlButton
              variant={showDialpad ? "active" : "ghost"}
              onClick={() => setShowDialpad((s) => !s)}
              label="Dialpad"
            >
              <Hash className="h-5 w-5" />
            </ControlButton>
            <ControlButton variant="danger" onClick={hangup} label="Hang up">
              <PhoneOff className="h-5 w-5" />
            </ControlButton>
          </>
        )}

        {call.status === "ended" && (
          <span className="text-xs text-neutral-500">
            {callError ? `Call dropped: ${callError}` : "Call ended · summary will appear in Calls"}
          </span>
        )}
      </div>
    </div>
  );
}

function CallHeader({ call }: { call: ActiveCall }) {
  const Icon =
    call.direction === "inbound"
      ? PhoneIncoming
      : PhoneOutgoing;
  const label =
    call.status === "incoming"
      ? "Incoming call"
      : call.status === "ringing-out"
        ? "Calling…"
        : call.status === "in-progress"
          ? "On call"
          : "Call ended";

  const accent =
    call.status === "incoming" || call.status === "in-progress"
      ? "text-[#ff8a6a]"
      : "text-neutral-400";

  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${accent}`}>
        <span className={`relative inline-flex h-2 w-2 rounded-full ${call.status === "incoming" ? "bg-[#e8553d]" : "bg-neutral-500"}`}>
          {call.status === "incoming" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-[#e8553d]/70" />
          )}
        </span>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      {call.status === "in-progress" && (
        <span className="font-mono text-xs text-neutral-400">{formatDuration(call.startedAt)}</span>
      )}
    </div>
  );
}

function CallBody({ call }: { call: ActiveCall }) {
  const display = call.prospectName || formatNumber(call.remoteNumber);
  const subline = call.prospectName ? formatNumber(call.remoteNumber) : null;
  const preview = call.prospectPreview;

  return (
    <div className="px-4 pb-3">
      <div className="text-lg font-semibold tracking-tight text-neutral-100">{display}</div>
      {subline && <div className="mt-0.5 text-xs text-neutral-500">{subline}</div>}
      {preview && <ProspectInlineCard preview={preview} />}
      {call.prospectId && (
        <a
          href={`/dashboard/prospects?focus=${call.prospectId}`}
          className="mt-2 inline-block text-[11px] text-[#ff8a6a] hover:underline"
        >
          Open full file →
        </a>
      )}
    </div>
  );
}

function ProspectInlineCard({ preview }: { preview: ProspectPreview }) {
  const status = preview.status;
  const statusTone =
    status === "Closed"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
      : status === "Booked"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : status === "Qualified"
          ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
          : status === "Contacted"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-sky-500/30 bg-sky-500/10 text-sky-300";

  const dealValueNum =
    typeof preview.dealValue === "string"
      ? parseFloat(preview.dealValue)
      : preview.dealValue;
  const showDeal = typeof dealValueNum === "number" && !isNaN(dealValueNum) && dealValueNum > 0;

  const lastApptLabel = preview.lastAppointment
    ? new Date(preview.lastAppointment.scheduledAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        {status && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>
            {status}
          </span>
        )}
        {preview.contactName && preview.contactName !== preview.name && (
          <span className="truncate text-[11px] text-neutral-400">via {preview.contactName}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-[11px] text-neutral-300">
        {preview.service && (
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate">{preview.service}</span>
          </div>
        )}
        {showDeal && (
          <div className="flex items-center gap-1.5 text-emerald-300">
            <DollarSign className="h-3 w-3 shrink-0" />
            <span>{Number(dealValueNum).toLocaleString()}</span>
          </div>
        )}
        {preview.email && (
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{preview.email}</span>
          </div>
        )}
        {lastApptLabel && (
          <div className="flex items-center gap-1.5 text-neutral-400">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span>
              Last appt {lastApptLabel}
              {preview.lastAppointment?.outcome ? ` · ${preview.lastAppointment.outcome}` : ""}
            </span>
          </div>
        )}
      </div>

      {preview.lastCall?.oneLine && (
        <div className="flex items-start gap-1.5 rounded-md border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.06)] px-2 py-1.5 text-[11px] leading-snug text-[#ff8a6a]">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{preview.lastCall.oneLine}</span>
        </div>
      )}

      {preview.notes && (
        <div className="line-clamp-2 text-[11px] italic leading-snug text-neutral-500">
          “{preview.notes.trim()}”
        </div>
      )}
    </div>
  );
}

function Dialpad({ onDigit, onClose }: { onDigit: (d: string) => void; onClose: () => void }) {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];
  return (
    <div className="border-t border-white/5 px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
        <span>Send tones</span>
        <button onClick={onClose} className="hover:text-neutral-300">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {rows.flat().map((d) => (
          <button
            key={d}
            onClick={() => onDigit(d)}
            className="rounded-md border border-neutral-800 bg-neutral-900 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:border-[rgba(232,85,61,0.3)]"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ControlButtonProps {
  variant: "accept" | "danger" | "ghost" | "active";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function ControlButton({ variant, onClick, label, children }: ControlButtonProps) {
  const styles = {
    accept: "bg-emerald-500 text-white hover:bg-emerald-400",
    danger: "bg-[#e8553d] text-white hover:bg-[#d44429]",
    ghost: "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800",
    active: "bg-[rgba(232,85,61,0.15)] text-[#ff8a6a] border border-[rgba(232,85,61,0.3)]",
  }[variant];

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${styles}`}
    >
      {children}
    </button>
  );
}
