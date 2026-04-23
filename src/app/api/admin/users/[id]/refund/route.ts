import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { deductCredits, getBalance } from "@/lib/credits";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const chargeId = typeof body.chargeId === "string" ? body.chargeId : "";
  const reverseCredits = body.reverseCredits !== false; // default true
  if (!chargeId) {
    return NextResponse.json({ error: "chargeId required" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, stripe_customer_id")
    .eq("id", params.id)
    .single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Correlate the charge back to its originating checkout session so we know
  // exactly which credit_transactions row to reverse (rather than guessing
  // the most-recent purchase, which can reverse the wrong transaction when
  // users have multiple pending purchases).
  let originalTxId: string | null = null;
  let originalDelta = 0;
  if (reverseCredits) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;

      if (paymentIntentId) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });
        const originalSession = sessions.data[0];
        if (originalSession && originalSession.metadata?.kind === "credit_purchase") {
          // The webhook logs credit purchases with ref_id = checkout session id.
          const { data: tx } = await supabaseAdmin
            .from("credit_transactions")
            .select("id, delta")
            .eq("user_id", params.id)
            .eq("ref_id", originalSession.id)
            .eq("reason", "purchase")
            .maybeSingle();
          if (tx) {
            originalTxId = tx.id;
            originalDelta = tx.delta;
          }
        }
      }
    } catch (err) {
      // If correlation fails, we still refund but skip credit reversal. The
      // admin will see `creditsReversed: 0` and can adjust manually.
      console.error("Refund correlation lookup failed:", err);
    }
  }

  let refund;
  try {
    refund = await stripe.refunds.create({ charge: chargeId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe refund failed";
    console.error("Stripe refund error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let creditsReversed = 0;
  if (reverseCredits && originalTxId && originalDelta > 0) {
    try {
      const balance = await getBalance(params.id);
      const amount = Math.min(originalDelta, balance);
      if (amount > 0) {
        await deductCredits(params.id, amount, {
          reason: "admin_refund",
          refId: refund.id,
          metadata: { chargeId, refundedBy: guard.userId, originalTxId },
        });
        creditsReversed = amount;
      }
    } catch (err) {
      console.error("Credit reversal failed (refund still processed):", err);
    }
  }

  await logAdminAction(guard.userId, "stripe.refund", params.id, {
    chargeId,
    refundId: refund.id,
    amount: refund.amount,
    creditsReversed,
    correlatedTxId: originalTxId,
  });

  return NextResponse.json({
    success: true,
    refundId: refund.id,
    amount: refund.amount,
    status: refund.status,
    creditsReversed,
    correlatedTxId: originalTxId,
  });
}
