import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
};

// $5/mo recurring per AI receptionist phone line. Set in Stripe dashboard
// as a recurring price ($5.00 USD, monthly). Charged immediately on checkout
// so the first month's rent and the line activation are the same transaction.
export const AI_PHONE_MONTHLY_PRICE_ID = process.env.STRIPE_PRICE_AI_PHONE_MONTHLY || "";
