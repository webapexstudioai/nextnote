import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      return NextResponse.json({ error: "Phone provider not configured" }, { status: 503 });
    }

    const { phone_number } = await req.json();
    if (!phone_number) {
      return NextResponse.json({ error: "phone_number required" }, { status: 400 });
    }

    const { data: row } = await supabaseAdmin
      .from("user_caller_ids")
      .select("*")
      .eq("user_id", session.userId)
      .eq("phone_number", phone_number)
      .maybeSingle();
    if (!row) {
      return NextResponse.json({ error: "Number not found" }, { status: 404 });
    }
    if (row.verified) {
      return NextResponse.json({ verified: true, phone_number });
    }

    const params = new URLSearchParams({ PhoneNumber: phone_number });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/OutgoingCallerIds.json?${params}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || "Failed to check verification" },
        { status: res.status }
      );
    }

    const list = data.outgoing_caller_ids || [];
    const match = list.find(
      (n: { phone_number: string }) => n.phone_number === phone_number
    );

    if (!match) {
      return NextResponse.json({
        verified: false,
        message: "Not verified yet. Answer the call and enter the code.",
      });
    }

    await supabaseAdmin
      .from("user_caller_ids")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        twilio_caller_id_sid: match.sid,
      })
      .eq("user_id", session.userId)
      .eq("phone_number", phone_number);

    return NextResponse.json({ verified: true, phone_number });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
