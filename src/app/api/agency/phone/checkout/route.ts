import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

// Creates a Stripe Checkout session for buying an agency phone line.
// Twilio purchase + webhook wiring happens in /api/stripe/webhook
// after `checkout.session.completed` fires.
const AGENCY_PHONE_PRICE_CENTS = 500; // $5.00 one-time

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { phoneNumber, friendlyName } = await req.json();
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }

    // One agency number per user — no point taking payment for a duplicate.
    const { data: existing } = await supabaseAdmin
      .from("user_phone_numbers")
      .select("id")
      .eq("user_id", userId)
      .eq("purpose", "agency")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "You already have an agency number. Release it first." }, { status: 409 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("id", userId)
      .single();
    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: AGENCY_PHONE_PRICE_CENTS,
            product_data: {
              name: "NextNote Agency Phone Line",
              description: `One-time setup for ${phoneNumber}. Includes inbound SMS + voice forwarding.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/agency-phone?purchased=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/agency-phone?purchased=canceled`,
      metadata: {
        userId: user.id,
        kind: "agency_phone_purchase",
        phoneNumber,
        friendlyName: (friendlyName || "").toString().slice(0, 80),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Agency phone checkout error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
