import { NextRequest, NextResponse } from "next/server";
import { createEvent } from "@/lib/googleCalendar";

function checkSecret(req: NextRequest) {
  const expected = process.env.TOOLS_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "Tool webhooks not configured" }, { status: 500 });
  if (req.headers.get("x-nextnote-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const denied = checkSecret(req);
  if (denied) return denied;
  const { userId } = await params;

  const { attendee_name, attendee_email, start_time, notes, duration_minutes } = (await req.json().catch(() => ({}))) || {};
  if (!attendee_name || !attendee_email || !start_time) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await createEvent(userId, {
      attendeeName: attendee_name,
      attendeeEmail: attendee_email,
      startTime: start_time,
      notes,
      durationMinutes: duration_minutes ? Number(duration_minutes) : undefined,
    });
    return NextResponse.json({
      success: true,
      booking_uid: result.eventId,
      start: result.start,
      end: result.end,
      meeting_url: result.meetLink,
      message: `Booked for ${attendee_name} at ${result.start}.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Booking failed" }, { status: 500 });
  }
}
