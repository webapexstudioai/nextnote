import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Twilio posts here as form-urlencoded with MessageSid + MessageStatus.
// We map the message back via the ?id query param we set when sending.
export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const form = await req.formData();
  const status = (form.get("MessageStatus") || form.get("SmsStatus") || "").toString();
  const errorCode = (form.get("ErrorCode") || "").toString();
  const errorMessage = (form.get("ErrorMessage") || "").toString();

  if (!status) return NextResponse.json({ ok: true });

  const update: Record<string, string | null> = { status };
  if (status === "delivered") update.delivered_at = new Date().toISOString();
  if (status === "failed" || status === "undelivered") {
    update.error_message = errorMessage || (errorCode ? `Twilio code ${errorCode}` : "delivery failed");
  }

  await supabaseAdmin.from("sms_messages").update(update).eq("id", id);
  return NextResponse.json({ ok: true });
}
