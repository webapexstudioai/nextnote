import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated with Google" }, { status: 401 });
  }

  const { prospectName, prospectEmail, date, time, duration, agenda } = await req.json();

  if (!date || !time || !duration) {
    return NextResponse.json({ error: "Missing required fields: date, time, duration" }, { status: 400 });
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  // Listen for token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      const s = await getSession();
      s.accessToken = tokens.access_token;
      if (tokens.expiry_date) s.expiresAt = tokens.expiry_date;
      await s.save();
    }
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

  const attendees = prospectEmail ? [{ email: prospectEmail }] : [];

  try {
    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Meeting with ${prospectName || "Prospect"}`,
        description: agenda || undefined,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `nextnote-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 15 },
          ],
        },
      },
    });

    const meetLink = event.data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video"
    )?.uri;

    return NextResponse.json({
      meetLink: meetLink || null,
      calendarEventId: event.data.id,
    });
  } catch (error) {
    console.error("Calendar event creation error:", error);
    return NextResponse.json({ error: "Failed to create calendar event" }, { status: 500 });
  }
}
