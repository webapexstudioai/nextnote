import { NextResponse } from "next/server";
import { requireUser } from "@/lib/crm";
import { supabaseAdmin } from "@/lib/supabase";

// Bulk Lead Qualifier listing — joins all of a user's prospects with
// their cached audit (if any) so the qualifier page can rank prospects
// by score, surface unaudited ones, and offer a one-click bulk run.

interface ProspectWithAudit {
  prospect_id: string;
  prospect_name: string;
  prospect_phone: string | null;
  prospect_email: string | null;
  prospect_website: string | null;
  prospect_status: string;
  prospect_service: string | null;
  audit: {
    id: string;
    status: "pending" | "complete" | "failed";
    overall_score: number | null;
    ai_receptionist_score: number | null;
    website_score: number | null;
    confidence: "low" | "medium" | "high" | null;
    summary: string;
    top_hook: string | null;
    completed_at: string | null;
    expires_at: string | null;
    error_message: string | null;
  } | null;
}

interface ProspectRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  service: string | null;
  status: string;
}

interface AuditRow {
  id: string;
  prospect_id: string;
  status: string;
  overall_score: number | null;
  ai_receptionist_score: number | null;
  website_score: number | null;
  confidence: string | null;
  pitch_hooks: unknown;
  signals: unknown;
  completed_at: string | null;
  expires_at: string | null;
  error_message: string | null;
}

function extractSummary(signals: unknown): string {
  if (!signals || typeof signals !== "object") return "";
  const obj = signals as { summary?: unknown };
  return typeof obj.summary === "string" ? obj.summary : "";
}

function extractTopHook(pitchHooks: unknown): string | null {
  if (!Array.isArray(pitchHooks) || pitchHooks.length === 0) return null;
  const first = pitchHooks[0] as { hook?: unknown };
  return typeof first?.hook === "string" ? first.hook : null;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: prospects, error: pErr }, { data: audits, error: aErr }] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select("id, name, phone, email, website, service, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("lead_audits")
      .select("id, prospect_id, status, overall_score, ai_receptionist_score, website_score, confidence, pitch_hooks, signals, completed_at, expires_at, error_message")
      .eq("user_id", userId),
  ]);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const auditByProspect = new Map<string, AuditRow>();
  for (const row of (audits ?? []) as AuditRow[]) {
    auditByProspect.set(row.prospect_id, row);
  }

  const items: ProspectWithAudit[] = ((prospects ?? []) as ProspectRow[]).map((p) => {
    const a = auditByProspect.get(p.id) ?? null;
    return {
      prospect_id: p.id,
      prospect_name: p.name,
      prospect_phone: p.phone,
      prospect_email: p.email,
      prospect_website: p.website,
      prospect_service: p.service,
      prospect_status: p.status,
      audit: a
        ? {
            id: a.id,
            status: (a.status as "pending" | "complete" | "failed") ?? "pending",
            overall_score: a.overall_score,
            ai_receptionist_score: a.ai_receptionist_score,
            website_score: a.website_score,
            confidence: (a.confidence as "low" | "medium" | "high" | null) ?? null,
            summary: extractSummary(a.signals),
            top_hook: extractTopHook(a.pitch_hooks),
            completed_at: a.completed_at,
            expires_at: a.expires_at,
            error_message: a.error_message,
          }
        : null,
    };
  });

  return NextResponse.json({ items });
}
