import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: thread } = await supabaseAdmin
    .from("support_threads")
    .select("id, subject, status, created_at, last_message_at, user:user_id(id, email, name, agency_name)")
    .eq("id", params.id)
    .single();

  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabaseAdmin
    .from("support_messages")
    .select("id, body, is_admin, created_at, author_user_id")
    .eq("thread_id", params.id)
    .order("created_at", { ascending: true });

  // Mark read for admin
  await supabaseAdmin.from("support_threads").update({ admin_unread: false }).eq("id", params.id);

  type ThreadRow = {
    id: string;
    subject: string;
    status: string;
    created_at: string;
    last_message_at: string;
    user: { id: string; email: string; name: string | null; agency_name: string | null } | null;
  };
  const t = thread as unknown as ThreadRow;

  return NextResponse.json({
    thread: {
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.created_at,
      lastMessageAt: t.last_message_at,
      user: t.user ? { id: t.user.id, email: t.user.email, name: t.user.name, agencyName: t.user.agency_name } : null,
    },
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      isAdmin: m.is_admin,
      createdAt: m.created_at,
      authorUserId: m.author_user_id,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body.status === "open" || body.status === "closed") updates.status = body.status;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("support_threads").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  await logAdminAction(guard.userId, `support.thread_${updates.status}`, null, { threadId: params.id });

  return NextResponse.json({ success: true });
}
