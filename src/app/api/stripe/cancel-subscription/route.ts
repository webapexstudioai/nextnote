import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("stripe_subscription_id")
      .eq("id", session.userId)
      .single();

    if (!user?.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    const updated = await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.items.data[0]?.current_period_end ?? null,
    });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
