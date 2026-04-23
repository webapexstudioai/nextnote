import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // OTP is a 6-digit code (1M possibilities). Without this, an attacker with
    // a session cookie could brute-force it in minutes.
    const limit = rateLimit(`verify-otp:${session.userId}`, 10, 15 * 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    // Find valid, unused code for this user
    const { data: record } = await supabaseAdmin
      .from("email_verification_codes")
      .select("id, code, expires_at, used")
      .eq("user_id", session.userId)
      .eq("code", code.trim())
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!record) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
    }

    // Mark code as used
    await supabaseAdmin
      .from("email_verification_codes")
      .update({ used: true })
      .eq("id", record.id);

    // Mark user as verified
    await supabaseAdmin
      .from("users")
      .update({ email_verified: true })
      .eq("id", session.userId);

    return NextResponse.json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
