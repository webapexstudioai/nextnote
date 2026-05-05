import { supabaseAdmin } from "@/lib/supabase";
import { getAppUrl } from "@/lib/appUrl";
import { stripe } from "@/lib/stripe";

// Buys a number on the master Twilio account, wires its inbound SMS +
// Voice webhooks back to NextNote, and records the row in
// user_phone_numbers with purpose='agency'. Used by the Stripe webhook
// after `checkout.session.completed` for an agency-phone purchase.
//
// Caller is responsible for refunding payment if `success: false` is
// returned (helper does its own Twilio cleanup on a partial success
// where the number bought but couldn't be persisted).
import { TRIAL_DAYS } from "@/lib/agencyPhoneState";
export { TRIAL_DAYS, TRIAL_GRACE_DAYS, getAgencyTrialState } from "@/lib/agencyPhoneState";
export type { AgencyTrialKind } from "@/lib/agencyPhoneState";

export async function purchaseAgencyNumber(opts: {
  userId: string;
  phoneNumber: string;
  friendlyName?: string;
  trial?: boolean;
}): Promise<{ success: true; phoneNumber: string; twilioSid: string } | { success: false; error: string }> {
  const { userId, phoneNumber, trial } = opts;
  const friendlyName = opts.friendlyName?.trim() || "NextNote Agency Line";

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { success: false, error: "Phone provider is not configured." };

  const appUrl = getAppUrl();
  if (!appUrl) return { success: false, error: "APP_URL not configured — webhooks cannot be registered." };

  // Idempotency: if the user already has an agency number, treat this as
  // a duplicate webhook fire and return success without buying again.
  const { data: existing } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("phone_number, twilio_sid")
    .eq("user_id", userId)
    .eq("purpose", "agency")
    .maybeSingle();
  if (existing) {
    return {
      success: true,
      phoneNumber: existing.phone_number,
      twilioSid: existing.twilio_sid || "",
    };
  }

  const auth = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;

  const purchaseRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        PhoneNumber: phoneNumber,
        FriendlyName: friendlyName,
        VoiceUrl: `${appUrl}/api/twilio/voice/forward`,
        VoiceMethod: "POST",
        SmsUrl: `${appUrl}/api/sms/inbound`,
        SmsMethod: "POST",
      }),
    }
  );
  const purchaseData = await purchaseRes.json();
  if (!purchaseRes.ok) {
    return { success: false, error: purchaseData?.message || "Phone purchase failed" };
  }

  const trialStartedAt = trial ? new Date() : null;
  const trialEndsAt = trial ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;

  const { error: insertErr } = await supabaseAdmin
    .from("user_phone_numbers")
    .insert({
      user_id: userId,
      elevenlabs_phone_number_id: null,
      phone_number: purchaseData.phone_number,
      label: friendlyName,
      twilio_sid: purchaseData.sid,
      purpose: "agency",
      trial_started_at: trialStartedAt?.toISOString() ?? null,
      trial_ends_at: trialEndsAt?.toISOString() ?? null,
    });

  if (insertErr) {
    // Couldn't persist — release the Twilio number to avoid an orphan we'd
    // still be billed for monthly.
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${purchaseData.sid}.json`,
      { method: "DELETE", headers: { Authorization: auth } }
    ).catch(() => {});
    return { success: false, error: `Failed to record agency number: ${insertErr.message}` };
  }

  return {
    success: true,
    phoneNumber: purchaseData.phone_number,
    twilioSid: purchaseData.sid,
  };
}

// Releases a Twilio number and removes its row from user_phone_numbers.
// Used by the cron when a trial expires past the grace period.
export async function releaseAgencyNumber(opts: {
  userId: string;
  twilioSid: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, twilioSid } = opts;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { success: false, error: "Phone provider is not configured." };

  if (twilioSid) {
    const auth = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${twilioSid}.json`,
      { method: "DELETE", headers: { Authorization: auth } }
    ).catch(() => null);
    // Twilio returns 204 on success or 404 if already gone — both are fine.
    if (res && !res.ok && res.status !== 404) {
      return { success: false, error: `Number release failed: ${res.status}` };
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from("user_phone_numbers")
    .delete()
    .eq("user_id", userId)
    .eq("purpose", "agency");
  if (delErr) return { success: false, error: delErr.message };

  return { success: true };
}

// Refund a Stripe Checkout session's payment in full. Used when an agency
// phone purchase fails after the customer was charged.
export async function refundCheckoutSession(sessionId: string, reason: string): Promise<void> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!paymentIntentId) {
      console.error(`[refundCheckoutSession] no payment_intent on session ${sessionId}`);
      return;
    }
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: { source: "agency_phone_purchase_failed", note: reason.slice(0, 400) },
    });
  } catch (err) {
    console.error(`[refundCheckoutSession] refund failed for ${sessionId}:`, err);
  }
}
