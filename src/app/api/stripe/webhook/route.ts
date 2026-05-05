import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { addCredits, deductCredits, getBalance, hasBeenProcessed } from "@/lib/credits";
import { sendWelcomeEmail } from "@/lib/email-templates";
import { purchaseAgencyNumber, refundCheckoutSession } from "@/lib/agencyPhone";
import { fulfillDomainPurchase } from "@/lib/domainFulfillment";

const ALLOWED_PLANS = new Set(["starter", "pro"]);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const kind = session.metadata?.kind;

        // Credit pack purchase
        if (userId && kind === "credit_purchase") {
          const credits = parseInt(session.metadata?.credits || "0", 10);
          if (credits > 0 && !(await hasBeenProcessed(session.id))) {
            await addCredits(userId, credits, {
              reason: "purchase",
              refId: session.id,
              metadata: { packId: session.metadata?.packId },
            });
          }
          break;
        }

        // Agency phone line purchase — buy on Twilio + wire webhooks. If
        // anything fails after payment cleared, refund the customer.
        if (userId && kind === "agency_phone_purchase") {
          const phoneNumber = session.metadata?.phoneNumber;
          const friendlyName = session.metadata?.friendlyName;
          if (!phoneNumber) {
            console.error(`[webhook] agency_phone_purchase missing phoneNumber on session ${session.id}`);
            await refundCheckoutSession(session.id, "missing phoneNumber metadata");
            break;
          }
          const result = await purchaseAgencyNumber({ userId, phoneNumber, friendlyName });
          if (!result.success) {
            console.error(`[webhook] agency phone purchase failed: ${result.error}`);
            await refundCheckoutSession(session.id, result.error);
          }
          break;
        }

        // Domain purchase — register through Vercel + attach to site.
        // The fulfillment helper handles refund-on-failure internally.
        if (userId && kind === "domain_purchase") {
          await fulfillDomainPurchase(session);
          break;
        }

        // Trial → paid conversion. Just clear the trial timestamps so the
        // cron stops counting it as expirable. No Twilio work needed since
        // the number was already provisioned at trial claim.
        if (userId && kind === "agency_phone_keep") {
          const { error } = await supabaseAdmin
            .from("user_phone_numbers")
            .update({ trial_started_at: null, trial_ends_at: null })
            .eq("user_id", userId)
            .eq("purpose", "agency");
          if (error) {
            console.error(`[webhook] agency_phone_keep DB update failed:`, error);
            await refundCheckoutSession(session.id, `DB error: ${error.message}`);
          }
          break;
        }

        // Subscription checkout
        const plan = session.metadata?.plan;
        if (userId && plan && ALLOWED_PLANS.has(plan)) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.toString() || "";

          await supabaseAdmin
            .from("users")
            .update({
              subscription_tier: plan,
              subscription_status: "active",
              stripe_subscription_id: subscriptionId,
            })
            .eq("id", userId);

          if (plan === "pro" && !(await hasBeenProcessed(`sub_bonus_${session.id}`))) {
            await addCredits(userId, 100, {
              reason: "pro_upgrade_bonus",
              refId: `sub_bonus_${session.id}`,
              metadata: { plan },
            });
          }

          if (plan === "starter" || plan === "pro") {
            const { data: u } = await supabaseAdmin
              .from("users")
              .select("email")
              .eq("id", userId)
              .single();
            if (u?.email) {
              try {
                await sendWelcomeEmail(u.email, plan);
              } catch (e) {
                console.error("Welcome email failed:", e);
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const plan = subscription.metadata?.plan;

        if (userId) {
          let status: string = "active";
          if (subscription.status === "past_due") status = "past_due";
          else if (subscription.status === "canceled") status = "canceled";
          else if (subscription.status === "trialing") status = "trialing";

          const updateData: Record<string, string> = { subscription_status: status };
          if (plan && ["starter", "pro"].includes(plan)) {
            updateData.subscription_tier = plan;
          }

          await supabaseAdmin
            .from("users")
            .update(updateData)
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await supabaseAdmin
            .from("users")
            .update({
              subscription_status: "canceled",
              subscription_tier: "starter",
            })
            .eq("id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
        if (!customerId) break;

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (user?.id) {
          await supabaseAdmin
            .from("users")
            .update({ subscription_status: "past_due" })
            .eq("id", user.id);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
        if (!paymentIntentId) break;

        // Correlate the refund back to the original checkout session so we
        // know what it was for (credit purchase vs subscription payment).
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });
        const originalSession = sessions.data[0];
        if (!originalSession) break;

        const userId = originalSession.metadata?.userId;
        const kind = originalSession.metadata?.kind;
        const credits = parseInt(originalSession.metadata?.credits || "0", 10);

        // Reverse credits for credit-purchase refunds. Idempotent per refund.id
        // so admin-initiated refunds (which use the same refId) don't
        // double-reverse. Clamp to current balance — user may have already
        // spent some of the credits.
        if (userId && kind === "credit_purchase" && credits > 0) {
          for (const refund of charge.refunds?.data ?? []) {
            if (await hasBeenProcessed(refund.id)) continue;
            const balance = await getBalance(userId);
            const amount = Math.min(credits, balance);
            if (amount > 0) {
              await deductCredits(userId, amount, {
                reason: "refund",
                refId: refund.id,
                metadata: {
                  chargeId: charge.id,
                  refundId: refund.id,
                  originalSessionId: originalSession.id,
                  originalCredits: credits,
                  source: "stripe_webhook",
                },
              });
            }
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Return 200 so Stripe doesn't retry indefinitely on bugs in our handler.
    // Log loudly so we can alert and replay manually if needed. Signature
    // verification failures above still return 400 (they should be retried).
    console.error(
      `Webhook processing error [event=${event.type} id=${event.id}]:`,
      err,
    );
    return NextResponse.json({ received: true, handled: false });
  }
}
