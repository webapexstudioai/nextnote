import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePro } from "@/lib/tierGuard";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const gate = await requirePro(session.userId, "Voicemail drops");
    if (!gate.ok) return gate.response;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
    }

    const { phone_number, friendly_name } = await req.json();
    const phone = normalizePhone(String(phone_number || ""));
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const label = (friendly_name || "My Phone").toString().slice(0, 64);

    const form = new URLSearchParams({
      PhoneNumber: phone,
      FriendlyName: label,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/OutgoingCallerIds.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || "Failed to start verification";
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const validationCode: string = data.validation_code;
    const validationSid: string | null = data.call_sid || null;

    await supabaseAdmin
      .from("user_caller_ids")
      .upsert(
        {
          user_id: session.userId,
          phone_number: phone,
          friendly_name: label,
          twilio_validation_sid: validationSid || null,
          verified: false,
        },
        { onConflict: "user_id,phone_number" }
      );

    return NextResponse.json({
      phone_number: phone,
      validation_code: validationCode,
      message: "Twilio is calling the number now. When prompted, enter the code on your phone's keypad.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
