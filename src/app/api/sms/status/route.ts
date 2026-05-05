import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Translate common Twilio SMS error codes into something a user can act on.
// Full list: https://www.twilio.com/docs/api/errors
function explainErrorCode(code: string, fallback: string): string {
  switch (code) {
    case "30003":
      return "Recipient phone is unreachable (off / no signal)";
    case "30004":
      return "Recipient blocked your number";
    case "30005":
      return "Recipient number does not exist";
    case "30006":
      return "Landline or unreachable carrier — can't receive SMS";
    case "30007":
      return "Carrier filtered (often: A2P 10DLC not registered, or content flagged as spam)";
    case "30008":
      return "Unknown carrier error";
    case "30034":
      return "Number not registered with A2P 10DLC — register your brand to send to US carriers";
    case "21610":
      return "Recipient previously replied STOP";
    case "21614":
      return "Invalid recipient phone number";
    default:
      return fallback || (code ? `Carrier code ${code}` : "delivery failed");
  }
}

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
    update.error_message = explainErrorCode(errorCode, errorMessage);
  }

  await supabaseAdmin.from("sms_messages").update(update).eq("id", id);
  return NextResponse.json({ ok: true });
}
