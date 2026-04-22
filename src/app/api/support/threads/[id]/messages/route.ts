import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

async function loadThread(threadId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("support_threads")
    .select("id, user_id, status")
    .eq("id", threadId)
    .single();
  if (!data || data.user_id !== userId) return null;
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const thread = await loadThread(params.id, session.userId);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabaseAdmin
    .from("support_messages")
    .select("id, body, is_admin, created_at")
    .eq("thread_id", params.id)
    .order("created_at", { ascending: true });

  // Mark as read for the user
  await supabaseAdmin
    .from("support_threads")
    .update({ user_unread: false })
    .eq("id", params.id)
    .eq("user_id", session.userId);

  return NextResponse.json({
    thread: { id: thread.id, status: thread.status },
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      isAdmin: m.is_admin,
      createdAt: m.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const thread = await loadThread(params.id, session.userId);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const messageBody = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!messageBody) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const now = new Date().toISOString();
  await supabaseAdmin.from("support_messages").insert({
    thread_id: params.id,
    author_user_id: session.userId,
    is_admin: false,
    body: messageBody,
  });

  await supabaseAdmin
    .from("support_threads")
    .update({
      last_message_at: now,
      admin_unread: true,
      status: "open",
    })
    .eq("id", params.id);

  return NextResponse.json({ success: true });
}
