import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// Mirrors /api/agency/phone/search but admin-gated and trimmed down to
// what the comp-flow needs: pick by area code, single Twilio call, return
// up to 20 numbers.

interface TwilioNumber {
  phone_number: string;
  friendly_name: string;
  locality?: string;
  region?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json({ error: "Phone provider not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const areaCode = typeof body.areaCode === "string" ? body.areaCode.replace(/\D/g, "").slice(0, 3) : "";
  const country = typeof body.country === "string" && body.country.length === 2 ? body.country : "US";

  const params = new URLSearchParams({
    Limit: "20",
    VoiceEnabled: "true",
    SmsEnabled: "true",
  });
  if (areaCode) params.set("AreaCode", areaCode);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${country}/Local.json?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Twilio search error:", res.status, text);
    return NextResponse.json({ error: `Twilio ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  const numbers = (data.available_phone_numbers || []) as TwilioNumber[];

  return NextResponse.json({ numbers });
}
