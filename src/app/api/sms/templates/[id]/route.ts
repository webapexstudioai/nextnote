import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const { name, body } = await req.json();
  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (typeof body === "string" && body.trim()) update.body = body.trim();

  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "not found" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("sms_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
