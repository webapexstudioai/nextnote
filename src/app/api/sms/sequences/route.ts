import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

const VALID_TRIGGERS = ["no_answer", "voicemail", "busy"];

interface StepInput {
  step_order?: number;
  delay_hours?: number;
  template_id?: string;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: sequences, error } = await supabaseAdmin
    .from("sms_sequences")
    .select("id, name, trigger, default_from_number, enabled, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (sequences ?? []).map((s) => s.id);
  let stepsBySeq: Record<string, Array<{ id: string; step_order: number; delay_hours: number; template_id: string }>> = {};
  if (ids.length > 0) {
    const { data: steps } = await supabaseAdmin
      .from("sms_sequence_steps")
      .select("id, sequence_id, step_order, delay_hours, template_id")
      .in("sequence_id", ids)
      .order("step_order", { ascending: true });
    stepsBySeq = (steps ?? []).reduce<typeof stepsBySeq>((acc, s) => {
      const list = acc[s.sequence_id] ?? [];
      list.push({ id: s.id, step_order: s.step_order, delay_hours: s.delay_hours, template_id: s.template_id });
      acc[s.sequence_id] = list;
      return acc;
    }, {});
  }

  return NextResponse.json({
    sequences: (sequences ?? []).map((s) => ({ ...s, steps: stepsBySeq[s.id] ?? [] })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { name, trigger, default_from_number, enabled, steps } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (trigger && !VALID_TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: `trigger must be one of ${VALID_TRIGGERS.join(", ")}` }, { status: 400 });
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: "at least one step required" }, { status: 400 });
  }

  // Validate every template belongs to the user.
  const templateIds = steps.map((s: StepInput) => s.template_id).filter(Boolean) as string[];
  const { data: tplRows } = await supabaseAdmin
    .from("sms_templates")
    .select("id")
    .eq("user_id", userId)
    .in("id", templateIds);
  const validTplIds = new Set((tplRows ?? []).map((r) => r.id));
  for (const s of steps as StepInput[]) {
    if (!s.template_id || !validTplIds.has(s.template_id)) {
      return NextResponse.json({ error: "Invalid template_id in steps" }, { status: 400 });
    }
  }

  const { data: seq, error: seqErr } = await supabaseAdmin
    .from("sms_sequences")
    .insert({
      user_id: userId,
      name: name.trim(),
      trigger: trigger || null,
      default_from_number: default_from_number || null,
      enabled: enabled !== false,
    })
    .select()
    .single();
  if (seqErr || !seq) {
    return NextResponse.json({ error: seqErr?.message || "Insert failed" }, { status: 500 });
  }

  const stepRows = (steps as StepInput[]).map((s, idx) => ({
    sequence_id: seq.id,
    step_order: typeof s.step_order === "number" ? s.step_order : idx,
    delay_hours: Math.max(0, Math.floor(s.delay_hours ?? 0)),
    template_id: s.template_id!,
  }));
  const { error: stepErr } = await supabaseAdmin.from("sms_sequence_steps").insert(stepRows);
  if (stepErr) {
    await supabaseAdmin.from("sms_sequences").delete().eq("id", seq.id);
    return NextResponse.json({ error: stepErr.message }, { status: 500 });
  }

  return NextResponse.json({ sequence: { ...seq, steps: stepRows } });
}
