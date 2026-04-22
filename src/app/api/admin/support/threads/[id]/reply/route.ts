import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const messageBody = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!messageBody) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const { error: insertErr } = await supabaseAdmin.from("support_messages").insert({
    thread_id: params.id,
    author_user_id: guard.userId,
    is_admin: true,
    body: messageBody,
  });
  if (insertErr) {
    console.error("Admin reply insert error:", insertErr);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  await supabaseAdmin
    .from("support_threads")
    .update({
      last_message_at: new Date().toISOString(),
      user_unread: true,
      admin_unread: false,
    })
    .eq("id", params.id);

  await logAdminAction(guard.userId, "support.reply", null, { threadId: params.id });

  return NextResponse.json({ success: true });
}
