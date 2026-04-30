import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";
import { normalizePhone } from "@/lib/twilio";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: phoneRow }, { data: userRow }] = await Promise.all([
    supabaseAdmin
      .from("user_phone_numbers")
      .select("phone_number, label, twilio_sid, created_at, trial_started_at, trial_ends_at")
      .eq("user_id", userId)
      .eq("purpose", "agency")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("forward_to_number, phone_trial_used_at")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    agency_phone: phoneRow ?? null,
    forward_to_number: userRow?.forward_to_number ?? null,
    trial_used: !!userRow?.phone_trial_used_at,
  });
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { forward_to_number } = await req.json();
  if (forward_to_number !== null && typeof forward_to_number !== "string") {
    return NextResponse.json({ error: "forward_to_number must be a string or null" }, { status: 400 });
  }

  let normalized: string | null = null;
  if (forward_to_number) {
    normalized = normalizePhone(forward_to_number);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ forward_to_number: normalized })
    .eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, forward_to_number: normalized });
}

// Release the agency number — Twilio release + DB delete. No refund.
export async function DELETE() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: phoneRow } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("id, twilio_sid")
    .eq("user_id", userId)
    .eq("purpose", "agency")
    .maybeSingle();
  if (!phoneRow) return NextResponse.json({ error: "No agency number" }, { status: 404 });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token && phoneRow.twilio_sid) {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${phoneRow.twilio_sid}.json`,
      {
        method: "DELETE",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      }
    ).catch(() => {});
  }

  await supabaseAdmin.from("user_phone_numbers").delete().eq("id", phoneRow.id);
  return NextResponse.json({ ok: true });
}
