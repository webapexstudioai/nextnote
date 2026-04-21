import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICE_IDS } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { plan } = await req.json();
    const newPriceId = PRICE_IDS[plan];
    if (!newPriceId || !["starter", "pro"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get user with stripe subscription id
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, subscription_tier, stripe_subscription_id, stripe_customer_id")
      .eq("id", session.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.subscription_tier === plan) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    // If user has an active Stripe subscription, update it
    if (user.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

      if (subscription.status === "active" || subscription.status === "trialing") {
        // Update the subscription to the new price
        await stripe.subscriptions.update(user.stripe_subscription_id, {
          items: [
            {
              id: subscription.items.data[0].id,
              price: newPriceId,
            },
          ],
          proration_behavior: "create_prorations",
          metadata: {
            userId: user.id,
            plan,
          },
        });

        // Update Supabase immediately
        await supabaseAdmin
          .from("users")
          .update({
            subscription_tier: plan,
            subscription_status: "active",
          })
          .eq("id", session.userId);

        return NextResponse.json({ success: true, plan });
      }
    }

    // No active subscription — create a new checkout session
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", session.userId);
    }

    const requestOrigin = new URL(req.headers.get("origin") || req.nextUrl.origin).origin;
    const appUrl = process.env.NODE_ENV === "development"
      ? requestOrigin
      : process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "https://nextnote.to";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: newPriceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/settings?upgraded=true`,
      cancel_url: `${appUrl}/dashboard/settings`,
      metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Change plan error:", err);
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
  }
}
