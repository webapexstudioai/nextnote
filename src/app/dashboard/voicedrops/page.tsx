"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Loader2,
  Megaphone,
  Mic,
  ExternalLink,
  Clock,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  audioUrl: string;
  fromNumber: string;
  totalDrops: number;
  successfulDrops: number;
  failedDrops: number;
  creditsSpent: number;
  callbackCount: number;
  callbackRate: number;
  createdAt: string;
}

interface Callback {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  prospectId: string | null;
  prospectName: string | null;
  fromNumber: string;
  toNumber: string;
  recordingUrl: string | null;
  recordingDurationSec: number | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

type Tab = "campaigns" | "callbacks";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 30 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceDropsPage() {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, kRes] = await Promise.all([
        fetch("/api/voicemail/campaigns"),
        fetch("/api/voicemail/callbacks"),
      ]);
      const cJson = await cRes.json();
      const kJson = await kRes.json();
      if (!cRes.ok) throw new Error(cJson.error || "Failed to load campaigns");
      if (!kRes.ok) throw new Error(kJson.error || "Failed to load callbacks");
      setCampaigns(cJson.campaigns || []);
      setCallbacks(kJson.callbacks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalCallbacks = useMemo(() => callbacks.length, [callbacks]);
  const totalCampaigns = useMemo(() => campaigns.length, [campaigns]);
  const aggregateRate = useMemo(() => {
    const drops = campaigns.reduce((s, c) => s + c.successfulDrops, 0);
    if (drops === 0) return 0;
    const cb = campaigns.reduce((s, c) => s + c.callbackCount, 0);
    return Math.round((cb / drops) * 100);
  }, [campaigns]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[var(--accent)]" />
            Voicedrops
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track every campaign you send and every prospect that calls back.
          </p>
        </div>
        <Link
          href="/dashboard/prospects"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Mic className="w-4 h-4" />
          Send a new drop
        </Link>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Campaigns" value={totalCampaigns} icon={<Megaphone className="w-4 h-4" />} />
        <Stat label="Callbacks" value={totalCallbacks} icon={<PhoneIncoming className="w-4 h-4" />} />
        <Stat label="Callback rate" value={`${aggregateRate}%`} icon={<Phone className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] mb-4">
        <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")}>
          Campaigns
          <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">{totalCampaigns}</span>
        </TabButton>
        <TabButton active={tab === "callbacks"} onClick={() => setTab("callbacks")}>
          Callbacks
          <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">{totalCallbacks}</span>
        </TabButton>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[var(--muted-foreground)] animate-spin" />
        </div>
      ) : tab === "campaigns" ? (
        <CampaignsList campaigns={campaigns} />
      ) : (
        <CallbacksList callbacks={callbacks} onRefresh={load} />
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--accent)] text-[var(--foreground)]"
          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function CampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="w-10 h-10 text-[var(--muted-foreground)]" />}
        title="No campaigns yet"
        body="Pick prospects from your pipeline and send a voicedrop to see campaigns here."
      />
    );
  }
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          <tr>
            <th className="text-left px-4 py-3">Campaign</th>
            <th className="text-left px-4 py-3">Sent</th>
            <th className="text-right px-4 py-3">Drops</th>
            <th className="text-right px-4 py-3">Delivered</th>
            <th className="text-right px-4 py-3">Callbacks</th>
            <th className="text-right px-4 py-3">Rate</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--background)]/50">
              <td className="px-4 py-3">
                <div className="font-medium text-[var(--foreground)]">{c.name}</div>
                <div className="text-xs text-[var(--muted-foreground)] font-mono">{c.fromNumber}</div>
              </td>
              <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatRelative(c.createdAt)}</td>
              <td className="px-4 py-3 text-right">{c.totalDrops}</td>
              <td className="px-4 py-3 text-right">
                <span className="text-emerald-400">{c.successfulDrops}</span>
                {c.failedDrops > 0 && (
                  <span className="text-red-400 ml-1">/ {c.failedDrops} failed</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium text-[var(--accent)]">{c.callbackCount}</td>
              <td className="px-4 py-3 text-right">{c.callbackRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CallbacksList({ callbacks, onRefresh }: { callbacks: Callback[]; onRefresh: () => void }) {
  if (callbacks.length === 0) {
    return (
      <EmptyState
        icon={<PhoneOff className="w-10 h-10 text-[var(--muted-foreground)]" />}
        title="No callbacks yet"
        body="When a prospect calls back the NextNote number you sent from, the call shows up here — with attribution to the campaign and prospect."
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          onClick={onRefresh}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Refresh
        </button>
      </div>
      {callbacks.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--accent)]/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <PhoneIncoming className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium text-[var(--foreground)]">
                  {c.prospectName || "Unknown caller"}
                </span>
                <span className="text-xs font-mono text-[var(--muted-foreground)]">{c.fromNumber}</span>
                {c.prospectId && (
                  <Link
                    href={`/dashboard/prospects?focus=${c.prospectId}`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                  >
                    Open prospect
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)] flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelative(c.startedAt)}
                </span>
                {c.campaignName && (
                  <span className="inline-flex items-center gap-1">
                    <Megaphone className="w-3 h-3" />
                    {c.campaignName}
                  </span>
                )}
                {c.recordingDurationSec != null && (
                  <span>· {formatDuration(c.recordingDurationSec)} duration</span>
                )}
                <StatusPill status={c.status} />
              </div>
            </div>
            {c.recordingUrl && (
              <audio controls preload="none" src={c.recordingUrl} className="h-9">
                <track kind="captions" />
              </audio>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : status === "in_progress"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] py-16 px-6 text-center">
      <div className="inline-flex">{icon}</div>
      <h3 className="mt-3 text-base font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)] max-w-md mx-auto">{body}</p>
    </div>
  );
}
