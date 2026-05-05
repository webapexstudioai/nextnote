import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

function normalizeDigits(num: string): string {
  return num.replace(/\D/g, "");
}

function variants(raw: string): string[] {
  const digits = normalizeDigits(raw);
  const out = new Set<string>();
  out.add(raw);
  if (digits) {
    out.add(digits);
    out.add(`+${digits}`);
    if (digits.length === 10) {
      out.add(`+1${digits}`);
      out.add(`1${digits}`);
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      out.add(`+${digits}`);
      out.add(digits.slice(1));
    }
  }
  return Array.from(out).filter(Boolean);
}

const PROSPECT_FIELDS =
  "id, name, contact_name, status, service, deal_value, notes, email, folder_id";

type ProspectRow = {
  id: string;
  name: string;
  contact_name: string | null;
  status: string | null;
  service: string | null;
  deal_value: number | string | null;
  notes: string | null;
  email: string | null;
  folder_id: string | null;
};

async function hydrate(userId: string, row: ProspectRow) {
  // Last call: most recent voice_calls row tied to this prospect.
  const { data: lastCall } = await supabaseAdmin
    .from("voice_calls")
    .select("id, started_at, direction, status, ai_summary")
    .eq("user_id", userId)
    .eq("prospect_id", row.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Last appointment.
  const { data: lastAppt } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_at, outcome")
    .eq("user_id", userId)
    .eq("prospect_id", row.id)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    status: row.status,
    service: row.service,
    dealValue: row.deal_value,
    notes: row.notes,
    email: row.email,
    folderId: row.folder_id,
    lastCall: lastCall
      ? {
          startedAt: lastCall.started_at,
          direction: lastCall.direction,
          status: lastCall.status,
          oneLine: (lastCall.ai_summary as { one_line_takeaway?: string } | null)?.one_line_takeaway ?? null,
        }
      : null,
    lastAppointment: lastAppt
      ? { scheduledAt: lastAppt.scheduled_at, outcome: lastAppt.outcome }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const number = req.nextUrl.searchParams.get("number");
  if (!number) return NextResponse.json({ prospect: null });

  const candidates = variants(number);

  const { data } = await supabaseAdmin
    .from("prospects")
    .select(PROSPECT_FIELDS)
    .eq("user_id", userId)
    .in("phone", candidates)
    .limit(1);

  if (data && data.length > 0) {
    const prospect = await hydrate(userId, data[0] as ProspectRow);
    return NextResponse.json({ prospect });
  }

  // Fallback: digit-suffix match (last 10) for prospects whose stored phone
  // is formatted differently than what Twilio sends.
  const digits = normalizeDigits(number);
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    const { data: fuzzy } = await supabaseAdmin
      .from("prospects")
      .select(PROSPECT_FIELDS)
      .eq("user_id", userId)
      .ilike("phone", `%${last10}%`)
      .limit(1);
    if (fuzzy && fuzzy.length > 0) {
      const prospect = await hydrate(userId, fuzzy[0] as ProspectRow);
      return NextResponse.json({ prospect });
    }
  }

  return NextResponse.json({ prospect: null });
}
