// Post-payment fulfillment for a domain purchase.
//
// Called from the Stripe webhook after `checkout.session.completed`. We:
//   1. Pull registrant contact info off the session (collected by
//      Stripe Checkout's billing_address + phone collection).
//   2. Call Vercel buy with the wholesale price the checkout was created at.
//   3. On success, attach the domain to the user's site and update the
//      domain_orders row to `registered`.
//   4. On failure, mark the order failed and refund the customer.

import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { vercelBuyDomain, type RegistrantContact } from "@/lib/domainPurchase";
import { attachCustomDomain } from "@/lib/vercelDomains";
import { refundCheckoutSession } from "@/lib/agencyPhone";

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (full || "").trim();
  if (!trimmed) return { firstName: "Domain", lastName: "Owner" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function buildContact(session: Stripe.Checkout.Session): RegistrantContact | null {
  const cd = session.customer_details;
  if (!cd) return null;
  const addr = cd.address;
  if (!addr || !addr.line1 || !addr.city || !addr.country || !addr.postal_code) return null;
  if (!cd.email || !cd.phone) return null;

  const { firstName, lastName } = splitName(cd.name);

  return {
    firstName,
    lastName,
    email: cd.email,
    phone: cd.phone,
    address1: addr.line1,
    city: addr.city,
    state: addr.state || addr.city,
    postalCode: addr.postal_code,
    country: addr.country,
  };
}

export async function fulfillDomainPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const siteId = session.metadata?.siteId;
  const domain = session.metadata?.domain;
  const wholesaleCents = parseInt(session.metadata?.wholesaleCents || "0", 10);
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;

  if (!userId || !siteId || !domain || !wholesaleCents) {
    console.error("[domainFulfillment] missing metadata on session", session.id);
    await refundCheckoutSession(session.id, "missing metadata on session");
    return;
  }

  // Idempotency — if we already registered this order, no-op.
  const { data: order } = await supabaseAdmin
    .from("domain_orders")
    .select("id, status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (order?.status === "registered") return;

  await supabaseAdmin
    .from("domain_orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id);

  const contact = buildContact(session);
  if (!contact) {
    await supabaseAdmin
      .from("domain_orders")
      .update({ status: "failed", error: "Missing registrant contact details" })
      .eq("stripe_session_id", session.id);
    await refundCheckoutSession(session.id, "missing registrant contact info");
    return;
  }

  const result = await vercelBuyDomain(domain, wholesaleCents, contact);
  if (!result.ok) {
    await supabaseAdmin
      .from("domain_orders")
      .update({
        status: "failed",
        error: result.error,
        contact: contact as unknown as Record<string, unknown>,
      })
      .eq("stripe_session_id", session.id);
    await refundCheckoutSession(session.id, `Vercel buy failed: ${result.error}`);
    return;
  }

  // Vercel auto-attaches purchased domains to the team's project list. We
  // also call attachCustomDomain to bind it to *this specific project*,
  // matching the BYO flow's verified-with-Vercel state.
  const attach = await attachCustomDomain(domain);
  // If attach failed, we still mark registered — the domain is owned and
  // can be manually attached from the UI. Loud-log it so we notice.
  if (!attach.ok) {
    console.error(`[domainFulfillment] domain ${domain} bought but project-attach failed:`, attach.error);
  }

  // Roll the success state into both the order and the site row.
  await supabaseAdmin
    .from("domain_orders")
    .update({
      status: "registered",
      expires_at: result.expiresAt,
      contact: contact as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id);

  await supabaseAdmin
    .from("generated_websites")
    .update({
      custom_domain: domain,
      custom_domain_status: attach.ok ? "verified" : "pending",
      custom_domain_attached_at: new Date().toISOString(),
      custom_domain_error: null,
      custom_domain_purchased: true,
      custom_domain_expires_at: result.expiresAt,
    })
    .eq("id", siteId)
    .eq("user_id", userId);
}
