import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (session.accessToken) {
    return NextResponse.json({ connected: true, email: session.email ?? "" });
  }

  return NextResponse.json({ connected: false, email: "" });
}
