import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();

  // Revoke the token at Google
  if (session.accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${session.accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch {
      // Revocation is best-effort
    }
  }

  // Clear the session
  session.destroy();

  return NextResponse.json({ success: true });
}
