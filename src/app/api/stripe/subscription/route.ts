import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function GET() {
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
      return NextResponse.json({ subscription: null });
    }

    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

    return NextResponse.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: sub.items.data[0]?.current_period_end ?? null,
      },
    });
  } catch (err) {
    console.error("Fetch subscription error:", err);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}
