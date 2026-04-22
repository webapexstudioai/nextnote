import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data, error } = await supabaseAdmin
    .from("admin_notes")
    .select("id, body, created_at, created_by, users:created_by(email)")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch notes error:", error);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }

  type NoteRow = {
    id: string;
    body: string;
    created_at: string;
    created_by: string;
    users: { email: string } | { email: string }[] | null;
  };
  const rows = (data ?? []) as unknown as NoteRow[];
  return NextResponse.json({
    notes: rows.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at,
      createdBy: n.created_by,
      createdByEmail: Array.isArray(n.users) ? n.users[0]?.email ?? null : n.users?.email ?? null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!text) {
    return NextResponse.json({ error: "Note body required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_notes")
    .insert({ user_id: params.id, body: text, created_by: guard.userId })
    .select("id, body, created_at")
    .single();

  if (error || !data) {
    console.error("Create note error:", error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "note.create", params.id, { noteId: data.id });

  return NextResponse.json({
    note: { id: data.id, body: data.body, createdAt: data.created_at, createdBy: guard.userId, createdByEmail: null },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get("noteId");
  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("admin_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", params.id);

  if (error) {
    console.error("Delete note error:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "note.delete", params.id, { noteId });

  return NextResponse.json({ success: true });
}
