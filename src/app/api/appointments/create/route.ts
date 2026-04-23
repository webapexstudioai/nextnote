import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import {
  getAuthedGoogleClient,
  googleReconnectResponse,
  isGoogleAuthError,
} from "@/lib/google";
import { getSession, getAuthSession } from "@/lib/session";

function buildLocalDateTime(date: string, time: string, addMinutes = 0) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  // Use UTC math purely as arithmetic (no timezone conversion). The result is
  // formatted as a naive local-time string for Google Calendar to pair with
  // the explicit timeZone field.
  const base = new Date(Date.UTC(y, mo - 1, d, h, m));
  base.setUTCMinutes(base.getUTCMinutes() + addMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}T${pad(base.getUTCHours())}:${pad(base.getUTCMinutes())}:00`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated with Google" }, { status: 401 });
  }

  const authSession = await getAuthSession();
  const hostName = authSession.name || authSession.agencyName;

  const { prospectName, prospectEmail, date, time, duration, agenda, timeZone } = await req.json();

  if (!date || !time || !duration) {
    return NextResponse.json({ error: "Missing required fields: date, time, duration" }, { status: 400 });
  }

  const oauth2Client = await getAuthedGoogleClient(session);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Build local-time ISO strings (no Z, no offset). When paired with the
  // timeZone field, Google Calendar resolves these to the correct absolute
  // instant in the user's timezone. Previously we emitted UTC ISO strings
  // with the server's timezone, which on Vercel is UTC — so a 5:00 PM slot
  // in CDT was being created as 5:00 PM UTC (12:00 PM CDT).
  const eventTimeZone = typeof timeZone === "string" && timeZone ? timeZone : "America/Chicago";
  const startLocal = buildLocalDateTime(date, time);
  const endLocal = buildLocalDateTime(date, time, duration);

  const attendees = prospectEmail ? [{ email: prospectEmail }] : [];

  const eventTitle = hostName && prospectName
    ? `${hostName} × ${prospectName}`
    : `Meeting with ${prospectName || "Prospect"}`;

  const eventDescription = [
    hostName ? `Call between ${hostName} and ${prospectName || "you"}.` : null,
    agenda ? `\nAgenda:\n${agenda}` : null,
    `\n— Scheduled via NextNote`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: eventTitle,
        description: eventDescription,
        start: {
          dateTime: startLocal,
          timeZone: eventTimeZone,
        },
        end: {
          dateTime: endLocal,
          timeZone: eventTimeZone,
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
    if (isGoogleAuthError(error)) {
      return googleReconnectResponse();
    }
    console.error("Calendar event creation error:", error);
    return NextResponse.json({ error: "Failed to create calendar event" }, { status: 500 });
  }
}
