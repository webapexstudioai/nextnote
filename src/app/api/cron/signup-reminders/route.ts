import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSignupReminderEmail } from "@/lib/email-templates";

export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nextnote.to";
const BATCH_LIMIT = 100;

// Step → minimum age in days since signup before this email fires.
const STEP_DELAYS: Record<1 | 2 | 3, number> = {
  1: 2,
  2: 5,
  3: 10,
};

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

function unsubscribeUrl(userId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  const sig = createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
  return `${APP_URL}/api/email/unsubscribe?u=${userId}&t=${sig}`;
}

function ageInDays(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

interface Candidate {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pull users who signed up in the last 30 days, never converted, not opted out, not admin.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: candidates, error } = await supabaseAdmin
    .from("users")
    .select("id, email, name, created_at, subscription_status, is_admin, signup_reminders_opted_out")
    .gte("created_at", thirtyDaysAgo)
    .or("subscription_status.is.null,subscription_status.in.(canceled,incomplete,incomplete_expired,unpaid,pending)")
    .eq("is_admin", false)
    .eq("signup_reminders_opted_out", false)
    .limit(500);

  if (error) {
    console.error("signup-reminders: candidate query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligible: Candidate[] = (candidates ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    created_at: u.created_at,
  }));

  // Pull all reminders already sent for these users so we don't double-fire.
  const ids = eligible.map((u) => u.id);
  const sentByUser = new Map<string, Set<number>>();
  if (ids.length) {
    const { data: sent } = await supabaseAdmin
      .from("signup_reminders")
      .select("user_id, step")
      .in("user_id", ids);
    for (const row of sent ?? []) {
      if (!sentByUser.has(row.user_id)) sentByUser.set(row.user_id, new Set());
      sentByUser.get(row.user_id)!.add(row.step);
    }
  }

  const discountCode = process.env.SIGNUP_REMINDER_DISCOUNT_CODE || undefined;
  const ctaUrl = `${APP_URL}/dashboard/billing`;

  const results: { user_id: string; step: number; status: string; detail?: string }[] = [];
  let processed = 0;

  for (const user of eligible) {
    if (processed >= BATCH_LIMIT) break;
    const age = ageInDays(user.created_at);
    const sent = sentByUser.get(user.id) ?? new Set<number>();

    // Pick the highest step the user is due for that hasn't been sent yet.
    let dueStep: 1 | 2 | 3 | null = null;
    for (const step of [3, 2, 1] as const) {
      if (age >= STEP_DELAYS[step] && !sent.has(step)) {
        dueStep = step;
        break;
      }
    }
    if (!dueStep) continue;

    try {
      await sendSignupReminderEmail({
        to: user.email,
        step: dueStep,
        ctaUrl,
        unsubscribeUrl: unsubscribeUrl(user.id),
        discountCode,
      });
      const { error: insertErr } = await supabaseAdmin
        .from("signup_reminders")
        .insert({ user_id: user.id, step: dueStep });
      if (insertErr) {
        // Conflict (already-sent race) is fine; anything else is logged.
        if (!insertErr.message.toLowerCase().includes("duplicate")) {
          console.error("signup-reminders: insert failed", insertErr, { user_id: user.id, step: dueStep });
        }
      }
      results.push({ user_id: user.id, step: dueStep, status: "sent" });
      processed++;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "send failed";
      console.error("signup-reminders: send failed", detail, { user_id: user.id, step: dueStep });
      results.push({ user_id: user.id, step: dueStep, status: "failed", detail });
    }
  }

  return NextResponse.json({ ok: true, processed, eligible: eligible.length, results });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
