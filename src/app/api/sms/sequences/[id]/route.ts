import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

const VALID_TRIGGERS = ["no_answer", "voicemail", "busy"];

interface StepInput {
  step_order?: number;
  delay_hours?: number;
  template_id?: string;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { name, trigger, default_from_number, enabled, steps } = body;

  // Confirm ownership.
  const { data: existing } = await supabaseAdmin
    .from("sms_sequences")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, string | boolean | null> = { updated_at: new Date().toISOString() };
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (trigger === null) update.trigger = null;
  else if (typeof trigger === "string") {
    if (!VALID_TRIGGERS.includes(trigger)) {
      return NextResponse.json({ error: `trigger must be one of ${VALID_TRIGGERS.join(", ")}` }, { status: 400 });
    }
    update.trigger = trigger;
  }
  if (default_from_number === null) update.default_from_number = null;
  else if (typeof default_from_number === "string") update.default_from_number = default_from_number;
  if (typeof enabled === "boolean") update.enabled = enabled;

  const { error: updErr } = await supabaseAdmin
    .from("sms_sequences")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Replace steps if provided.
  if (Array.isArray(steps)) {
    if (steps.length === 0) {
      return NextResponse.json({ error: "at least one step required" }, { status: 400 });
    }
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
    await supabaseAdmin.from("sms_sequence_steps").delete().eq("sequence_id", id);
    const stepRows = (steps as StepInput[]).map((s, idx) => ({
      sequence_id: id,
      step_order: typeof s.step_order === "number" ? s.step_order : idx,
      delay_hours: Math.max(0, Math.floor(s.delay_hours ?? 0)),
      template_id: s.template_id!,
    }));
    const { error: stepErr } = await supabaseAdmin.from("sms_sequence_steps").insert(stepRows);
    if (stepErr) return NextResponse.json({ error: stepErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("sms_sequences")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
