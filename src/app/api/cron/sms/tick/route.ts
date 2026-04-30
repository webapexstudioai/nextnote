import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  sendSms,
  normalizePhone,
  renderTemplate,
  twilioConfigured,
} from "@/lib/twilio";
import { getBalance, deductCredits, RATE_CREDITS_PER_SMS } from "@/lib/credits";

export const maxDuration = 60;

const BATCH_LIMIT = 50;

async function authOk(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

async function processOne(enrollment: {
  id: string;
  user_id: string;
  prospect_id: string;
  sequence_id: string;
  from_number: string;
  current_step_order: number;
}): Promise<{ id: string; status: string; detail?: string }> {
  const { data: step } = await supabaseAdmin
    .from("sms_sequence_steps")
    .select("step_order, delay_hours, template_id")
    .eq("sequence_id", enrollment.sequence_id)
    .eq("step_order", enrollment.current_step_order)
    .maybeSingle();

  if (!step) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString(), next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "completed" };
  }

  // Load template + prospect + sender for placeholder rendering.
  const [{ data: tpl }, { data: prospect }, { data: sender }] = await Promise.all([
    supabaseAdmin
      .from("sms_templates")
      .select("id, body")
      .eq("id", step.template_id)
      .eq("user_id", enrollment.user_id)
      .maybeSingle(),
    supabaseAdmin
      .from("prospects")
      .select("id, name, phone, contact_name")
      .eq("id", enrollment.prospect_id)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("name, agency_name")
      .eq("id", enrollment.user_id)
      .maybeSingle(),
  ]);

  if (!tpl || !prospect) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_failed", last_error: "Template or prospect missing", next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "halted_failed", detail: "missing dependency" };
  }

  const to = normalizePhone(prospect.phone || "");
  if (!to) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_failed", last_error: "Invalid phone", next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "halted_failed", detail: "invalid phone" };
  }

  // Opt-out check (defensive — inbound webhook should already halt these).
  const { data: optOut } = await supabaseAdmin
    .from("sms_opt_outs")
    .select("phone_number")
    .eq("user_id", enrollment.user_id)
    .eq("phone_number", prospect.phone)
    .maybeSingle();
  if (optOut) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_stop", next_send_at: null, completed_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "halted_stop" };
  }

  // Credits.
  const balance = await getBalance(enrollment.user_id);
  if (balance < RATE_CREDITS_PER_SMS) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_failed", last_error: "Insufficient credits", next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "halted_failed", detail: "insufficient credits" };
  }

  const renderedBody = renderTemplate(tpl.body, {
    prospect_name: prospect.name,
    contact_name: prospect.contact_name,
    my_name: sender?.name || "",
    my_agency: sender?.agency_name || "",
  });

  const { data: message, error: insertErr } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      user_id: enrollment.user_id,
      prospect_id: enrollment.prospect_id,
      template_id: tpl.id,
      direction: "outbound",
      body: renderedBody,
      to_number: to,
      from_number: enrollment.from_number,
      status: "queued",
      enrollment_id: enrollment.id,
      step_order: step.step_order,
    })
    .select()
    .single();

  if (insertErr || !message) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_failed", last_error: insertErr?.message || "Insert failed", next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "halted_failed", detail: "db insert" };
  }

  const baseOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  const origin = baseOrigin.startsWith("http") ? baseOrigin : `https://${baseOrigin || "nextnote.to"}`;
  const statusCallback = `${origin}/api/sms/status?id=${message.id}`;

  try {
    const result = await sendSms({
      from: enrollment.from_number,
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
    await deductCredits(enrollment.user_id, RATE_CREDITS_PER_SMS, {
      reason: "sms_sequence",
      refId: message.id,
      metadata: { enrollment_id: enrollment.id, step_order: step.step_order },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Twilio send failed";
    await supabaseAdmin
      .from("sms_messages")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", message.id);
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "halted_failed", last_error: errorMessage, next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "halted_failed", detail: errorMessage };
  }

  // Schedule the next step (or complete).
  const { data: nextStep } = await supabaseAdmin
    .from("sms_sequence_steps")
    .select("step_order, delay_hours")
    .eq("sequence_id", enrollment.sequence_id)
    .gt("step_order", step.step_order)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextStep) {
    await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString(), next_send_at: null })
      .eq("id", enrollment.id);
    return { id: enrollment.id, status: "completed" };
  }

  const next = new Date(Date.now() + nextStep.delay_hours * 3600 * 1000).toISOString();
  await supabaseAdmin
    .from("sms_sequence_enrollments")
    .update({ current_step_order: nextStep.step_order, next_send_at: next })
    .eq("id", enrollment.id);
  return { id: enrollment.id, status: "advanced" };
}

export async function POST(req: NextRequest) {
  if (!(await authOk(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!twilioConfigured()) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("sms_sequence_enrollments")
    .select("id, user_id, prospect_id, sequence_id, from_number, current_step_order")
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .order("next_send_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const results = [];
  for (const enrollment of due) {
    const r = await processOne(enrollment);
    results.push(r);
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

// GET runs the same logic; some Vercel cron setups invoke via GET.
export async function GET(req: NextRequest) {
  return POST(req);
}
