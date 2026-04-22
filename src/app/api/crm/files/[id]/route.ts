import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name } = await req.json();
  if (typeof name !== "string") return NextResponse.json({ error: "name required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("files")
    .update({ name })
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Rename file error:", error);
    return NextResponse.json({ error: "Failed to rename file" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("files")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
