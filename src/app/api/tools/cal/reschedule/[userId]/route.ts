import { NextRequest, NextResponse } from "next/server";
import { authorizeToolCall } from "@/lib/toolAuth";
import { rescheduleBooking } from "@/lib/calcom";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeToolCall(req, userId);
  if ("error" in auth) return auth.error;

  const { booking_uid, new_start_time, reason } = (await req.json().catch(() => ({}))) || {};
  if (!booking_uid || !new_start_time) {
    return NextResponse.json({ success: false, error: "booking_uid and new_start_time required" }, { status: 400 });
  }

  try {
    const result = await rescheduleBooking(auth.creds, { bookingUid: booking_uid, newStartTime: new_start_time, reason });
    return NextResponse.json({
      success: true,
      booking_uid: result.data.uid,
      start: result.data.start,
      end: result.data.end,
      message: `Rescheduled to ${result.data.start}.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Reschedule failed" }, { status: 500 });
  }
}
