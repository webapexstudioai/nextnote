import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
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

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      const s = await getSession();
      s.accessToken = tokens.access_token;
      if (tokens.expiry_date) s.expiresAt = tokens.expiry_date;
      await s.save();
    }
  });

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
    console.error("Calendar event delete error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete calendar event" }, { status: 500 });
  }
}
