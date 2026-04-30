import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .select("id, name, body, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, body } = await req.json();
  if (typeof name !== "string" || !name.trim() || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "name and body required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .insert({ user_id: userId, name: name.trim(), body: body.trim() })
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "insert failed" }, { status: 500 });
  return NextResponse.json({ template: data });
}
