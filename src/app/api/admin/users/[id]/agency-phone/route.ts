import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { releaseAgencyNumber } from "@/lib/agencyPhone";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, email, agency_name, forward_to_number, phone_trial_used_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: phoneRow } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("phone_number, label, twilio_sid, created_at, trial_started_at, trial_ends_at")
    .eq("user_id", params.id)
    .eq("purpose", "agency")
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      agencyName: user.agency_name,
      forwardToNumber: user.forward_to_number,
      trialUsed: !!user.phone_trial_used_at,
    },
    agencyPhone: phoneRow ?? null,
  });
}

// Release the user's agency number — admin-side, no refund logic since
// admin assignments aren't tied to a Stripe charge.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: phoneRow } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("id, twilio_sid, phone_number")
    .eq("user_id", params.id)
    .eq("purpose", "agency")
    .maybeSingle();
  if (!phoneRow) return NextResponse.json({ error: "No agency number on file" }, { status: 404 });

  const result = await releaseAgencyNumber({
    userId: params.id,
    twilioSid: phoneRow.twilio_sid,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Release failed" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "agency_phone.release", params.id, {
    phoneNumber: phoneRow.phone_number,
    twilioSid: phoneRow.twilio_sid,
  });

  return NextResponse.json({ success: true });
}
