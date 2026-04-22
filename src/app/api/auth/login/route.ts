import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
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
