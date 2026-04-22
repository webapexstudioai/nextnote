import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.color === "string") updates.color = body.color;

  const { error } = await supabaseAdmin
    .from("folders")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Update folder error:", error);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("folders")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Delete folder error:", error);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
