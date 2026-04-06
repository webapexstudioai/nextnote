import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phone, callerId, audioFileName, audioUrl, prospectName, campaignName } = await req.json();

    if (!phone || !callerId) {
      return NextResponse.json({ error: "phone and callerId are required" }, { status: 400 });
    }

    const makeWebhookUrl = process.env.MAKE_VOICEMAIL_WEBHOOK_URL;
    if (!makeWebhookUrl) {
      return NextResponse.json({ error: "Make webhook URL not configured" }, { status: 500 });
    }

    // Forward to Make webhook
    const res = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        callerId,
        audioFileName: audioFileName || "",
        audioUrl: audioUrl || "",
        prospectName: prospectName || "",
        campaignName: campaignName || `NextNote — ${prospectName || phone}`,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to trigger Make webhook" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Voicemail drop queued via Make" });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
