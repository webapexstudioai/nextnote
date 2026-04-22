import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

// 1 credit = $0.01. Stripe's minimum one-time charge in USD is $0.50 — so we
// floor the exact-topup at 50 credits. Cap it at 100k credits to keep a sane
// upper bound on a one-click purchase.
const MIN_TOPUP_CREDITS = 50;
const MAX_TOPUP_CREDITS = 100_000;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requested = Math.ceil(Number(body.credits));
    if (!Number.isFinite(requested) || requested <= 0) {
      return NextResponse.json({ error: "credits must be a positive number" }, { status: 400 });
    }

    const credits = Math.min(MAX_TOPUP_CREDITS, Math.max(MIN_TOPUP_CREDITS, requested));
    const priceCents = credits;
    const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : "/dashboard";

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("id", session.userId)
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
            unit_amount: priceCents,
            product_data: {
              name: `${credits.toLocaleString()} NextNote credits`,
              description: "Exact top-up — credits drop into your balance the second payment clears.",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}${returnTo}${returnTo.includes("?") ? "&" : "?"}topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}${returnTo}${returnTo.includes("?") ? "&" : "?"}topup=canceled`,
      metadata: {
        userId: user.id,
        kind: "credit_purchase",
        packId: "topup_exact",
        credits: String(credits),
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      credits,
      priceCents,
      minApplied: credits !== requested,
    });
  } catch (err) {
    console.error("Create exact topup checkout error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
