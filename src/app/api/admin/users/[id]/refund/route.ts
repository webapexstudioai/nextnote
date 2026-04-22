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

  let refund;
  try {
    refund = await stripe.refunds.create({ charge: chargeId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe refund failed";
    console.error("Stripe refund error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Attempt to reverse credits if this charge was for a credit pack purchase.
  let creditsReversed = 0;
  if (reverseCredits) {
    const { data: tx } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, delta, reason")
      .eq("user_id", params.id)
      .eq("reason", "purchase")
      .order("created_at", { ascending: false })
      .limit(50);

    // Find the most recent 'purchase' transaction. Heuristic: charges typically correspond 1:1
    // to checkout sessions; we match by most-recent if we can't pin the session ID.
    const toReverse = tx?.find((t) => t.delta > 0);
    if (toReverse) {
      try {
        const balance = await getBalance(params.id);
        const amount = Math.min(toReverse.delta, balance);
        if (amount > 0) {
          await deductCredits(params.id, amount, {
            reason: "admin_refund",
            refId: refund.id,
            metadata: { chargeId, refundedBy: guard.userId, originalTxId: toReverse.id },
          });
          creditsReversed = amount;
        }
      } catch (err) {
        console.error("Credit reversal failed (refund still processed):", err);
      }
    }
  }

  await logAdminAction(guard.userId, "stripe.refund", params.id, {
    chargeId,
    refundId: refund.id,
    amount: refund.amount,
    creditsReversed,
  });

  return NextResponse.json({
    success: true,
    refundId: refund.id,
    amount: refund.amount,
    status: refund.status,
    creditsReversed,
  });
}
