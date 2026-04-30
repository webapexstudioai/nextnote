import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/twilio";

// Twilio Voice webhook for agency-line numbers. Looks up the user that owns
// the receiving number and dials their forward_to_number cell. If no
// forward target is configured, Twilio reads a fallback message.
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

// Window in which an inbound call is treated as a voicedrop callback. After
// this many days we assume any inbound is unrelated to a past campaign.
const CALLBACK_MATCH_WINDOW_DAYS = 14;

async function logVoicedropCallback(opts: {
  userId: string;
  from: string;
  to: string;
  callSid: string;
  forwardTo: string | null;
}): Promise<{ matched: boolean; campaignName: string | null; prospectName: string | null }> {
  const since = new Date(Date.now() - CALLBACK_MATCH_WINDOW_DAYS * 86400 * 1000).toISOString();

  // Find the most recent drop where this caller was the recipient and our
  // number was the sender. That's the drop they're responding to.
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

  if (!drop) return { matched: false, campaignName: null, prospectName: null };

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

  // Auto-advance the prospect to Contacted on first callback. Only bump
  // from earlier stages so we don't regress someone already further along.
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
  };
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
    }
  }

  if (!forwardTo) {
    return twiml(`<Say>The agency owner is unavailable right now. Please send a text message and they will get back to you.</Say><Hangup/>`);
  }

  // Twilio's status callback records the duration + recording URL for the
  // outer call once it ends — that's how we close out the callback row.
  const origin = req.nextUrl.origin;
  const statusCallback = `${origin}/api/twilio/voicedrop-callback-status`;

  if (whisper) {
    // Use <Number url=...> so a TwiML Bin runs only on the forwarded leg —
    // gives the user a quick whisper of who's calling before the call connects.
    const whisperBin = `${origin}/api/twilio/voicedrop-whisper?text=${encodeURIComponent(whisper)}`;
    return twiml(
      `<Dial timeout="20" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(statusCallback)}" action="${escapeXml(statusCallback)}">` +
        `<Number url="${escapeXml(whisperBin)}">${escapeXml(forwardTo)}</Number>` +
      `</Dial>`,
    );
  }

  return twiml(
    `<Dial timeout="20" action="${escapeXml(statusCallback)}">${escapeXml(forwardTo)}</Dial>`,
  );
}
