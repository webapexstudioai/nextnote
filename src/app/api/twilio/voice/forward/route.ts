import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/twilio";
import { softphoneIdentityFor } from "@/lib/twilioAccessToken";

// Twilio Voice webhook for agency-line numbers. Looks up the user that owns
// the receiving number. If the user is currently "Available" (browser tab
// with an active heartbeat), the call rings their browser via <Client>.
// Otherwise it falls back to dialing their forward_to_number cell.

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

const CALLBACK_MATCH_WINDOW_DAYS = 14;

async function logVoicedropCallback(opts: {
  userId: string;
  from: string;
  to: string;
  callSid: string;
  forwardTo: string | null;
}): Promise<{ matched: boolean; campaignName: string | null; prospectName: string | null; prospectId: string | null }> {
  const since = new Date(Date.now() - CALLBACK_MATCH_WINDOW_DAYS * 86400 * 1000).toISOString();

  const { data: drop } = await supabaseAdmin
    .from("voicemail_drops")
    .select("campaign_id, prospect_id, prospect_name")
    .eq("user_id", opts.userId)
    .eq("to_number", opts.from)
    .eq("from_number", opts.to)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!drop) return { matched: false, campaignName: null, prospectName: null, prospectId: null };

  let campaignName: string | null = null;
  if (drop.campaign_id) {
    const { data: campaign } = await supabaseAdmin
      .from("voicemail_campaigns")
      .select("name")
      .eq("id", drop.campaign_id)
      .maybeSingle();
    campaignName = campaign?.name ?? null;
  }

  await supabaseAdmin.from("voicemail_callbacks").insert({
    user_id: opts.userId,
    campaign_id: drop.campaign_id ?? null,
    prospect_id: drop.prospect_id ?? null,
    prospect_name: drop.prospect_name ?? null,
    from_number: opts.from,
    to_number: opts.to,
    twilio_call_sid: opts.callSid,
    forwarded_to: opts.forwardTo,
    status: "in_progress",
  });

  if (drop.prospect_id) {
    await supabaseAdmin
      .from("prospects")
      .update({ status: "Contacted" })
      .eq("id", drop.prospect_id)
      .eq("user_id", opts.userId)
      .in("status", ["New"]);
  }

  return {
    matched: true,
    campaignName,
    prospectName: drop.prospect_name ?? null,
    prospectId: drop.prospect_id ?? null,
  };
}

async function isUserAvailable(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("phone_presence")
    .select("available_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  return new Date(data.available_until).getTime() > Date.now();
}

async function recordInboundVoiceCall(opts: {
  userId: string;
  prospectId: string | null;
  from: string;
  to: string;
  callSid: string;
}): Promise<void> {
  await supabaseAdmin.from("voice_calls").insert({
    user_id: opts.userId,
    prospect_id: opts.prospectId,
    direction: "inbound",
    from_number: opts.from,
    to_number: opts.to,
    twilio_call_sid: opts.callSid,
    status: "in_progress",
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const toRaw = (form.get("To") || "").toString();
  const fromRaw = (form.get("From") || "").toString();
  const callSid = (form.get("CallSid") || "").toString();
  const to = normalizePhone(toRaw) || toRaw;
  const from = normalizePhone(fromRaw) || fromRaw;

  if (!to) {
    return twiml(`<Say>This number is not configured. Goodbye.</Say><Hangup/>`);
  }

  const { data: ownedNumber } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("user_id, purpose")
    .eq("phone_number", to)
    .eq("purpose", "agency")
    .maybeSingle();

  if (!ownedNumber) {
    return twiml(`<Say>This number is not configured. Goodbye.</Say><Hangup/>`);
  }

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("forward_to_number")
    .eq("id", ownedNumber.user_id)
    .maybeSingle();

  const forwardTo = userRow?.forward_to_number ? normalizePhone(userRow.forward_to_number) : null;

  let prospectId: string | null = null;
  let whisper = "";
  if (from && callSid) {
    const result = await logVoicedropCallback({
      userId: ownedNumber.user_id,
      from,
      to,
      callSid,
      forwardTo,
    });
    if (result.matched) {
      const campaign = result.campaignName || "a recent voicedrop";
      const prospect = result.prospectName || "a prospect";
      whisper = `Callback from ${prospect} regarding ${campaign}. Press any key to accept.`;
      prospectId = result.prospectId;
    }
  }

  // Master voice_calls row for this inbound call.
  if (callSid) {
    await recordInboundVoiceCall({
      userId: ownedNumber.user_id,
      prospectId,
      from: from || fromRaw,
      to,
      callSid,
    });
  }

  const origin = req.nextUrl.origin;
  const recordingCallback = `${origin}/api/twilio/voice/recording-status`;
  const callStatusCallback = `${origin}/api/twilio/voice/call-status`;
  const browserAvailable = await isUserAvailable(ownedNumber.user_id);

  // --- Browser softphone path -------------------------------------------
  // If the user has the dashboard open with "Available" toggled on, ring
  // their browser. Recording happens on the parent call leg.
  if (browserAvailable) {
    const identity = softphoneIdentityFor(ownedNumber.user_id);
    return twiml(
      `<Dial timeout="25" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}" action="${escapeXml(callStatusCallback)}">` +
        `<Client>${escapeXml(identity)}</Client>` +
      `</Dial>`,
    );
  }

  // --- Cell phone fallback path -----------------------------------------
  if (!forwardTo) {
    return twiml(`<Say>The agency owner is unavailable right now. Please send a text message and they will get back to you.</Say><Hangup/>`);
  }

  if (whisper) {
    const whisperBin = `${origin}/api/twilio/voicedrop-whisper?text=${encodeURIComponent(whisper)}`;
    return twiml(
      `<Dial timeout="20" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}" action="${escapeXml(callStatusCallback)}">` +
        `<Number url="${escapeXml(whisperBin)}">${escapeXml(forwardTo)}</Number>` +
      `</Dial>`,
    );
  }

  return twiml(
    `<Dial timeout="20" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}" action="${escapeXml(callStatusCallback)}">${escapeXml(forwardTo)}</Dial>`,
  );
}
