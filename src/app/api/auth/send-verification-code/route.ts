import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, email_verified")
      .eq("id", session.userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.email_verified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    // Rate-limit: invalidate previous unused codes
    await supabaseAdmin
      .from("email_verification_codes")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // Generate a secure 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString(); // 15 min

    await supabaseAdmin
      .from("email_verification_codes")
      .insert({ user_id: user.id, code, expires_at: expiresAt, used: false });

    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@nextnote.app";

    await resend.emails.send({
      from: `NextNote <${fromEmail}>`,
      to: [user.email],
      subject: "Verify your NextNote email",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#e8553d,#ff8a6a);text-align:center;line-height:48px;font-size:20px;font-weight:bold;color:#fff;">N</div>
              <h1 style="margin:16px 0 0;font-size:22px;font-weight:700;color:#f5f5f5;">Verify Your Email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a0a0a0;">
                Enter this verification code in NextNote to confirm your email address:
              </p>
              <div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;padding:16px 40px;background:#111;border:2px solid #e8553d;border-radius:12px;letter-spacing:8px;font-size:32px;font-weight:700;color:#f5f5f5;font-family:monospace;">
                  ${code}
                </div>
              </div>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#707070;text-align:center;">
                This code expires in 15 minutes. If you didn&rsquo;t create a NextNote account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;font-size:12px;color:#555;">&copy; ${new Date().getFullYear()} NextNote. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    return NextResponse.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    console.error("Send verification code error:", err);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
