import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Action callback for completed Dial verbs. Marks voice_calls.status and
// closes voicemail_callbacks rows. Both inbound and outbound calls hit
// this — the recording arrives separately via /recording-status.

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const callSid = (form.get("CallSid") || "").toString();
  const dialStatus = (form.get("DialCallStatus") || "").toString();
  const dialDuration = parseInt((form.get("DialCallDuration") || "0").toString(), 10) || 0;

  if (!callSid) return new NextResponse("<Response><Hangup/></Response>", { headers: { "Content-Type": "text/xml" } });

  const finalStatus = dialStatus === "completed" || dialStatus === "answered" ? "completed" : (dialStatus || "ended");

  await supabaseAdmin
    .from("voice_calls")
    .update({
      status: finalStatus,
      ended_at: new Date().toISOString(),
      recording_duration_sec: dialDuration > 0 ? dialDuration : undefined,
    })
    .eq("twilio_call_sid", callSid);

  // Close out any matching voicemail_callbacks row created by the forward route.
  await supabaseAdmin
    .from("voicemail_callbacks")
    .update({
      status: finalStatus,
      ended_at: new Date().toISOString(),
      recording_duration_sec: dialDuration > 0 ? dialDuration : undefined,
    })
    .eq("twilio_call_sid", callSid);

  // Twilio expects TwiML in response (it's an `action` URL). Empty hangup
  // tells the parent leg the dial is done.
  return new NextResponse("<Response><Hangup/></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
