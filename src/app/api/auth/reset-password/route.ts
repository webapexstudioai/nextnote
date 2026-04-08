import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { isPasswordStrong } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }
    if (!isPasswordStrong(password)) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters with an uppercase letter, number, and special character." },
        { status: 400 }
      );
    }

    const { data: reset } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id,user_id,expires_at,used")
      .eq("token", token)
      .single();

    if (!reset || reset.used) {
      return NextResponse.json({ error: "This reset link has already been used or is invalid." }, { status: 400 });
    }

    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ password_hash })
      .eq("id", reset.user_id);

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json({ error: "Failed to update password. Please try again." }, { status: 500 });
    }

    // Invalidate token
    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", reset.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
