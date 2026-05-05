import { supabaseAdmin } from "@/lib/supabase";
import {
  deductCredits,
  getBalance,
  LEAD_AUDIT_CREDITS,
  addCredits,
  DailyCapExceededError,
} from "@/lib/credits";
import { fetchReviews } from "./outscraperReviews";
import { fetchPageSpeed } from "./pagespeed";
import { synthesize } from "./synthesize";
import type {
  AuditRecord,
  AuditSignals,
  AuditSynthesis,
  PageSpeedBundle,
  ReviewsBundle,
} from "./types";

// Audits expire after 30 days. After that the next read triggers a
// fresh paid run — businesses change (new website, new reviews) and
// we'd rather force a refresh than serve stale "this is a great lead"
// scores when the prospect already converted (with a competitor).
const AUDIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface ProspectRow {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  service: string | null;
}

interface AuditRow {
  id: string;
  user_id: string;
  prospect_id: string;
  ai_receptionist_score: number | null;
  website_score: number | null;
  overall_score: number | null;
  confidence: string | null;
  pitch_hooks: unknown;
  signals: unknown;
  raw_reviews: unknown;
  raw_pagespeed: unknown;
  status: string;
  error_message: string | null;
  credits_charged: number;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

// `signals` jsonb column is persisted as { summary, items } so we can
// keep the synthesis summary on the same row without a dedicated text
// column. Unpack it carefully — older rows may be null or shaped
// differently.
function unpackSignals(raw: unknown): {
  summary: string;
  items: AuditRecord["signals"];
} {
  if (!raw || typeof raw !== "object") return { summary: "", items: [] };
  const obj = raw as { summary?: unknown; items?: unknown };
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  const items = Array.isArray(obj.items)
    ? (obj.items as AuditRecord["signals"])
    : [];
  return { summary, items };
}

function rowToRecord(row: AuditRow): AuditRecord {
  const { summary, items } = unpackSignals(row.signals);
  return {
    id: row.id,
    user_id: row.user_id,
    prospect_id: row.prospect_id,
    ai_receptionist_score: row.ai_receptionist_score ?? 0,
    website_score: row.website_score ?? 0,
    overall_score: row.overall_score ?? 0,
    confidence: (row.confidence as AuditRecord["confidence"]) ?? "low",
    signals: items,
    pitch_hooks: Array.isArray(row.pitch_hooks)
      ? (row.pitch_hooks as AuditRecord["pitch_hooks"])
      : [],
    summary,
    status: (row.status as AuditRecord["status"]) ?? "pending",
    error_message: row.error_message,
    credits_charged: row.credits_charged,
    created_at: row.created_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    raw_reviews: (row.raw_reviews as ReviewsBundle | null) ?? null,
    raw_pagespeed: (row.raw_pagespeed as PageSpeedBundle | null) ?? null,
  };
}

export async function getLatestAudit(
  userId: string,
  prospectId: string,
): Promise<AuditRecord | null> {
  const { data } = await supabaseAdmin
    .from("lead_audits")
    .select("*")
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .maybeSingle();
  if (!data) return null;
  return rowToRecord(data as AuditRow);
}

function isFresh(row: AuditRow): boolean {
  if (row.status !== "complete") return false;
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

export interface RunAuditResult {
  audit: AuditRecord;
  cached: boolean;
}

export class AuditError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;
  constructor(code: string, message: string, status: number, extra?: Record<string, unknown>) {
    super(message);
    this.name = "AuditError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export async function runAudit(
  userId: string,
  prospectId: string,
  opts: { force?: boolean } = {},
): Promise<RunAuditResult> {
  // 1. Load prospect (scoped to user — RLS-by-app-code).
  const { data: prospectData, error: prospectErr } = await supabaseAdmin
    .from("prospects")
    .select("id, user_id, name, phone, email, website, address, service")
    .eq("id", prospectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (prospectErr || !prospectData) {
    throw new AuditError("not_found", "Prospect not found", 404);
  }
  const prospect = prospectData as ProspectRow;

  // 2. Cache lookup. If a fresh complete audit exists and !force, return it.
  const { data: existing } = await supabaseAdmin
    .from("lead_audits")
    .select("*")
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .maybeSingle();
  const existingRow = (existing as AuditRow | null) ?? null;

  if (!opts.force && existingRow && isFresh(existingRow)) {
    return { audit: rowToRecord(existingRow), cached: true };
  }

  // 3. Pre-flight credit check (don't charge until we have at least one signal).
  const balance = await getBalance(userId);
  if (balance < LEAD_AUDIT_CREDITS) {
    throw new AuditError("insufficient_credits", "Not enough credits to run an audit", 402, {
      required: LEAD_AUDIT_CREDITS,
      balance,
    });
  }

  // 4. Mark pending so concurrent calls don't double-fetch.
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUDIT_TTL_MS);
  const { data: pendingRow, error: upsertErr } = await supabaseAdmin
    .from("lead_audits")
    .upsert(
      {
        user_id: userId,
        prospect_id: prospectId,
        status: "pending",
        error_message: null,
        ai_receptionist_score: null,
        website_score: null,
        overall_score: null,
        confidence: null,
        pitch_hooks: null,
        signals: null,
        raw_reviews: null,
        raw_pagespeed: null,
        snapshot_phone: prospect.phone,
        snapshot_website: prospect.website,
        snapshot_address: prospect.address,
        snapshot_name: prospect.name,
        credits_charged: 0,
        created_at: now.toISOString(),
        completed_at: null,
        expires_at: null,
      },
      { onConflict: "user_id,prospect_id" },
    )
    .select("id")
    .single();
  if (upsertErr || !pendingRow) {
    throw new AuditError("db_error", `Could not create audit row: ${upsertErr?.message ?? "unknown"}`, 500);
  }
  const auditId = (pendingRow as { id: string }).id;

  // 5. Fetch external signals in parallel. Either failing alone is OK.
  const [reviews, pagespeed] = await Promise.all([
    fetchReviews({
      name: prospect.name,
      address: prospect.address,
      website: prospect.website,
    }),
    fetchPageSpeed(prospect.website),
  ]);

  // If BOTH bundles failed AND there's no website on file, we have
  // nothing to synthesize from — fail cleanly without charging.
  const haveAnySignal = reviews.ok || pagespeed.ok;
  if (!haveAnySignal) {
    const errMsg =
      reviews.error || pagespeed.error || "No signals could be fetched";
    await supabaseAdmin
      .from("lead_audits")
      .update({
        status: "failed",
        error_message: errMsg,
        raw_reviews: reviews,
        raw_pagespeed: pagespeed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", auditId);
    throw new AuditError("no_signals", `Couldn't gather any signals: ${errMsg}`, 502);
  }

  // 6. Charge credits. Use audit ID as the idempotency ref.
  try {
    await deductCredits(userId, LEAD_AUDIT_CREDITS, {
      reason: "lead_audit",
      refId: auditId,
      metadata: { prospect_id: prospectId, prospect_name: prospect.name },
    });
  } catch (err) {
    // Daily cap — surface a 429-ish error and clean up the pending row.
    if (err instanceof DailyCapExceededError) {
      await supabaseAdmin
        .from("lead_audits")
        .update({
          status: "failed",
          error_message: "Daily credit cap reached",
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditId);
      throw new AuditError("daily_cap", err.message, 429);
    }
    await supabaseAdmin
      .from("lead_audits")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Charge failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", auditId);
    throw new AuditError("charge_failed", "Could not charge credits", 500);
  }

  // 7. Synthesize. If Claude fails, refund.
  const signals: AuditSignals = {
    reviews,
    pagespeed,
    prospect: {
      name: prospect.name,
      phone: prospect.phone,
      website: prospect.website,
      address: prospect.address,
      industry: prospect.service,
    },
  };

  let synthesis: AuditSynthesis;
  try {
    synthesis = await synthesize(signals);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Synthesis failed";
    // Refund — Claude couldn't produce a usable result.
    await addCredits(userId, LEAD_AUDIT_CREDITS, {
      reason: "lead_audit_refund",
      refId: `${auditId}-refund`,
      metadata: { prospect_id: prospectId, error: errMsg },
    });
    await supabaseAdmin
      .from("lead_audits")
      .update({
        status: "failed",
        error_message: errMsg,
        raw_reviews: reviews,
        raw_pagespeed: pagespeed,
        completed_at: new Date().toISOString(),
        credits_charged: 0,
      })
      .eq("id", auditId);
    throw new AuditError("synthesis_failed", errMsg, 502);
  }

  // 8. Persist the completed synthesis. We stash `summary` into the
  // signals JSON so we don't need a separate column.
  const completedAt = new Date().toISOString();
  const persistedSignals = {
    summary: synthesis.summary,
    items: synthesis.signals,
  };

  const { error: updateErr } = await supabaseAdmin
    .from("lead_audits")
    .update({
      status: "complete",
      ai_receptionist_score: synthesis.ai_receptionist_score,
      website_score: synthesis.website_score,
      overall_score: synthesis.overall_score,
      confidence: synthesis.confidence,
      pitch_hooks: synthesis.pitch_hooks,
      signals: persistedSignals,
      raw_reviews: reviews,
      raw_pagespeed: pagespeed,
      credits_charged: LEAD_AUDIT_CREDITS,
      completed_at: completedAt,
      expires_at: expiresAt.toISOString(),
      error_message: null,
    })
    .eq("id", auditId);
  if (updateErr) {
    throw new AuditError("db_error", `Could not save audit: ${updateErr.message}`, 500);
  }

  return {
    audit: {
      id: auditId,
      user_id: userId,
      prospect_id: prospectId,
      ai_receptionist_score: synthesis.ai_receptionist_score,
      website_score: synthesis.website_score,
      overall_score: synthesis.overall_score,
      confidence: synthesis.confidence,
      signals: synthesis.signals,
      pitch_hooks: synthesis.pitch_hooks,
      summary: synthesis.summary,
      status: "complete",
      error_message: null,
      credits_charged: LEAD_AUDIT_CREDITS,
      created_at: now.toISOString(),
      completed_at: completedAt,
      expires_at: expiresAt.toISOString(),
      raw_reviews: reviews,
      raw_pagespeed: pagespeed,
    },
    cached: false,
  };
}
