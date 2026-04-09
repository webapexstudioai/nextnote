import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
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

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour

    await supabaseAdmin
      .from("email_verification_tokens")
      .insert({ user_id: user.id, token, expires_at: expiresAt, used: false });

    const requestOrigin = new URL((req.headers.get("origin") || req.nextUrl.origin)).origin;
    const appUrl = process.env.NODE_ENV === "development"
      ? requestOrigin
      : process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "https://nextnote.to";
    const verifyUrl = `${appUrl}/auth/verify-callback?token=${token}`;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@nextnote.app";

    await resend.emails.send({
      from: `NextNote <${fromEmail}>`,
      to: [user.email],
      subject: "Verify your NextNote email",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#050507;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050507;padding:48px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, rgba(12,12,18,0.95), rgba(20,20,32,0.9));border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <tr>
            <td style="padding:40px 36px 28px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#e8553d,#ff8a6a);text-align:center;line-height:56px;font-size:24px;font-weight:bold;color:#fff;">N</div>
              <h1 style="margin:20px 0 0;font-size:24px;font-weight:700;color:#f0f0f5;letter-spacing:-0.025em;">Verify Your Email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 36px;">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#71717a;text-align:center;">
                Click the button below to verify your email address and activate your NextNote account.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#e8553d,#d44429);color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:12px;box-shadow:0 4px 24px rgba(232,85,61,0.3);">
                  Verify Email Address
                </a>
              </div>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#52525b;text-align:center;">
                This link expires in 1 hour. If you didn&rsquo;t create a NextNote account, you can safely ignore this email.
              </p>
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#3f3f46;text-align:center;word-break:break-all;">
                Or copy this link: ${verifyUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;font-size:11px;color:#3f3f46;">&copy; ${new Date().getFullYear()} NextNote. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    return NextResponse.json({ success: true, message: "Verification email sent" });
  } catch (err) {
    console.error("Send verification error:", err);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
}
