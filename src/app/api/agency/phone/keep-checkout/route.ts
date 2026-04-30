import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

// Stripe Checkout for converting an active trial number into a permanent
// paid one. $5 one-time. Webhook handles the actual `trial_ends_at` clear
// after the payment completes.
const KEEP_PRICE_CENTS = 500;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: agencyNumber } = await supabaseAdmin
      .from("user_phone_numbers")
      .select("phone_number, label, trial_ends_at")
      .eq("user_id", userId)
      .eq("purpose", "agency")
      .maybeSingle();
    if (!agencyNumber) {
      return NextResponse.json({ error: "No agency number to keep." }, { status: 404 });
    }
    if (!agencyNumber.trial_ends_at) {
      return NextResponse.json({ error: "This number is already paid for." }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("id", userId)
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

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: KEEP_PRICE_CENTS,
            product_data: {
              name: "Keep your NextNote agency number",
              description: `Convert ${agencyNumber.phone_number} from trial to permanent. One-time charge.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/agency-phone?kept=success`,
      cancel_url: `${appUrl}/dashboard/agency-phone?kept=canceled`,
      metadata: {
        userId: user.id,
        kind: "agency_phone_keep",
        phoneNumber: agencyNumber.phone_number,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Agency phone keep-checkout error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
