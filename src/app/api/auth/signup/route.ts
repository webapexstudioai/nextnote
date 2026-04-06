import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { name, username, email, password } = await req.json();

    // Validate fields
    if (!name || !username || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (/\s/.test(username)) {
      return NextResponse.json({ error: "Username cannot contain spaces" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const db = getDb();

    // Check existing user
    const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const existingUsername = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existingUsername) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    // Create user
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(
      "INSERT INTO users (id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, username, email.toLowerCase(), password_hash);

    // Set session
    const session = await getAuthSession();
    session.userId = id;
    session.name = name;
    session.username = username;
    session.email = email.toLowerCase();
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, user: { id, name, username, email } });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
