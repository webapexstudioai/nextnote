import { NextResponse } from "next/server";
import { requireUser } from "@/lib/crm";
import { supabaseAdmin } from "@/lib/supabase";

const RESUBMITTABLE = new Set([
  "not_started",
  "admin_rejected",
  "profile_rejected",
  "brand_rejected",
  "campaign_rejected",
]);

export async function POST() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("user_business_profiles")
    .select("tcpa_attested, legal_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile || !profile.tcpa_attested || !profile.legal_name) {
    return NextResponse.json(
      { error: "Complete your business profile first." },
      { status: 412 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("a2p_registrations")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing && !RESUBMITTABLE.has(existing.status)) {
    return NextResponse.json(
      { error: "Already submitted", status: existing.status },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await supabaseAdmin.from("a2p_registrations").upsert(
    {
      user_id: userId,
      status: "pending_admin_review",
      submitted_at: nowIso,
      error_message: null,
      admin_notes: null,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending_admin_review" });
}
