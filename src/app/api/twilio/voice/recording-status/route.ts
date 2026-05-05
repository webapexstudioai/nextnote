import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzeCall } from "@/lib/callAnalysis";

// Twilio POSTs here when a recording becomes available (status=completed).
// We persist the URL and kick off transcription + AI summary asynchronously.
// Don't block Twilio's webhook on the OpenAI/Anthropic round trip — return
// 200 fast and process in the background.

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const recordingUrl = (form.get("RecordingUrl") || "").toString();
  const recordingSid = (form.get("RecordingSid") || "").toString();
  const recordingStatus = (form.get("RecordingStatus") || "").toString();
  const callSid = (form.get("CallSid") || "").toString();
  const parentCallSid = (form.get("ParentCallSid") || "").toString();
  const durationStr = (form.get("RecordingDuration") || "0").toString();
  const duration = parseInt(durationStr, 10) || 0;

  if (recordingStatus !== "completed" || !recordingUrl) {
    return NextResponse.json({ ok: true, ignored: recordingStatus });
  }

  // The CallSid Twilio sends is the LEG of the recorded call. For outbound
  // calls placed via <Client>, that's the parent SID in our voice_calls
  // table. For inbound forwards, the parent sid Twilio gives us matches the
  // inbound SID we logged. Try both.
  const candidates = [callSid, parentCallSid].filter(Boolean);

  const { data: voiceCall } = await supabaseAdmin
    .from("voice_calls")
    .select("id, user_id, recording_sid")
    .in("twilio_call_sid", candidates)
    .limit(1)
    .maybeSingle();

  if (!voiceCall) {
    // Could be a recording for a non-tracked call; nothing to do.
    return NextResponse.json({ ok: true, no_match: true });
  }

  // Idempotency: if we already processed this recording, exit.
  if (voiceCall.recording_sid && voiceCall.recording_sid === recordingSid) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await supabaseAdmin
    .from("voice_calls")
    .update({
      recording_url: recordingUrl,
      recording_sid: recordingSid,
      recording_duration_sec: duration,
    })
    .eq("id", voiceCall.id);

  // Fire-and-forget the analysis. Errors are logged but don't fail the webhook.
  analyzeCall(voiceCall.id).catch((err) => {
    console.error("call analysis failed", { id: voiceCall.id, err });
  });

  return NextResponse.json({ ok: true });
}
