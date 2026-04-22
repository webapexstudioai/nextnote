import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("id", params.id)
    .single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await supabaseAdmin
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("user_id", user.id)
    .eq("used", false);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  await supabaseAdmin
    .from("password_reset_tokens")
    .insert({ user_id: user.id, token, expires_at: expiresAt, used: false });

  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const appUrl =
    process.env.NODE_ENV === "development"
      ? origin
      : process.env.NEXT_PUBLIC_APP_URL || origin || "https://nextnote.to";
  const resetLink = `${appUrl.replace(/\/$/, "")}/auth/reset-password?token=${token}`;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@nextnote.to";

  try {
    await resend.emails.send({
      from: `NextNote <${fromEmail}>`,
      to: [user.email],
      subject: "Reset your NextNote password",
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">
<tr><td style="padding:32px;text-align:center;">
<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f5f5f5;">Reset Your Password</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a0a0a0;">A NextNote admin has initiated a password reset on your behalf. Click below to set a new password.</p>
<p style="margin:0 0 24px;font-size:13px;color:#707070;">This link expires in 30 minutes.</p>
<a href="${resetLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#e8553d,#d44429);color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Reset Password</a>
<p style="margin:24px 0 0;font-size:12px;color:#555;word-break:break-all;">Or copy: <a href="${resetLink}" style="color:#e8553d;">${resetLink}</a></p>
</td></tr></table></td></tr></table></body></html>`,
    });
  } catch (err) {
    console.error("Admin password reset email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "user.password_reset", params.id, { email: user.email });

  return NextResponse.json({ success: true });
}
