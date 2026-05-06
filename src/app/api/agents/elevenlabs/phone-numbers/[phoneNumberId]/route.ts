import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsPhoneNumber, removePhoneNumberOwnership } from "@/lib/agentOwnership";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

const BASE = "https://api.elevenlabs.io/v1/convai/phone-numbers";
const getKey = () => process.env.ELEVENLABS_API_KEY || "";

async function guard(userId: string | undefined, phoneNumberId: string) {
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    await assertOwnsPhoneNumber(userId, phoneNumberId);
  } catch {
    return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { phoneNumberId } = await params;
  const denied = await guard(session.userId, phoneNumberId);
  if (denied) return denied;
  const res = await fetch(`${BASE}/${phoneNumberId}`, { headers: { "xi-api-key": getKey() }, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { phoneNumberId } = await params;
  const denied = await guard(session.userId, phoneNumberId);
  if (denied) return denied;
  const body = await req.json();
  const res = await fetch(`${BASE}/${phoneNumberId}`, {
    method: "PATCH",
    headers: { "xi-api-key": getKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { phoneNumberId } = await params;
  const denied = await guard(session.userId, phoneNumberId);
  if (denied) return denied;

  // Cancel the Stripe subscription that pays for this line, if any. The
  // subscription.deleted webhook will not double-release because we delete
  // the ownership row here first. Stripe issues no refund — user already
  // had the number for the active period.
  const { data: row } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("stripe_subscription_id, twilio_sid")
    .eq("user_id", session.userId)
    .eq("elevenlabs_phone_number_id", phoneNumberId)
    .maybeSingle();

  const res = await fetch(`${BASE}/${phoneNumberId}`, { method: "DELETE", headers: { "xi-api-key": getKey() } });
  if (!res.ok) return NextResponse.json({ error: "Failed to delete" }, { status: res.status });

  // Release the Twilio number so we stop paying for it.
  const twilioSid = row?.twilio_sid;
  const tSid = process.env.TWILIO_ACCOUNT_SID;
  const tToken = process.env.TWILIO_AUTH_TOKEN;
  if (twilioSid && tSid && tToken) {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${tSid}/IncomingPhoneNumbers/${twilioSid}.json`,
      {
        method: "DELETE",
        headers: { Authorization: `Basic ${Buffer.from(`${tSid}:${tToken}`).toString("base64")}` },
      },
    ).catch(() => {});
  }

  await removePhoneNumberOwnership(session.userId, phoneNumberId);

  if (row?.stripe_subscription_id) {
    await stripe.subscriptions
      .cancel(row.stripe_subscription_id, { invoice_now: false, prorate: false })
      .catch((err) => console.error("[release] failed to cancel sub:", err));
  }

  return NextResponse.json({ success: true });
}
