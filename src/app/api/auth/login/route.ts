import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Rate limit: 8 attempts / 5 min per IP, and 6 attempts / 15 min per email
    // so an attacker can't credential-stuff one account from a rotating pool.
    const ipLimit = rateLimit(clientKey(req, "login"), 8, 5 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${ipLimit.retryAfterSec}s.` },
        { status: 429 },
      );
    }
    const emailLimit = rateLimit(`login:email:${email.toLowerCase()}`, 6, 15 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: `Too many login attempts for this email. Try again in ${emailLimit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, name, agency_name, email, password_hash, suspended_at")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.suspended_at) {
      return NextResponse.json(
        { error: "Your account has been suspended. Contact support." },
        { status: 403 },
      );
    }

    // Set session
    const session = await getAuthSession();
    session.userId = user.id;
    session.name = user.name;
    session.agencyName = user.agency_name;
    session.email = user.email;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, agencyName: user.agency_name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
