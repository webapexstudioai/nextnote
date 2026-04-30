import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Twilio fires this for two events on a voicedrop callback:
//   1. <Dial action=...> — when the dial leg completes (DialCallStatus, DialCallDuration)
//   2. recordingStatusCallback — when the recording is ready (RecordingUrl, RecordingDuration)
// Both arrive against the same parent CallSid, so we upsert into the same row.

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parentSid = (form.get("CallSid") || "").toString();
  if (!parentSid) {
    return new NextResponse("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const recordingUrl = (form.get("RecordingUrl") || "").toString();
  const recordingDuration = (form.get("RecordingDuration") || "").toString();
  const dialStatus = (form.get("DialCallStatus") || "").toString();
  const dialDuration = (form.get("DialCallDuration") || "").toString();

  const update: Record<string, unknown> = {};

  if (recordingUrl) {
    // Twilio appends ".mp3" to render the recording in browsers.
    update.recording_url = `${recordingUrl}.mp3`;
    const dur = parseInt(recordingDuration, 10);
    if (Number.isFinite(dur)) update.recording_duration_sec = dur;
  }

  if (dialStatus) {
    update.status = dialStatus === "completed" ? "completed" : dialStatus;
    update.ended_at = new Date().toISOString();
    const dur = parseInt(dialDuration, 10);
    if (Number.isFinite(dur) && !update.recording_duration_sec) {
      update.recording_duration_sec = dur;
    }
  }

  if (Object.keys(update).length > 0) {
    await supabaseAdmin
      .from("voicemail_callbacks")
      .update(update)
      .eq("twilio_call_sid", parentSid);
  }

  // <Dial action> expects TwiML — return an empty response so the call ends cleanly.
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}
