import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { purchaseAgencyNumber } from "@/lib/agencyPhone";

// Admin-comped agency phone assignment. Buys a Twilio number on the master
// account (we eat the ~$1.15/mo cost) and wires it to the target user with
// no Stripe charge and no trial expiry — they keep it until admin releases.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
  }
  const friendlyName = typeof body.friendlyName === "string"
    ? body.friendlyName.trim().slice(0, 80)
    : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 400) : "";

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, email, agency_name")
    .eq("id", params.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: existing } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("id, phone_number")
    .eq("user_id", params.id)
    .eq("purpose", "agency")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `User already has ${existing.phone_number}. Release it first.` },
      { status: 409 },
    );
  }

  const result = await purchaseAgencyNumber({
    userId: params.id,
    phoneNumber,
    friendlyName: friendlyName || `${target.agency_name ?? "NextNote Agency"} (admin comp)`,
    trial: false,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await logAdminAction(guard.userId, "agency_phone.assign", params.id, {
    phoneNumber: result.phoneNumber,
    twilioSid: result.twilioSid,
    note,
    friendlyName,
  });

  return NextResponse.json({
    success: true,
    phoneNumber: result.phoneNumber,
    twilioSid: result.twilioSid,
  });
}
