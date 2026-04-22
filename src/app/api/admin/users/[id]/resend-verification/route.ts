import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { sendVerificationEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, email, email_verified")
    .eq("id", params.id)
    .single();

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.email_verified) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

  await supabaseAdmin
    .from("email_verification_tokens")
    .insert({ user_id: user.id, token, expires_at: expiresAt, used: false });

  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const appUrl =
    process.env.NODE_ENV === "development"
      ? origin
      : process.env.NEXT_PUBLIC_APP_URL || origin || "https://nextnote.to";
  const verifyUrl = `${appUrl}/auth/verify-callback?token=${token}`;

  try {
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (err) {
    console.error("Admin resend verification error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "user.resend_verification", params.id, { email: user.email });

  return NextResponse.json({ success: true });
}
