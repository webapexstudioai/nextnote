"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Loader2, RefreshCcw, AlertCircle, ExternalLink, Check, X } from "lucide-react";
import type { AuditRecord } from "@/lib/leadAudit/types";

// Inlined to keep this client component out of `@/lib/credits` (which transitively
// pulls `supabaseAdmin` and crashes in the browser with "supabaseKey is required").
// Mirror of `LEAD_AUDIT_CREDITS` in src/lib/credits.ts.
const LEAD_AUDIT_CREDITS = 50;

// Lead Qualifier audit card — shown inside DetailPanel for any prospect.
// Calls /api/leads/audit GET on mount to fetch a cached audit, and
// POST when the user clicks "Run audit" or "Re-run".

interface Props {
  prospectId: string;
  prospectName: string;
  hasWebsite: boolean;
  hasPhone: boolean;
  onInsufficientCredits?: () => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function scoreBand(s: number): { label: string; cls: string } {
  if (s >= 75) return { label: "Strong fit", cls: "text-emerald-400" };
  if (s >= 40) return { label: "Moderate fit", cls: "text-amber-400" };
  return { label: "Weak fit", cls: "text-zinc-400" };
}

function ScoreRing({ score, label, sub }: { score: number; label: string; sub: string }) {
  const band = scoreBand(score);
  const stroke = score >= 75 ? "#34d399" : score >= 40 ? "#fbbf24" : "#71717a";
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[72px] w-[72px]">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle cx="36" cy="36" r={radius} stroke="#27272a" strokeWidth="6" fill="none" />
          <circle
            cx="36"
            cy="36"
            r={radius}
            stroke={stroke}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-[var(--foreground)]">{score}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-medium text-[var(--foreground)]">{label}</div>
        <div className={`text-[10px] ${band.cls}`}>{sub}</div>
      </div>
    </div>
  );
}

export default function LeadAuditCard({
  prospectId,
  prospectName,
  hasWebsite,
  hasPhone,
  onInsufficientCredits,
}: Props) {
  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/audit?prospect_id=${encodeURIComponent(prospectId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setAudit(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAudit(force = false) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && onInsufficientCredits) {
          onInsufficientCredits();
          return;
        }
        throw new Error(data.error ?? "Audit failed");
      }
      setAudit(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  }

  const isComplete = audit && audit.status === "complete";
  const isStale = audit && audit.expires_at && new Date(audit.expires_at).getTime() < Date.now();

  // Empty state — no audit ever run.
  if (loading) {
    return (
      <div>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Lead Qualifier</h3>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Lead Qualifier</h3>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-violet-500/10 p-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Score this prospect for AI Receptionist + Website fit
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Pulls real reviews, audits their website speed, and surfaces pitch hooks
                you can use on the cold call. {LEAD_AUDIT_CREDITS} credits per audit.
              </p>
              {!hasPhone && !hasWebsite && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Heads up — no phone or website on file means low-confidence results.
                </p>
              )}
              <button
                onClick={() => runAudit(false)}
                disabled={running}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-400 disabled:opacity-50"
              >
                {running ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Running audit…</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> Run lead audit</>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Failed audit — surface error + retry.
  if (audit.status === "failed") {
    return (
      <div>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Lead Qualifier</h3>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
          <div className="flex items-start gap-2 text-[11px] text-rose-300">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{audit.error_message ?? "Audit failed"}</span>
          </div>
          <button
            onClick={() => runAudit(true)}
            disabled={running}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Complete — full result panel.
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Lead Qualifier</h3>
        <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
          <span>
            Audited {formatRelative(audit.completed_at)} · Confidence{" "}
            <span
              className={
                audit.confidence === "high"
                  ? "text-emerald-400"
                  : audit.confidence === "medium"
                  ? "text-amber-400"
                  : "text-zinc-400"
              }
            >
              {audit.confidence}
            </span>
          </span>
          <button
            onClick={() => runAudit(true)}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 hover:bg-[var(--card)] disabled:opacity-50"
            title={`Re-run audit (${LEAD_AUDIT_CREDITS} credits)`}
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            Re-run
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
        {/* Score rings */}
        <div className="flex items-center justify-around gap-2">
          <ScoreRing score={audit.overall_score} label="Overall" sub={scoreBand(audit.overall_score).label} />
          <div className="h-12 w-px bg-[var(--border)]" />
          <ScoreRing
            score={audit.ai_receptionist_score}
            label="AI Receptionist"
            sub={scoreBand(audit.ai_receptionist_score).label}
          />
          <ScoreRing score={audit.website_score} label="Website" sub={scoreBand(audit.website_score).label} />
        </div>

        {/* Summary */}
        {audit.summary && (
          <p className="text-xs leading-relaxed text-[var(--foreground)] border-l-2 border-violet-500/40 pl-3">
            {audit.summary}
          </p>
        )}

        {/* Pitch hooks — the action-ready part */}
        {audit.pitch_hooks.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
              Pitch hooks for {prospectName.split(" ")[0]}
            </h4>
            <div className="space-y-2">
              {audit.pitch_hooks.map((p, i) => {
                const tag =
                  p.category === "ai_receptionist"
                    ? { label: "Receptionist", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
                    : p.category === "website"
                    ? { label: "Website", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
                    : { label: "Both", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" };
                return (
                  <div key={i} className="rounded-md border border-[var(--border)] bg-[var(--background)] p-2.5">
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${tag.cls}`}>
                        {tag.label}
                      </span>
                      <p className="text-xs leading-relaxed text-[var(--foreground)]">{p.hook}</p>
                    </div>
                    {p.evidence && (
                      <p className="mt-1.5 ml-[68px] text-[10px] text-[var(--muted)] italic">{p.evidence}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signal evidence */}
        {audit.signals.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Signals</h4>
            <ul className="space-y-1">
              {audit.signals.map((s, i) => {
                const Icon = s.weight === "positive" ? Check : s.weight === "negative" ? X : null;
                const iconCls =
                  s.weight === "positive"
                    ? "text-emerald-400"
                    : s.weight === "negative"
                    ? "text-rose-400"
                    : "text-zinc-500";
                return (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    {Icon ? (
                      <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${iconCls}`} />
                    ) : (
                      <span className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[var(--foreground)]">{s.label}</span>
                      {s.detail && (
                        <span className="text-[var(--muted)]"> — {s.detail}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Source links — let the user audit the audit. */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border)]">
          {audit.raw_pagespeed?.final_url && (
            <a
              href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(audit.raw_pagespeed.final_url)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              View Lighthouse report <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {audit.raw_reviews && audit.raw_reviews.total_reviews !== null && (
            <span className="text-[10px] text-[var(--muted)]">
              {audit.raw_reviews.total_reviews} reviews · {audit.raw_reviews.average_rating?.toFixed(1) ?? "?"} avg
            </span>
          )}
        </div>

        {isStale && isComplete && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-300">
            <AlertCircle className="h-3 w-3" />
            <span>This audit is more than 30 days old — re-run for fresh signals.</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
