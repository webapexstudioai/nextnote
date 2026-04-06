import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";

export async function POST() {
  try {
    const session = await getAuthSession();
    session.destroy();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
