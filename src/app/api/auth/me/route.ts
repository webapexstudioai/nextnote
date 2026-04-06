import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.userId,
        name: session.name,
        username: session.username,
        email: session.email,
      },
    });
  } catch (err) {
    console.error("Auth check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
