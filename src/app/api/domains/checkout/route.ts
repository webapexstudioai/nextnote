import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import {
  ALLOWED_TLDS,
  DOMAIN_RETAIL_CENTS,
  DOMAIN_WHOLESALE_CEILING_CENTS,
  searchDomains,
} from "@/lib/domainPurchase";

export const runtime = "nodejs";

function tldOf(domain: string): string {
  const parts = domain.split(".");
  return parts[parts.length - 1] || "";
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.userId;

  let body: { siteId?: string; domain?: string };
  try { body = await req.json(); } catch { body = {}; }

  const siteId = (body.siteId || "").trim();
  const domain = (body.domain || "").trim().toLowerCase();
  if (!siteId || !domain) {
    return NextResponse.json({ error: "siteId and domain are required" }, { status: 400 });
  }

  // TLD whitelist defends against the user POSTing a domain we'd refuse to
  // register anyway.
  const tld = tldOf(domain);
  if (!ALLOWED_TLDS.includes(tld as typeof ALLOWED_TLDS[number])) {
    return NextResponse.json({ error: "That TLD isn't supported yet." }, { status: 400 });
  }

  // Confirm the site is theirs and not already configured for a domain.
  const { data: site } = await supabaseAdmin
    .from("generated_websites")
    .select("id, user_id, custom_domain")
    .eq("id", siteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  if (site.custom_domain) {
    return NextResponse.json(
      { error: "A domain is already attached to this site. Detach it first." },
      { status: 409 },
    );
  }

  // Re-check availability + price at checkout-creation time. Avoids charging
  // the user for a domain that just became unavailable.
  const { results } = await searchDomains(domain);
  const match = results.find((r) => r.name === domain);
  if (!match) {
    return NextResponse.json({ error: "Couldn't price that domain right now." }, { status: 502 });
  }
  if (!match.available) {
    return NextResponse.json({ error: "That domain isn't available." }, { status: 409 });
  }
  if (match.premium || (match.wholesalePriceCents ?? Infinity) > DOMAIN_WHOLESALE_CEILING_CENTS) {
    return NextResponse.json(
      { error: "That's a premium domain — we can't sell it at the standard price." },
      { status: 409 },
    );
  }
  const wholesale = match.wholesalePriceCents ?? 0;

  // Resolve a Stripe customer for this user.
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, email, stripe_customer_id")
    .eq("id", userId)
    .single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = user.stripe_customer_id;
  if (customerId) {
    try { await stripe.customers.retrieve(customerId); } catch { customerId = null; }
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

  // Create the checkout session. We collect billing address + phone so
  // the webhook has everything it needs for the WHOIS registrant record.
  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: DOMAIN_RETAIL_CENTS,
          product_data: {
            name: `${domain} — 1 year registration`,
            description: "Domain registered through NextNote and auto-attached to your site.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/websites/${siteId}/edit?domain_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/websites/${siteId}/edit?domain_purchase=canceled`,
    metadata: {
      userId,
      kind: "domain_purchase",
      siteId,
      domain,
      wholesaleCents: String(wholesale),
    },
  });

  // Pre-create the order row so we have a paper trail even if the webhook
  // fires before any later DB read.
  await supabaseAdmin.from("domain_orders").insert({
    user_id: userId,
    site_id: siteId,
    domain,
    status: "pending",
    stripe_session_id: checkout.id,
    amount_cents: DOMAIN_RETAIL_CENTS,
    vercel_cost_cents: wholesale,
  });

  return NextResponse.json({ url: checkout.url });
}
