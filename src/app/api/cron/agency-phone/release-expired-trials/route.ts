import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { releaseAgencyNumber, TRIAL_GRACE_DAYS } from "@/lib/agencyPhone";

export const maxDuration = 60;

async function authOk(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

// Releases Twilio numbers whose trial expired more than TRIAL_GRACE_DAYS
// ago and the user never paid to keep them. Runs daily.
export async function GET(req: NextRequest) {
  if (!(await authOk(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("id, user_id, phone_number, twilio_sid, trial_ends_at")
    .eq("purpose", "agency")
    .not("trial_ends_at", "is", null)
    .lt("trial_ends_at", cutoff);

  if (error) {
    console.error("[cron release-expired-trials] query failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { phone_number: string; released: boolean; error?: string }[] = [];
  for (const row of rows ?? []) {
    const r = await releaseAgencyNumber({ userId: row.user_id, twilioSid: row.twilio_sid });
    if (r.success) {
      results.push({ phone_number: row.phone_number, released: true });
    } else {
      console.error(`[cron release-expired-trials] failed for ${row.phone_number}:`, r.error);
      results.push({ phone_number: row.phone_number, released: false, error: r.error });
    }
  }

  return NextResponse.json({ checked: rows?.length ?? 0, results });
}
