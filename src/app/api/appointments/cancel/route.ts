import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import {
  getAuthedGoogleClient,
  googleReconnectResponse,
  isGoogleAuthError,
} from "@/lib/google";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated with Google" }, { status: 401 });
  }

  const { calendarEventId } = await req.json();
  if (!calendarEventId) {
    return NextResponse.json({ error: "Missing calendarEventId" }, { status: 400 });
  }

  const oauth2Client = await getAuthedGoogleClient(session);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: calendarEventId,
      sendUpdates: "all",
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 404 || err.code === 410) {
      return NextResponse.json({ success: true, alreadyGone: true });
    }
    if (isGoogleAuthError(error)) {
      return googleReconnectResponse();
    }
    console.error("Calendar event delete error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete calendar event" }, { status: 500 });
  }
}
