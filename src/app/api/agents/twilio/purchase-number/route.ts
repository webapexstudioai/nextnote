import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { recordPhoneNumberOwnership } from "@/lib/agentOwnership";
import { deductCredits, addCredits, getBalance, PHONE_NUMBER_PURCHASE_CREDITS } from "@/lib/credits";

// Reseller mode: purchases on NextNote's master Twilio account, deducts credits.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    if (!sid || !token || !elevenKey) {
      return NextResponse.json({ error: "Phone number purchasing is not configured yet." }, { status: 503 });
    }

    const { phoneNumber, friendlyName } = await req.json();
    if (!phoneNumber) return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });

    const balance = await getBalance(session.userId);
    if (balance < PHONE_NUMBER_PURCHASE_CREDITS) {
      return NextResponse.json({
        error: `Not enough credits. Buying a number costs ${PHONE_NUMBER_PURCHASE_CREDITS} credits; you have ${balance}.`,
      }, { status: 402 });
    }

    // Deduct first (pessimistic). Refund if anything below fails.
    const label = friendlyName || "NextNote Agent Line";
    await deductCredits(session.userId, PHONE_NUMBER_PURCHASE_CREDITS, {
      reason: "phone_number_purchase_hold",
      metadata: { phoneNumber },
    });

    // 1) Purchase on master Twilio
    const purchaseRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          PhoneNumber: phoneNumber,
          FriendlyName: label,
          VoiceCapability: "true",
        }),
      }
    );
    const purchaseData = await purchaseRes.json();
    if (!purchaseRes.ok) {
      await addCredits(session.userId, PHONE_NUMBER_PURCHASE_CREDITS, {
        reason: "phone_number_purchase_refund",
        metadata: { phoneNumber, error: purchaseData?.message },
      });
      return NextResponse.json({ error: purchaseData?.message || "Failed to purchase number" }, { status: purchaseRes.status });
    }

    // 2) Import into ElevenLabs so they own the Twilio voice webhook routing
    const importRes = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers/twilio", {
      method: "POST",
      headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        phone_number: purchaseData.phone_number,
        sid,
        token,
      }),
    });
    const importData = await importRes.json();

    if (!importRes.ok || !importData?.phone_number_id) {
      // Surface the real ElevenLabs error so we can debug mismatches,
      // plan limits, missing voice capability, bad creds, etc.
      const elevenMsg =
        importData?.detail?.message ||
        importData?.detail ||
        importData?.message ||
        importData?.error ||
        JSON.stringify(importData);
      console.error("[purchase-number] ElevenLabs import failed", {
        status: importRes.status,
        body: importData,
        phoneNumber: purchaseData.phone_number,
      });
      // Release the Twilio number so we're not billed for an orphan.
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${purchaseData.sid}.json`,
        { method: "DELETE", headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` } }
      ).catch(() => {});
      await addCredits(session.userId, PHONE_NUMBER_PURCHASE_CREDITS, {
        reason: "phone_number_purchase_refund",
        metadata: { phoneNumber, error: elevenMsg, elevenStatus: importRes.status },
      });
      return NextResponse.json({
        error: `ElevenLabs rejected the number (${importRes.status}): ${typeof elevenMsg === "string" ? elevenMsg : "see server logs"}. Number released and credits refunded.`,
      }, { status: 500 });
    }

    await recordPhoneNumberOwnership(
      session.userId,
      importData.phone_number_id,
      purchaseData.phone_number,
      label,
      purchaseData.sid || null
    );

    return NextResponse.json({
      purchased: true,
      imported: true,
      phoneNumber: purchaseData.phone_number,
      elevenLabsId: importData.phone_number_id,
      creditsCharged: PHONE_NUMBER_PURCHASE_CREDITS,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
