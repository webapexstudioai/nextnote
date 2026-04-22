import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("support_threads")
    .select("id, subject, status, last_message_at, user_unread, created_at")
    .eq("user_id", session.userId)
    .order("last_message_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load threads" }, { status: 500 });
  }

  return NextResponse.json({
    threads: (data ?? []).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.last_message_at,
      unread: t.user_unread,
      createdAt: t.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const messageBody = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!subject || !messageBody) {
    return NextResponse.json({ error: "Subject and message required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: thread, error: tErr } = await supabaseAdmin
    .from("support_threads")
    .insert({
      user_id: session.userId,
      subject,
      status: "open",
      last_message_at: now,
      user_unread: false,
      admin_unread: true,
    })
    .select("id")
    .single();

  if (tErr || !thread) {
    console.error("Create thread error:", tErr);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }

  const { error: mErr } = await supabaseAdmin.from("support_messages").insert({
    thread_id: thread.id,
    author_user_id: session.userId,
    is_admin: false,
    body: messageBody,
  });
  if (mErr) {
    console.error("Create initial message error:", mErr);
  }

  return NextResponse.json({ threadId: thread.id });
}
