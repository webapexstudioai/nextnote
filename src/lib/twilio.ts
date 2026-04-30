// Thin Twilio wrapper. Voice/voicemail uses the REST API directly (see
// /api/voicemail/send). This file is the single place we issue SMS.

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

export function twilioConfigured(): boolean {
  return !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export interface SendSmsParams {
  from: string;
  to: string;
  body: string;
  statusCallback?: string;
}

export interface SendSmsResult {
  sid: string;
  status: string;
}

export async function sendSms({ from, to, body, statusCallback }: SendSmsParams): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) throw new Error("Twilio not configured");

  const params = new URLSearchParams({ From: from, To: to, Body: body });
  if (statusCallback) params.set("StatusCallback", statusCallback);

  const res = await fetch(`${TWILIO_BASE}/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Twilio error ${res.status}`);
  }
  return { sid: data.sid, status: data.status };
}

// Renders {placeholders} in template body. Unknown placeholders are left
// in place so the user sees them and notices the typo.
export interface TemplateContext {
  prospect_name?: string | null;
  contact_name?: string | null;
  my_name?: string | null;
  my_agency?: string | null;
}

export function renderTemplate(body: string, ctx: TemplateContext): string {
  const contact = (ctx.contact_name || ctx.prospect_name || "").trim();
  const firstName = contact ? contact.split(/\s+/)[0] : "";
  const map: Record<string, string> = {
    first_name: firstName,
    name: contact,
    business: (ctx.prospect_name || "").trim(),
    my_name: (ctx.my_name || "").trim(),
    my_agency: (ctx.my_agency || "").trim(),
  };
  return body.replace(/\{(\w+)\}/g, (full, key: string) => {
    return key in map ? map[key] : full;
  });
}
