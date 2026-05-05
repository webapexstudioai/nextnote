"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  Target,
  ShieldAlert,
  ListChecks,
  Smile,
  Meh,
  Frown,
} from "lucide-react";
import PresenceToggle from "@/components/softphone/PresenceToggle";

interface CallSummary {
  pain_points?: string[];
  weaknesses?: string[];
  buying_signals?: string[];
  objections?: string[];
  recommended_next_steps?: string[];
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
  one_line_takeaway?: string;
}

interface VoiceCall {
  id: string;
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  status: string;
  recordingUrl: string | null;
  recordingDurationSec: number | null;
  transcript: string | null;
  aiSummary: CallSummary | null;
  aiSummaryGeneratedAt: string | null;
  startedAt: string;
  endedAt: string | null;
  prospect: { id: string; name: string | null; contact_name: string | null } | null;
}

function formatPhone(num: string): string {
  const c = num.replace(/^\+1/, "").replace(/\D/g, "");
  if (c.length === 10) return `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}`;
  return num;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(sec: number | null): string {
  if (!sec || sec < 1) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CallsClient() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/voice/calls");
      if (!res.ok) return;
      const json = await res.json();
      setCalls(json.calls || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 10_000);
    return () => clearInterval(i);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return calls;
    return calls.filter((c) => c.direction === filter);
  }, [calls, filter]);

  const stats = useMemo(() => {
    return {
      total: calls.length,
      inbound: calls.filter((c) => c.direction === "inbound").length,
      outbound: calls.filter((c) => c.direction === "outbound").length,
      withSummary: calls.filter((c) => c.aiSummary?.one_line_takeaway).length,
    };
  }, [calls]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Phone className="h-6 w-6 text-[var(--accent)]" />
            Calls
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Every inbound and outbound call, with an AI breakdown of what the prospect cares about.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <PresenceToggle />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total calls" value={stats.total} />
        <Stat label="Inbound" value={stats.inbound} />
        <Stat label="Outbound" value={stats.outbound} />
        <Stat label="AI summaries" value={stats.withSummary} />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-neutral-900 bg-[rgba(255,255,255,0.02)] p-1 text-xs w-fit">
        {(["all", "inbound", "outbound"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
              filter === f
                ? "bg-[rgba(232,85,61,0.12)] text-[#ff8a6a]"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filtered.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              expanded={expanded === call.id}
              onToggle={() => setExpanded((prev) => (prev === call.id ? null : call.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-[rgba(255,255,255,0.02)] p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function CallCard({
  call,
  expanded,
  onToggle,
}: {
  call: VoiceCall;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isInbound = call.direction === "inbound";
  const remoteNumber = isInbound ? call.fromNumber : call.toNumber;
  const display = call.prospect?.name || formatPhone(remoteNumber);
  const Icon = isInbound ? PhoneIncoming : PhoneOutgoing;
  const summary = call.aiSummary;
  const hasSummary = !!summary?.one_line_takeaway;

  return (
    <div className="rounded-xl border border-neutral-900 bg-[rgba(255,255,255,0.02)] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-4 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isInbound
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-[rgba(232,85,61,0.12)] text-[#ff8a6a]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-neutral-100">{display}</span>
            {call.prospect?.name && (
              <span className="text-xs text-neutral-500">{formatPhone(remoteNumber)}</span>
            )}
            <SentimentBadge sentiment={summary?.sentiment} />
          </div>
          {hasSummary ? (
            <p className="mt-1 text-sm text-neutral-300 leading-snug line-clamp-2">
              {summary?.one_line_takeaway}
            </p>
          ) : (
            <p className="mt-1 text-xs text-neutral-500 italic">
              {call.recordingUrl ? "AI summary coming soon…" : "No recording captured."}
            </p>
          )}
        </div>

        <div className="text-right text-xs text-neutral-500 shrink-0">
          <div>{formatTime(call.startedAt)}</div>
          <div className="mt-0.5 font-mono">{formatDuration(call.recordingDurationSec)}</div>
        </div>

        {expanded ? (
          <ChevronDown className="h-4 w-4 text-neutral-500 shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-500 shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-neutral-900 bg-[rgba(0,0,0,0.2)] px-4 py-4 space-y-4">
          {call.recordingUrl && (
            <audio controls preload="none" className="w-full" src={`/api/voice/calls/${call.id}/recording`} />
          )}

          {hasSummary ? (
            <SummaryGrid summary={summary!} />
          ) : (
            <p className="text-sm text-neutral-500">
              The AI summary is generated within ~30 seconds after the call ends. Refresh in a bit.
            </p>
          )}

          {call.transcript && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
                View transcript
              </summary>
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-neutral-900 bg-black/40 p-3 text-xs text-neutral-300 font-sans">
                {call.transcript}
              </pre>
            </details>
          )}

          {call.prospect?.id && (
            <a
              href={`/dashboard/prospects?focus=${call.prospect.id}`}
              className="inline-block text-xs text-[#ff8a6a] hover:underline"
            >
              Open prospect →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryGrid({ summary }: { summary: CallSummary }) {
  const sections: { icon: typeof Lightbulb; label: string; items: string[]; tone: string }[] = [
    {
      icon: Lightbulb,
      label: "Pain points",
      items: summary.pain_points || [],
      tone: "text-amber-300 border-amber-500/20 bg-amber-500/5",
    },
    {
      icon: AlertTriangle,
      label: "Weaknesses",
      items: summary.weaknesses || [],
      tone: "text-orange-300 border-orange-500/20 bg-orange-500/5",
    },
    {
      icon: Target,
      label: "Buying signals",
      items: summary.buying_signals || [],
      tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5",
    },
    {
      icon: ShieldAlert,
      label: "Objections",
      items: summary.objections || [],
      tone: "text-red-300 border-red-500/20 bg-red-500/5",
    },
    {
      icon: ListChecks,
      label: "Recommended next steps",
      items: summary.recommended_next_steps || [],
      tone: "text-violet-300 border-violet-500/20 bg-violet-500/5",
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.06)] px-3 py-2.5 text-sm text-neutral-200">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-[#ff8a6a]" />
        <span>{summary.one_line_takeaway}</span>
      </div>

      {sections.length === 0 ? (
        <p className="text-xs text-neutral-500 italic">
          The AI didn&rsquo;t find anything actionable in this call.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map(({ icon: Icon, label, items, tone }) => (
            <div key={label} className={`rounded-lg border px-3 py-2.5 ${tone}`}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-90">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-neutral-200 leading-relaxed">
                {items.map((it, idx) => (
                  <li key={idx} className="flex gap-1.5">
                    <span className="opacity-50">•</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment?: CallSummary["sentiment"] }) {
  if (!sentiment) return null;
  const cfg = {
    positive: { Icon: Smile, label: "Positive", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
    neutral: { Icon: Meh, label: "Neutral", cls: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20" },
    mixed: { Icon: Meh, label: "Mixed", cls: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
    negative: { Icon: Frown, label: "Negative", cls: "bg-red-500/10 text-red-300 border-red-500/20" },
  }[sentiment];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function LoadingList() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-neutral-900 bg-[rgba(255,255,255,0.02)]"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-neutral-900 bg-[rgba(255,255,255,0.02)] p-10 text-center">
      <Phone className="mx-auto h-10 w-10 text-neutral-700" />
      <p className="mt-3 text-sm font-medium text-neutral-300">No calls yet</p>
      <p className="mt-1 text-xs text-neutral-500">
        Toggle &ldquo;Available for calls&rdquo; on, then call your agency number to test it out.
      </p>
    </div>
  );
}
