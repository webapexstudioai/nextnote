import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    // Always return the same message to prevent email enumeration
    const successMessage = "If an account with that email exists, we've sent a password reset link.";

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .eq("email", email.toLowerCase())
      .single();

    if (!user) return NextResponse.json({ message: successMessage });

    // Invalidate any previous unused tokens for this user
    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString(); // 30 min

    await supabaseAdmin
      .from("password_reset_tokens")
      .insert({ user_id: user.id, token, expires_at: expiresAt, used: false });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const resetLink = `${appUrl}/auth/reset-password?token=${token}`;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@nextnote.app";

    await resend.emails.send({
      from: `NextNote <${fromEmail}>`,
      to: [user.email],
      subject: "Reset your NextNote password",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#e8553d,#ff8a6a);text-align:center;line-height:48px;font-size:20px;font-weight:bold;color:#fff;">N</div>
              <h1 style="margin:16px 0 0;font-size:22px;font-weight:700;color:#f5f5f5;">Reset Your Password</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a0a0a0;">
                We received a request to reset the password for your NextNote account. Click the button below to choose a new password.
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#707070;">
                This link will expire in 30 minutes. If you didn&rsquo;t request this, you can safely ignore this email.
              </p>
              <!-- Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#e8553d,#d44429);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#555;word-break:break-all;">
                Or copy this link: <a href="${resetLink}" style="color:#e8553d;text-decoration:underline;">${resetLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;font-size:12px;color:#555;">
                &copy; ${new Date().getFullYear()} NextNote. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    return NextResponse.json({ message: successMessage });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
