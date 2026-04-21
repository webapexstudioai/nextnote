import { NextRequest, NextResponse } from "next/server";
import { getFreeBusy } from "@/lib/googleCalendar";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const expected = process.env.TOOLS_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "Tool webhooks not configured" }, { status: 500 });
  if (req.headers.get("x-nextnote-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;

  const { start_date, end_date } = (await req.json().catch(() => ({}))) || {};
  if (!start_date || !end_date) {
    return NextResponse.json({ success: false, error: "start_date and end_date required" }, { status: 400 });
  }

  try {
    const { busy, timeZone } = await getFreeBusy(userId, { startDate: start_date, endDate: end_date });
    return NextResponse.json({
      success: true,
      timezone: timeZone,
      busy_blocks: busy,
      message: busy.length
        ? `Found ${busy.length} busy block(s) between ${start_date} and ${end_date}. Any other time in the range is open.`
        : `Calendar is fully open between ${start_date} and ${end_date}.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Availability lookup failed" }, { status: 500 });
  }
}
