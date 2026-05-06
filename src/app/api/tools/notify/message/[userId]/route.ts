import { NextRequest, NextResponse } from "next/server";
import { authorizeNotifyCall } from "@/lib/toolAuth";
import { sendEmail } from "@/lib/email-templates";
import { supabaseAdmin } from "@/lib/supabase";

const MESSAGES_FOLDER = "Phone Messages";
const MESSAGES_FOLDER_COLOR = "#f59e0b";
const MAX_FIELD = 2000;

function asStr(v: unknown, max = MAX_FIELD): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function ensureMessagesFolder(userId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MESSAGES_FOLDER)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabaseAdmin
    .from("folders")
    .insert({ user_id: userId, name: MESSAGES_FOLDER, color: MESSAGES_FOLDER_COLOR })
    .select("id")
    .single();
  return created?.id || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeNotifyCall(req, userId);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = asStr(body?.caller_name, 200) || "Phone caller";
  const phone = asStr(body?.caller_phone, 30);
  const message = asStr(body?.message);
  const callbackTime = asStr(body?.callback_time, 200);

  if (!message) {
    return NextResponse.json({ success: false, error: "`message` is required." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ success: false, error: "`caller_phone` is required so you can call back." }, { status: 400 });
  }

  // Save to Phone Messages folder so the owner sees it in their CRM.
  const folderId = await ensureMessagesFolder(auth.user.id);
  if (folderId) {
    const noteParts = [`Message: ${message}`];
    if (callbackTime) noteParts.push(`Best callback time: ${callbackTime}`);
    await supabaseAdmin.from("prospects").insert({
      user_id: auth.user.id,
      folder_id: folderId,
      name,
      phone,
      notes: noteParts.join("\n\n"),
      status: "New",
      source: "phone_message",
    });
  }

  // Email the owner so they know to call back. Best-effort — don't fail the
  // tool call if email bounces; the lead is already saved in the CRM.
  if (auth.user.email) {
    const subject = `New phone message from ${name}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px 0;">📞 New phone message</h2>
        <p><strong>From:</strong> ${escapeHtml(name)}</p>
        <p><strong>Phone:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>
        ${callbackTime ? `<p><strong>Best time to call back:</strong> ${escapeHtml(callbackTime)}</p>` : ""}
        <div style="background:#f7f7f7;border-left:3px solid #e8553d;padding:12px 16px;margin:16px 0;border-radius:6px;">
          ${escapeHtml(message).replace(/\n/g, "<br />")}
        </div>
        <p style="font-size:11px;color:#777;">Captured by your AI receptionist · saved to Phone Messages in NextNote.</p>
      </div>
    `;
    const text = [
      `New phone message`,
      `From: ${name}`,
      `Phone: ${phone}`,
      callbackTime ? `Best time to call back: ${callbackTime}` : null,
      ``,
      message,
    ].filter(Boolean).join("\n");

    try {
      await sendEmail({ to: auth.user.email, subject, html, text });
    } catch (e) {
      console.error("[take_message] email failed:", e);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Message recorded. ${auth.user.email ? "I'll email it to the team so they can call back." : "Saved to your CRM."}`,
  });
}
