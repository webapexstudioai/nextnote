import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { addCredits, hasBeenProcessed } from "@/lib/credits";

/**
 * Pulls recent Stripe checkout sessions for the current user and credits any
 * completed credit-pack purchases that haven't been processed yet.
 *
 * Useful when the Stripe webhook can't reach localhost (dev) or missed an event.
 * Safe to call repeatedly — idempotent via credit_transactions.ref_id.
 */
export async function POST() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, stripe_customer_id")
    .eq("id", session.userId)
    .single();

  if (!user?.stripe_customer_id) {
    return NextResponse.json({ added: 0, message: "No Stripe customer linked yet." });
  }

  const sessions = await stripe.checkout.sessions.list({
    customer: user.stripe_customer_id,
    limit: 20,
  });

  let creditsAdded = 0;
  let processed = 0;

  for (const s of sessions.data) {
    if (s.payment_status !== "paid") continue;
    if (s.metadata?.kind !== "credit_purchase") continue;
    if (s.metadata?.userId !== user.id) continue;
    if (await hasBeenProcessed(s.id)) continue;

    const credits = parseInt(s.metadata?.credits || "0", 10);
    if (credits <= 0) continue;

    await addCredits(user.id, credits, {
      reason: "purchase",
      refId: s.id,
      metadata: { packId: s.metadata?.packId, reconciled: true },
    });
    creditsAdded += credits;
    processed += 1;
  }

  return NextResponse.json({
    success: true,
    processed,
    creditsAdded,
    message:
      processed > 0
        ? `Credited ${creditsAdded.toLocaleString()} from ${processed} purchase(s).`
        : "No pending purchases found.",
  });
}
