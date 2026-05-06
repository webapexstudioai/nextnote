import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { stripe, AI_PHONE_MONTHLY_PRICE_ID, AI_PHONE_PURCHASE_CENTS } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { hasCompletedBusinessProfile } from "@/lib/businessProfile";

// Replaces the credits-based purchase flow. Creates a Stripe Checkout
// subscription session for $5/mo per number. The actual Twilio purchase +
// ElevenLabs import happens in the webhook on checkout.session.completed,
// so the user is only charged once the line is reserved in their cart.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!AI_PHONE_MONTHLY_PRICE_ID) {
      return NextResponse.json(
        { error: "AI phone billing is not configured. Set STRIPE_PRICE_AI_PHONE_MONTHLY." },
        { status: 503 },
      );
    }

    const { phoneNumber, friendlyName } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }

    if (!(await hasCompletedBusinessProfile(session.userId))) {
      return NextResponse.json(
        { error: "Complete your business profile before purchasing a number.", code: "profile_required" },
        { status: 412 },
      );
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("id", session.userId)
      .single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let customerId = user.stripe_customer_id;
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        customerId = null;
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const requestOrigin = new URL(req.headers.get("origin") || req.nextUrl.origin).origin;
    const appUrl =
      process.env.NODE_ENV === "development"
        ? requestOrigin
        : process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "https://nextnote.to";

    const label = (friendlyName || "NextNote Agent Line").slice(0, 64);

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        // One-time activation fee — billed on the first invoice alongside
        // month one. Stripe lets you mix one-time line items with the
        // recurring price in subscription mode.
        {
          price_data: {
            currency: "usd",
            unit_amount: AI_PHONE_PURCHASE_CENTS,
            product_data: {
              name: "Phone number activation",
              description: `One-time setup fee for ${phoneNumber}`,
            },
          },
          quantity: 1,
        },
        // Recurring monthly rent.
        { price: AI_PHONE_MONTHLY_PRICE_ID, quantity: 1 },
      ],
      success_url: `${appUrl}/dashboard/agents?phone=success&number=${encodeURIComponent(phoneNumber)}`,
      cancel_url: `${appUrl}/dashboard/agents?phone=canceled`,
      metadata: {
        userId: user.id,
        kind: "ai_phone_purchase",
        phoneNumber,
        friendlyName: label,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          kind: "ai_phone_subscription",
          phoneNumber,
        },
        description: `AI receptionist phone line · ${phoneNumber}`,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("AI phone checkout error:", err);
    const msg = err instanceof Error ? err.message : "Failed to start checkout";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
