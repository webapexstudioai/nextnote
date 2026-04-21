import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userLimit = rateLimit(`sly:${session.userId}`, 60, 60 * 60_000); // 60/hour/user
  if (!userLimit.ok) {
    return NextResponse.json(
      { error: `Voicemail rate limit reached. Try again in ${Math.ceil(userLimit.retryAfterSec / 60)} min.` },
      { status: 429 }
    );
  }
  const ipLimit = rateLimit(clientKey(req, "sly"), 120, 60 * 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { phone, audioUrl, message, campaignName, callerId, prospectName, audioFileName } = await req.json();

  // If Make webhook is configured, use it instead of direct API
  const makeWebhookUrl = process.env.MAKE_VOICEMAIL_WEBHOOK_URL;
  if (makeWebhookUrl) {
    try {
      const res = await fetch(makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          callerId,
          audioFileName: audioFileName || message || "",
          audioUrl: audioUrl || "",
          prospectName: prospectName || "",
          campaignName: campaignName || `NextNote — ${prospectName || phone}`,
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Voicemail drop queued via Make" });
      }
    } catch (err) {
      console.error("Make webhook error:", err);
    }
  }

  if (!phone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  if (!callerId) {
    return NextResponse.json({ error: "Caller ID (your phone number) is required" }, { status: 400 });
  }

  if (callerId === phone) {
    return NextResponse.json({ error: "Caller ID cannot be the same as the destination phone number" }, { status: 400 });
  }

  const email = process.env.SLYBROADCAST_EMAIL;
  const password = process.env.SLYBROADCAST_PASSWORD;

  if (!email || !password) {
    return NextResponse.json({ error: "Slybroadcast credentials not configured" }, { status: 500 });
  }

  const formData = new URLSearchParams();
  formData.append("c_uid", email);
  formData.append("c_password", password);
  formData.append("c_phone", phone);
  formData.append("c_callerID", callerId);
  formData.append("c_date", "now");

  if (campaignName) {
    formData.append("c_campaign_name", campaignName);
  }

  if (audioUrl) {
    formData.append("c_url", audioUrl);
    formData.append("c_audio", "mp3");
  } else if (message) {
    formData.append("c_record_audio", message);
  } else {
    return NextResponse.json({ error: "Either audioUrl or message is required" }, { status: 400 });
  }

  if (campaignName) {
    formData.append("c_title", campaignName);
  }

  try {
    const res = await fetch("https://www.mobile-sphere.com/gateway/vmb.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const text = await res.text();

    // Slybroadcast returns OK or error text
    if (text.toLowerCase().includes("ok") || text.toLowerCase().includes("success")) {
      return NextResponse.json({ success: true, response: text });
    }

    return NextResponse.json({ success: false, error: text }, { status: 400 });
  } catch (error) {
    console.error("Slybroadcast API error:", error);
    return NextResponse.json({ error: "Failed to send voicemail" }, { status: 500 });
  }
}
