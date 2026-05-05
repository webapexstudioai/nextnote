import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: profiles } = await supabaseAdmin
    .from("user_business_profiles")
    .select("user_id, legal_name, tcpa_attested, attested_at");

  const { data: regs } = await supabaseAdmin
    .from("a2p_registrations")
    .select("*");

  const userIds = (profiles || []).map((p) => p.user_id);
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email, agency_name")
    .in("id", userIds.length > 0 ? userIds : [""]);

  const regByUser = new Map((regs || []).map((r) => [r.user_id, r]));
  const userById = new Map((users || []).map((u) => [u.id, u]));

  const rows = (profiles || []).map((p) => {
    const reg = regByUser.get(p.user_id);
    const u = userById.get(p.user_id);
    return {
      user_id: p.user_id,
      email: u?.email || "",
      agency_name: u?.agency_name || null,
      legal_name: p.legal_name,
      profile_complete: !!p.tcpa_attested,
      a2p_status: reg?.status || "not_started",
      customer_profile_sid: reg?.customer_profile_sid || null,
      brand_sid: reg?.brand_sid || null,
      messaging_service_sid: reg?.messaging_service_sid || null,
      campaign_sid: reg?.campaign_sid || null,
      submitted_at: reg?.submitted_at || null,
      approved_at: reg?.approved_at || null,
      error_message: reg?.error_message || null,
      admin_notes: reg?.admin_notes || null,
      last_synced_at: reg?.last_synced_at || null,
    };
  });

  return NextResponse.json({ registrations: rows });
}
