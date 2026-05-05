import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/twilio";

// TwiML target for browser-initiated outbound calls. The Voice SDK calls
// `Device.connect({ params: { To, ProspectId } })` and Twilio POSTs to this
// route. We dial the prospect from the user's agency number, attach
// recording, and log the call to voice_calls.

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const toRaw = (form.get("To") || "").toString();
  const prospectId = (form.get("ProspectId") || "").toString() || null;
  const callerIdentity = (form.get("From") || "").toString();
  const callSid = (form.get("CallSid") || "").toString();
  const to = normalizePhone(toRaw);

  if (!to) {
    return twiml(`<Say>The number is invalid. Goodbye.</Say><Hangup/>`);
  }

  // Identity is "user-{uuid}" (see softphoneIdentityFor)
  const userId = callerIdentity.startsWith("client:user-")
    ? callerIdentity.slice("client:user-".length)
    : callerIdentity.startsWith("user-")
      ? callerIdentity.slice("user-".length)
      : null;

  if (!userId) {
    return twiml(`<Say>Unrecognized caller. Goodbye.</Say><Hangup/>`);
  }

  // Use the user's agency phone number as the caller ID.
  const { data: agencyNumber } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("phone_number")
    .eq("user_id", userId)
    .eq("purpose", "agency")
    .limit(1)
    .maybeSingle();

  if (!agencyNumber) {
    return twiml(`<Say>You haven't set up an agency phone number yet. Goodbye.</Say><Hangup/>`);
  }

  // Log the outbound call.
  if (callSid) {
    await supabaseAdmin.from("voice_calls").insert({
      user_id: userId,
      prospect_id: prospectId,
      direction: "outbound",
      from_number: agencyNumber.phone_number,
      to_number: to,
      twilio_call_sid: callSid,
      status: "in_progress",
    });
  }

  const origin = req.nextUrl.origin;
  const recordingCallback = `${origin}/api/twilio/voice/recording-status`;
  const callStatusCallback = `${origin}/api/twilio/voice/call-status`;

  return twiml(
    `<Dial callerId="${escapeXml(agencyNumber.phone_number)}" timeout="30" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}" action="${escapeXml(callStatusCallback)}">` +
      `<Number>${escapeXml(to)}</Number>` +
    `</Dial>`,
  );
}
