import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nextnote.to";

function expectedToken(userId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
}

function tokenMatches(userId: string, provided: string): boolean {
  const expected = expectedToken(userId);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("u") || "";
  const token = searchParams.get("t") || "";

  if (!userId || !token || !tokenMatches(userId, token)) {
    return NextResponse.redirect(`${APP_URL}/email/unsubscribed?error=invalid`);
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ signup_reminders_opted_out: true })
    .eq("id", userId);

  if (error) {
    console.error("unsubscribe: update failed", error);
    return NextResponse.redirect(`${APP_URL}/email/unsubscribed?error=server`);
  }

  return NextResponse.redirect(`${APP_URL}/email/unsubscribed`);
}
