import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { getCustomerProfileStatus } from "@/lib/a2p";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: reg } = await supabaseAdmin
    .from("a2p_registrations")
    .select("customer_profile_sid, status")
    .eq("user_id", params.id)
    .maybeSingle();
  if (!reg?.customer_profile_sid) {
    return NextResponse.json({ error: "No registration to sync" }, { status: 404 });
  }

  try {
    const remote = await getCustomerProfileStatus(reg.customer_profile_sid);
    let nextStatus = reg.status;
    let approvedAt: string | null = null;
    let errorMessage: string | null = null;

    if (remote.status === "twilio-approved" || remote.status === "approved") {
      nextStatus = "profile_approved";
      approvedAt = new Date().toISOString();
    } else if (remote.status === "twilio-rejected" || remote.status === "rejected") {
      nextStatus = "profile_rejected";
      errorMessage = remote.failure_reason || "Twilio rejected the profile";
    } else if (remote.status === "pending-review" || remote.status === "in-review") {
      nextStatus = "profile_pending";
    }

    await supabaseAdmin
      .from("a2p_registrations")
      .update({
        status: nextStatus,
        error_message: errorMessage,
        approved_at: approvedAt ?? undefined,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", params.id);

    return NextResponse.json({ ok: true, twilio_status: remote.status, status: nextStatus });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
