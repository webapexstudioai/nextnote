import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const { data: record } = await supabaseAdmin
      .from("email_verification_tokens")
      .select("id, user_id, expires_at, used")
      .eq("token", token)
      .eq("used", false)
      .single();

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Verification link has expired. Please request a new one." }, { status: 400 });
    }

    // Mark token as used
    await supabaseAdmin
      .from("email_verification_tokens")
      .update({ used: true })
      .eq("id", record.id);

    // Mark user as verified
    await supabaseAdmin
      .from("users")
      .update({ email_verified: true })
      .eq("id", record.user_id);

    return NextResponse.json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify token error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
