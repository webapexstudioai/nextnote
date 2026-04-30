import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/crm";

// Proxy to Twilio AvailablePhoneNumbers for the agency-line picker.
// Mirrors /api/agents/twilio/available-numbers but kept separate so the
// agency UI can evolve independently (e.g. requiring SMS capability).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      return NextResponse.json({ error: "Phone number purchasing is not configured yet." }, { status: 503 });
    }

    const { areaCode, country } = await req.json().catch(() => ({}));
    const countryCode = country || "US";
    // Agency numbers must do both voice (forwarding) and SMS (follow-ups).
    const params = new URLSearchParams({ Limit: "20", VoiceEnabled: "true", SmsEnabled: "true" });
    if (areaCode) params.set("AreaCode", String(areaCode));

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${countryCode}/Local.json?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.message || "Failed to search numbers" }, { status: res.status });

    return NextResponse.json({ numbers: data.available_phone_numbers || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
