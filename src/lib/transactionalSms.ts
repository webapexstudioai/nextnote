// Send transactional SMS to a NextNote user's verified personal phone.
// Used for "send to my phone" actions (prospect details, generated site URLs,
// AI receptionist numbers, etc.) and any other in-product notification that
// should land on the owner's cell.
//
// The sender number is one shared NextNote-owned Twilio number set in the
// NEXTNOTE_TRANSACTIONAL_FROM env var. Texting our own users from a single
// platform-owned sender is transactional/relational use, so we don't need
// per-user A2P 10DLC registration.
//
// All sends are also logged to sms_messages with from_number='nextnote' so
// there's a paper trail without colliding with the agency-number SMS rows.

import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";

export type TransactionalSmsResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; code?: "not_configured" | "no_phone" | "carrier_error" };

export async function sendTransactionalSmsToUser(
  userId: string,
  body: string,
): Promise<TransactionalSmsResult> {
  const sender = process.env.NEXTNOTE_TRANSACTIONAL_FROM;
  if (!sender) {
    return { ok: false, error: "SMS notifications aren't configured.", code: "not_configured" };
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("verified_personal_phone")
    .eq("id", userId)
    .maybeSingle();
  const phone = user?.verified_personal_phone;
  if (!phone) {
    return {
      ok: false,
      error: "Verify your personal phone in Settings to enable Send to my phone.",
      code: "no_phone",
    };
  }

  let sid: string;
  try {
    const res = await sendSms({ from: sender, to: phone, body });
    sid = res.sid;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Carrier rejected the message";
    return { ok: false, error: message, code: "carrier_error" };
  }

  await supabaseAdmin.from("sms_messages").insert({
    user_id: userId,
    from_number: "nextnote",
    to_number: phone,
    body,
    direction: "outbound",
    status: "sent",
    twilio_sid: sid,
  });

  return { ok: true, sid };
}
