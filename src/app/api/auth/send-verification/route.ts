import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { sendVerificationEmail } from "@/lib/email-templates";

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

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

    await supabaseAdmin
      .from("email_verification_tokens")
      .insert({ user_id: user.id, token, expires_at: expiresAt, used: false });

    const requestOrigin = new URL((req.headers.get("origin") || req.nextUrl.origin)).origin;
    const appUrl = process.env.NODE_ENV === "development"
      ? requestOrigin
      : process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "https://nextnote.to";
    const verifyUrl = `${appUrl}/auth/verify-callback?token=${token}`;

    await sendVerificationEmail(user.email, verifyUrl);

    return NextResponse.json({ success: true, message: "Verification email sent" });
  } catch (err) {
    console.error("Send verification error:", err);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
}
