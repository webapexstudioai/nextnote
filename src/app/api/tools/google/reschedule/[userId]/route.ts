import { NextRequest, NextResponse } from "next/server";
import { updateEvent } from "@/lib/googleCalendar";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const expected = process.env.TOOLS_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "Tool webhooks not configured" }, { status: 500 });
  if (req.headers.get("x-nextnote-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;

  const { booking_uid, new_start_time, duration_minutes } = (await req.json().catch(() => ({}))) || {};
  if (!booking_uid || !new_start_time) {
    return NextResponse.json({ success: false, error: "booking_uid and new_start_time required" }, { status: 400 });
  }

  try {
    const result = await updateEvent(userId, {
      eventId: booking_uid,
      newStartTime: new_start_time,
      durationMinutes: duration_minutes ? Number(duration_minutes) : undefined,
    });
    return NextResponse.json({
      success: true,
      booking_uid: result.eventId,
      start: result.start,
      end: result.end,
      message: `Rescheduled to ${result.start}.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Reschedule failed" }, { status: 500 });
  }
}
