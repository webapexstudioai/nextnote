import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

const VALID_OUTCOMES = ["answered", "no_answer", "voicemail", "busy", "wrong_number"];
const TRIGGER_OUTCOMES = new Set(["no_answer", "voicemail", "busy"]);

async function pickFromNumber(userId: string, preferred: string | null): Promise<string | null> {
  // SMS can only originate from agency-purpose Twilio numbers; verified
  // caller IDs are voice-only. If preferred is set but isn't actually an
  // agency number for this user, fall through to the lookup so we never
  // stamp an unsendable from_number on an enrollment.
  if (preferred) {
    const { data } = await supabaseAdmin
      .from("user_phone_numbers")
      .select("phone_number")
      .eq("user_id", userId)
      .eq("phone_number", preferred)
      .eq("purpose", "agency")
      .maybeSingle();
    if (data) return preferred;
  }
  const { data: owned } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("phone_number")
    .eq("user_id", userId)
    .eq("purpose", "agency")
    .order("created_at", { ascending: false })
    .limit(1);
  if (owned && owned[0]) return owned[0].phone_number as string;
  return null;
}

async function maybeEnroll(userId: string, prospectId: string, outcome: string) {
  if (!TRIGGER_OUTCOMES.has(outcome)) return null;
  const { data: seq } = await supabaseAdmin
    .from("sms_sequences")
    .select("id, default_from_number")
    .eq("user_id", userId)
    .eq("trigger", outcome)
    .eq("enabled", true)
    .maybeSingle();
  if (!seq) return null;

  const { data: firstStep } = await supabaseAdmin
    .from("sms_sequence_steps")
    .select("step_order, delay_hours")
    .eq("sequence_id", seq.id)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstStep) return null;

  const fromNumber = await pickFromNumber(userId, seq.default_from_number);
  if (!fromNumber) return null;

  // Skip if already opted-out (need prospect's phone).
  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("phone")
    .eq("id", prospectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (prospect?.phone) {
    const { data: optOut } = await supabaseAdmin
      .from("sms_opt_outs")
      .select("phone_number")
      .eq("user_id", userId)
      .eq("phone_number", prospect.phone)
      .maybeSingle();
    if (optOut) return null;
  }

  const nextSendAt = new Date(Date.now() + firstStep.delay_hours * 3600 * 1000).toISOString();
  const { data: enrollment, error } = await supabaseAdmin
    .from("sms_sequence_enrollments")
    .insert({
      user_id: userId,
      prospect_id: prospectId,
      sequence_id: seq.id,
      from_number: fromNumber,
      current_step_order: firstStep.step_order,
      status: "active",
      next_send_at: nextSendAt,
    })
    .select()
    .single();
  // Unique-index violation = already active enrollment in this sequence — silently skip.
  if (error) return null;
  return enrollment;
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { prospect_id, outcome, notes } = await req.json();
  if (!prospect_id || typeof prospect_id !== "string") {
    return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  }
  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: `outcome must be one of ${VALID_OUTCOMES.join(", ")}` }, { status: 400 });
  }

  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id")
    .eq("id", prospect_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("prospect_call_logs")
    .insert({
      user_id: userId,
      prospect_id,
      outcome,
      notes: typeof notes === "string" ? notes : null,
    })
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "insert failed" }, { status: 500 });

  const enrollment = await maybeEnroll(userId, prospect_id, outcome);

  return NextResponse.json({ call_log: data, enrollment });
}

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prospectId = req.nextUrl.searchParams.get("prospect_id");
  if (!prospectId) return NextResponse.json({ error: "prospect_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("prospect_call_logs")
    .select("id, outcome, notes, created_at")
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ call_logs: data ?? [] });
}
