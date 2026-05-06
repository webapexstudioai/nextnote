import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getBalance,
  deductCredits,
  PHONE_NUMBER_MONTHLY_CREDITS,
} from "@/lib/credits";
import { removePhoneNumberOwnership } from "@/lib/agentOwnership";

export const maxDuration = 60;

/**
 * Deducts the monthly fee for every phone number whose next_renewal_at has
 * passed. If the user can't afford it, releases the number (Twilio + ElevenLabs)
 * and removes ownership. Safe to run daily — only touches due rows.
 *
 * Authenticate via `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron) or
 * `x-cron-secret` header for manual invocations.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  if (auth !== `Bearer ${secret}` && headerSecret !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  // Numbers with a Stripe subscription are billed by Stripe directly, so
  // skip them here — only the legacy credits-funded numbers go through this
  // cron. New purchases (post-Stripe-migration) will always have a sub id.
  const { data: due, error } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("id, user_id, elevenlabs_phone_number_id, phone_number, twilio_sid")
    .is("stripe_subscription_id", null)
    .lte("next_renewal_at", new Date().toISOString())
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ processed: 0 });

  const results = { renewed: 0, released: 0, failed: 0 };
  const releasedNumbers: string[] = [];

  for (const row of due) {
    const balance = await getBalance(row.user_id);
    if (balance >= PHONE_NUMBER_MONTHLY_CREDITS) {
      try {
        await deductCredits(row.user_id, PHONE_NUMBER_MONTHLY_CREDITS, {
          reason: "phone_number_monthly_renewal",
          refId: `renew:${row.elevenlabs_phone_number_id}:${new Date().toISOString().slice(0, 7)}`,
          metadata: { phone_number: row.phone_number },
        });
        await supabaseAdmin
          .from("user_phone_numbers")
          .update({ next_renewal_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
          .eq("id", row.id);
        results.renewed += 1;
      } catch {
        results.failed += 1;
      }
      continue;
    }

    // Insufficient credits — release the number so we stop paying Twilio for it.
    try {
      if (elevenKey) {
        await fetch(
          `https://api.elevenlabs.io/v1/convai/phone-numbers/${row.elevenlabs_phone_number_id}`,
          { method: "DELETE", headers: { "xi-api-key": elevenKey } },
        ).catch(() => {});
      }
      if (twilioSid && twilioToken && row.twilio_sid) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/IncomingPhoneNumbers/${row.twilio_sid}.json`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
            },
          },
        ).catch(() => {});
      }
      await removePhoneNumberOwnership(row.user_id, row.elevenlabs_phone_number_id);

      await supabaseAdmin.from("credit_transactions").insert({
        user_id: row.user_id,
        delta: 0,
        reason: "phone_number_released_low_balance",
        ref_id: `release:${row.elevenlabs_phone_number_id}`,
        metadata: { phone_number: row.phone_number, balance_at_release: balance },
      });

      releasedNumbers.push(row.phone_number);
      results.released += 1;
    } catch {
      results.failed += 1;
    }
  }

  return NextResponse.json({
    processed: due.length,
    ...results,
    released_numbers: releasedNumbers,
  });
}
