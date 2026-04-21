import { NextRequest, NextResponse } from "next/server";
import { authorizeToolCall } from "@/lib/toolAuth";
import { createBooking } from "@/lib/calcom";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeToolCall(req, userId);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { attendee_name, attendee_email, start_time, notes } = body || {};
  if (!attendee_name || !attendee_email || !start_time) {
    return NextResponse.json({ error: "Missing required fields", success: false }, { status: 400 });
  }

  try {
    const result = await createBooking(auth.creds, {
      attendeeName: attendee_name,
      attendeeEmail: attendee_email,
      startTime: start_time,
      notes,
    });
    return NextResponse.json({
      success: true,
      booking_uid: result.data.uid,
      start: result.data.start,
      end: result.data.end,
      meeting_url: result.data.meetingUrl || null,
      message: `Booked for ${attendee_name} at ${result.data.start}.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Booking failed" }, { status: 500 });
  }
}
