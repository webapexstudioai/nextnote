import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("voicemail_recordings")
    .select("id, storage_path")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const { error: delErr } = await supabaseAdmin
    .from("voicemail_recordings")
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId);

  if (delErr) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  await supabaseAdmin.storage.from("voicemail-audio").remove([row.storage_path]).catch(() => {});

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("voicemail_recordings")
    .update({ name })
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json({ error: "Failed to rename" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
