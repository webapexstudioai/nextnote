import { NextResponse } from "next/server";

// Retired 2026-05-05: AI receptionist phone numbers now bill via Stripe
// subscription ($5/mo) instead of credits. The new flow lives at
// POST /api/agents/twilio/checkout. Credits stay reserved for AI usage
// so users don't see their balance silently drained by line rentals.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint has been replaced. Phone numbers are now billed via Stripe subscription — use /api/agents/twilio/checkout.",
    },
    { status: 410 },
  );
}
