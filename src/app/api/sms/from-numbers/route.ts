import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

// Numbers the user can SEND outbound SMS from. Only Twilio-purchased
// numbers with purpose='agency' are SMS-capable on our master account —
// verified caller IDs are voice-only (carrier SMSC restriction), and
// AI receptionist numbers are tied to specific prospects.
export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: owned } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("phone_number, label")
    .eq("user_id", userId)
    .eq("purpose", "agency");

  const numbers = (owned ?? []).map((r: { phone_number: string; label: string | null }) => ({
    phone_number: r.phone_number,
    label: r.label || r.phone_number,
    source: "purchased" as const,
  }));

  return NextResponse.json({ numbers });
}
