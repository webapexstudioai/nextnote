import { NextRequest, NextResponse } from "next/server";
import { authorizeToolCall } from "@/lib/toolAuth";
import { getAvailableSlots } from "@/lib/calcom";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeToolCall(req, userId);
  if ("error" in auth) return auth.error;

  const { start_date, end_date } = (await req.json().catch(() => ({}))) || {};
  if (!start_date || !end_date) {
    return NextResponse.json({ success: false, error: "start_date and end_date required" }, { status: 400 });
  }

  try {
    const result = await getAvailableSlots(auth.creds, { startDate: start_date, endDate: end_date });
    const slots: string[] = [];
    for (const day of Object.values(result.data || {})) {
      for (const s of day) slots.push(s.start);
    }
    return NextResponse.json({
      success: true,
      slots: slots.slice(0, 20),
      message: slots.length ? `Found ${slots.length} open slots between ${start_date} and ${end_date}.` : "No open slots in that range.",
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Availability lookup failed" }, { status: 500 });
  }
}
