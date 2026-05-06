import { NextRequest, NextResponse } from "next/server";
import { deleteEvent } from "@/lib/googleCalendar";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const expected = process.env.TOOLS_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "Tool webhooks not configured" }, { status: 500 });
  if (req.headers.get("x-nextnote-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;

  const { booking_uid } = (await req.json().catch(() => ({}))) || {};
  if (!booking_uid) {
    return NextResponse.json({ success: false, error: "booking_uid required" }, { status: 400 });
  }

  try {
    await deleteEvent(userId, { eventId: booking_uid });
    return NextResponse.json({
      success: true,
      booking_uid,
      message: "Booking cancelled.",
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Cancel failed" }, { status: 500 });
  }
}
