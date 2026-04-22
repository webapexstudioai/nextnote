import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { addCredits, hasBeenProcessed } from "@/lib/credits";
import { sendWelcomeEmail } from "@/lib/email-templates";

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

        // Subscription checkout
        const plan = session.metadata?.plan;
        if (userId && plan) {
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
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
