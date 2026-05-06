import { recordPhoneNumberOwnership } from "@/lib/agentOwnership";

// Buys the requested phone number on NextNote's master Twilio account and
// imports it into ElevenLabs ConvAI. Records ownership in user_phone_numbers
// with the Stripe subscription so the monthly cron knows to skip it.
//
// Caller is responsible for compensating action on failure (e.g. cancel +
// refund the Stripe subscription that paid for this provision attempt).
export async function provisionAiPhoneNumber(args: {
  userId: string;
  phoneNumber: string;
  label?: string;
  stripeSubscriptionId?: string | null;
}): Promise<{ success: true; elevenLabsId: string; phoneNumber: string } | { success: false; error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!sid || !token || !elevenKey) {
    return { success: false, error: "Phone number purchasing is not configured." };
  }

  const label = (args.label || "NextNote Agent Line").slice(0, 64);

  const purchaseRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        PhoneNumber: args.phoneNumber,
        FriendlyName: label,
        VoiceCapability: "true",
      }),
    },
  );
  const purchaseData = await purchaseRes.json();
  if (!purchaseRes.ok) {
    return { success: false, error: purchaseData?.message || "Failed to purchase number on Twilio" };
  }

  const importRes = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
    method: "POST",
    headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "twilio",
      label,
      phone_number: purchaseData.phone_number,
      sid,
      token,
    }),
  });
  const importData = await importRes.json();

  if (!importRes.ok || !importData?.phone_number_id) {
    const msg =
      importData?.detail?.message ||
      importData?.detail ||
      importData?.message ||
      importData?.error ||
      `ElevenLabs import failed (${importRes.status})`;
    // Release the Twilio number — we never wired it up.
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${purchaseData.sid}.json`,
      { method: "DELETE", headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` } },
    ).catch(() => {});
    return { success: false, error: typeof msg === "string" ? msg : "ElevenLabs rejected the number" };
  }

  try {
    await recordPhoneNumberOwnership(
      args.userId,
      importData.phone_number_id,
      purchaseData.phone_number,
      label,
      purchaseData.sid || null,
      args.stripeSubscriptionId || null,
    );
  } catch (err) {
    // Roll back both Twilio + ElevenLabs so we don't orphan a paid line.
    await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${importData.phone_number_id}`,
      { method: "DELETE", headers: { "xi-api-key": elevenKey } },
    ).catch(() => {});
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${purchaseData.sid}.json`,
      { method: "DELETE", headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` } },
    ).catch(() => {});
    return { success: false, error: err instanceof Error ? err.message : "Failed to record ownership" };
  }

  return { success: true, elevenLabsId: importData.phone_number_id, phoneNumber: purchaseData.phone_number };
}

// Cancels the Stripe subscription that paid for an AI phone line and releases
// the Twilio + ElevenLabs resources. Used both on user-initiated release and
// on subscription deletion (e.g. payment failed and Stripe gave up).
export async function releaseAiPhoneNumber(args: {
  elevenLabsId: string | null;
  twilioSid: string | null;
}): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  if (args.elevenLabsId && elevenKey) {
    await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${args.elevenLabsId}`,
      { method: "DELETE", headers: { "xi-api-key": elevenKey } },
    ).catch(() => {});
  }
  if (args.twilioSid && sid && token) {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${args.twilioSid}.json`,
      {
        method: "DELETE",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      },
    ).catch(() => {});
  }
}
