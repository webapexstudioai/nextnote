import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";
import { getBalance, deductCredits, RATE_CREDITS_PER_SMS } from "@/lib/credits";
import {
  sendSms,
  normalizePhone,
  renderTemplate,
  twilioConfigured,
} from "@/lib/twilio";
import { getAgencyTrialState } from "@/lib/agencyPhone";

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!twilioConfigured()) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
  }

  const { prospect_id, template_id, body: rawBody, from_number, call_log_id } = await req.json();

  if (!prospect_id || typeof prospect_id !== "string") {
    return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  }
  if (!from_number || typeof from_number !== "string") {
    return NextResponse.json({ error: "from_number required" }, { status: 400 });
  }
  if (!template_id && (!rawBody || typeof rawBody !== "string")) {
    return NextResponse.json({ error: "template_id or body required" }, { status: 400 });
  }

  // 1. Verify prospect ownership + load fields used for placeholder rendering.
  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id, user_id, name, phone, contact_name")
    .eq("id", prospect_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const to = normalizePhone(prospect.phone || "");
  if (!to) return NextResponse.json({ error: "Prospect has no valid phone number" }, { status: 400 });

  // Opt-out check — never send to a prospect who replied STOP.
  const { data: optOut } = await supabaseAdmin
    .from("sms_opt_outs")
    .select("phone_number")
    .eq("user_id", userId)
    .or(`phone_number.eq.${to},phone_number.eq.${prospect.phone}`)
    .maybeSingle();
  if (optOut) {
    return NextResponse.json({ error: "Prospect has opted out of SMS (replied STOP)" }, { status: 403 });
  }

  // 2. Resolve from_number — must be an agency-purpose Twilio number.
  // Verified caller IDs are voice-only (carriers won't route SMS through them);
  // AI receptionist numbers are tied to a specific prospect's business.
  const { data: ownedNumber } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("phone_number, trial_ends_at")
    .eq("user_id", userId)
    .eq("phone_number", from_number)
    .eq("purpose", "agency")
    .maybeSingle();
  if (!ownedNumber) {
    return NextResponse.json(
      { error: "from_number must be your agency phone line. Visit Agency Phone to set one up." },
      { status: 400 }
    );
  }

  // Block sends once the trial ends. Number stays in Twilio during the grace
  // period so inbound calls don't bounce, but outbound features require the
  // user to convert to paid. Keep ($5) → trial_ends_at clears in webhook.
  const trial = getAgencyTrialState({
    trialEndsAt: ownedNumber.trial_ends_at,
    hasRow: true,
  });
  if (trial.kind === "grace" || trial.kind === "expired") {
    return NextResponse.json(
      {
        error: "Your free phone trial ended. Keep your number for $5 to continue sending SMS.",
        trial_state: trial.kind,
      },
      { status: 402 }
    );
  }

  // 3. Resolve body — from template (rendered) or raw.
  let templateRow: { id: string; body: string } | null = null;
  if (template_id) {
    const { data } = await supabaseAdmin
      .from("sms_templates")
      .select("id, body")
      .eq("id", template_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    templateRow = data;
  }

  // Sender info for {my_name} / {my_agency}.
  const { data: sender } = await supabaseAdmin
    .from("users")
    .select("name, agency_name")
    .eq("id", userId)
    .maybeSingle();

  const sourceBody = templateRow ? templateRow.body : (rawBody as string);
  const renderedBody = renderTemplate(sourceBody, {
    prospect_name: prospect.name,
    contact_name: prospect.contact_name,
    my_name: sender?.name || "",
    my_agency: sender?.agency_name || "",
  });

  // 4. Credit check.
  const balance = await getBalance(userId);
  if (balance < RATE_CREDITS_PER_SMS) {
    return NextResponse.json(
      { error: "Insufficient credits", required: RATE_CREDITS_PER_SMS, balance },
      { status: 402 }
    );
  }

  // 5. Insert message row first so we have an ID for the status callback.
  const { data: message, error: insertErr } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      user_id: userId,
      prospect_id: prospect.id,
      template_id: templateRow?.id ?? null,
      direction: "outbound",
      body: renderedBody,
      to_number: to,
      from_number,
      status: "queued",
      call_log_id: call_log_id ?? null,
    })
    .select()
    .single();

  if (insertErr || !message) {
    return NextResponse.json({ error: insertErr?.message || "DB insert failed" }, { status: 500 });
  }

  // 6. Send via Twilio with status callback pointing back to us.
  const origin = req.nextUrl.origin;
  const statusCallback = `${origin}/api/sms/status?id=${message.id}`;

  try {
    const result = await sendSms({
      from: from_number,
      to,
      body: renderedBody,
      statusCallback,
    });

    await supabaseAdmin
      .from("sms_messages")
      .update({
        twilio_sid: result.sid,
        status: result.status || "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", message.id);

    await deductCredits(userId, RATE_CREDITS_PER_SMS, {
      reason: "sms_send",
      refId: message.id,
      metadata: { to, from: from_number, template_id: templateRow?.id ?? null },
    });

    return NextResponse.json({
      message_id: message.id,
      twilio_sid: result.sid,
      status: result.status,
      body: renderedBody,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Twilio send failed";
    await supabaseAdmin
      .from("sms_messages")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", message.id);
    return NextResponse.json({ error: errorMessage, message_id: message.id }, { status: 500 });
  }
}
