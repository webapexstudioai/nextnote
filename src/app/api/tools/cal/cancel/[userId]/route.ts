import { NextRequest, NextResponse } from "next/server";
import { authorizeToolCall } from "@/lib/toolAuth";
import { cancelBooking } from "@/lib/calcom";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeToolCall(req, userId);
  if ("error" in auth) return auth.error;

  const { booking_uid, reason } = (await req.json().catch(() => ({}))) || {};
  if (!booking_uid) {
    return NextResponse.json({ success: false, error: "booking_uid required" }, { status: 400 });
  }

  try {
    const result = await cancelBooking(auth.creds, { bookingUid: booking_uid, reason });
    return NextResponse.json({
      success: true,
      booking_uid: result.data.uid,
      status: result.data.status,
      message: "Booking cancelled.",
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Cancel failed" }, { status: 500 });
  }
}
