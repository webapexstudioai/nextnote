import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("support_threads")
    .select("id, subject, status, last_message_at, admin_unread, created_at, user:user_id(id, email, name)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to load threads" }, { status: 500 });
  }

  type Row = {
    id: string;
    subject: string;
    status: string;
    last_message_at: string;
    admin_unread: boolean;
    created_at: string;
    user: { id: string; email: string; name: string | null } | null;
  };

  return NextResponse.json({
    threads: ((data ?? []) as unknown as Row[]).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.last_message_at,
      unread: t.admin_unread,
      createdAt: t.created_at,
      user: t.user ? { id: t.user.id, email: t.user.email, name: t.user.name } : null,
    })),
  });
}
