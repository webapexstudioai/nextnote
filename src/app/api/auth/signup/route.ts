import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { isPasswordStrong } from "@/lib/password";
import { addCredits, SIGNUP_BONUS_CREDITS } from "@/lib/credits";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Cap signups per IP so one actor can't farm credit bonuses.
    const ipLimit = rateLimit(clientKey(req, "signup"), 5, 60 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: `Too many signups from this network. Try again in ${Math.ceil(ipLimit.retryAfterSec / 60)} min.` },
        { status: 429 },
      );
    }

    const { name, email, agencyName, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (!isPasswordStrong(password)) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters with 1 uppercase letter, 1 number, and 1 special character" },
        { status: 400 },
      );
    }

    // Check existing user
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Create user
    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        name,
        agency_name: agencyName || "",
        email: email.toLowerCase(),
        password_hash,
        email_verified: false,
        subscription_tier: null,
        subscription_status: "pending",
      })
      .select("id, name, agency_name, email")
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Set session
    const session = await getAuthSession();
    session.userId = user.id;
    session.name = user.name;
    session.agencyName = user.agency_name;
    session.email = user.email;
    session.isLoggedIn = true;
    await session.save();

    await addCredits(user.id, SIGNUP_BONUS_CREDITS, {
      reason: "signup_bonus",
      metadata: { email: user.email },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, agencyName: user.agency_name, email: user.email },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
