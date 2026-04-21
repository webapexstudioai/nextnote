import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_caller_ids")
    .select("id, phone_number, friendly_name, verified, created_at, verified_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ caller_ids: data || [] });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { phone_number } = await req.json();
  if (!phone_number) {
    return NextResponse.json({ error: "phone_number required" }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin
    .from("user_caller_ids")
    .select("twilio_caller_id_sid")
    .eq("user_id", session.userId)
    .eq("phone_number", phone_number)
    .maybeSingle();

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token && row?.twilio_caller_id_sid) {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/OutgoingCallerIds/${row.twilio_caller_id_sid}.json`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
      }
    ).catch(() => {});
  }

  const { error } = await supabaseAdmin
    .from("user_caller_ids")
    .delete()
    .eq("user_id", session.userId)
    .eq("phone_number", phone_number);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
