import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/twilio";

const STOP_WORDS = new Set([
  "stop", "stopall", "stop all", "unsubscribe", "cancel", "end", "quit", "revoke",
]);

function looksLikeStop(body: string): boolean {
  const trimmed = body.trim().toLowerCase();
  return STOP_WORDS.has(trimmed);
}

// Twilio posts inbound SMS as form-urlencoded. We map back to a user via the
// To number (one of their purchased numbers) and to a prospect via From.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fromRaw = (form.get("From") || "").toString();
  const toRaw = (form.get("To") || "").toString();
  const body = (form.get("Body") || "").toString();
  const sid = (form.get("MessageSid") || "").toString();

  const from = normalizePhone(fromRaw) || fromRaw;
  const to = normalizePhone(toRaw) || toRaw;

  if (!from || !to) {
    return new NextResponse("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  // 1. Identify which user owns the receiving number.
  const { data: ownedNumber } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("user_id, phone_number")
    .eq("phone_number", to)
    .maybeSingle();
  if (!ownedNumber) {
    return new NextResponse("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
  }
  const userId = ownedNumber.user_id as string;

  // 2. Find prospect by phone (try both raw and normalized — agency-entered
  // phones are stored as the user typed them).
  const { data: prospects } = await supabaseAdmin
    .from("prospects")
    .select("id, phone")
    .eq("user_id", userId);
  const prospect = (prospects ?? []).find((p) => {
    const norm = normalizePhone(p.phone || "");
    return norm === from || p.phone === fromRaw;
  });

  // 3. Log the inbound message regardless of prospect match.
  await supabaseAdmin.from("sms_messages").insert({
    user_id: userId,
    prospect_id: prospect?.id ?? null,
    direction: "inbound",
    body,
    to_number: to,
    from_number: from,
    twilio_sid: sid,
    status: "received",
    sent_at: new Date().toISOString(),
  });

  // 4. STOP keyword → opt out + halt all active enrollments for that prospect.
  if (looksLikeStop(body)) {
    await supabaseAdmin
      .from("sms_opt_outs")
      .upsert(
        { user_id: userId, phone_number: prospect?.phone || fromRaw, source: "stop_keyword" },
        { onConflict: "user_id,phone_number" }
      );
    if (prospect) {
      await supabaseAdmin
        .from("sms_sequence_enrollments")
        .update({ status: "halted_stop", next_send_at: null, completed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("prospect_id", prospect.id)
        .eq("status", "active");
    }
    // TwiML reply confirming opt-out (good practice, also keeps us compliant).
    return new NextResponse(
      `<Response><Message>You've been unsubscribed and won't get more messages. Reply START to opt back in.</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }

  // 5. Any other reply → halt active enrollments so we stop nagging.
  if (prospect) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_reply", next_send_at: null, completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("prospect_id", prospect.id)
      .eq("status", "active");
  }

  return new NextResponse("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
}
