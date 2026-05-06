import { google, calendar_v3 } from "googleapis";
import { getOAuth2Client } from "./google";
import { supabaseAdmin } from "./supabase";
import { decrypt, encrypt } from "./crypto";

export interface GoogleCreds {
  accessToken: string;
  refreshToken: string;
  expiry: number | null;
  calendarId: string;
  timeZone: string;
}

export async function loadGoogleCreds(userId: string): Promise<GoogleCreds | null> {
  const { data } = await supabaseAdmin
    .from("user_settings")
    .select("google_access_token_encrypted, google_refresh_token_encrypted, google_token_expiry, google_calendar_id, cal_timezone")
    .eq("user_id", userId)
    .single();

  if (!data?.google_refresh_token_encrypted) return null;
  try {
    return {
      accessToken: data.google_access_token_encrypted ? decrypt(data.google_access_token_encrypted) : "",
      refreshToken: decrypt(data.google_refresh_token_encrypted),
      expiry: data.google_token_expiry || null,
      calendarId: data.google_calendar_id || "primary",
      timeZone: data.cal_timezone || "America/New_York",
    };
  } catch {
    return null;
  }
}

// Returns an OAuth client that auto-refreshes and writes updated access tokens back to Supabase.
export async function getAuthClient(userId: string, creds: GoogleCreds) {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: creds.accessToken || undefined,
    refresh_token: creds.refreshToken,
    expiry_date: creds.expiry || undefined,
  });
  client.on("tokens", async (tokens) => {
    const updates: Record<string, string | number | null> = {};
    if (tokens.access_token) updates.google_access_token_encrypted = encrypt(tokens.access_token);
    if (tokens.expiry_date) updates.google_token_expiry = tokens.expiry_date;
    if (tokens.refresh_token) updates.google_refresh_token_encrypted = encrypt(tokens.refresh_token);
    if (Object.keys(updates).length) {
      await supabaseAdmin.from("user_settings").update(updates).eq("user_id", userId);
    }
  });
  return client;
}

export async function createEvent(userId: string, args: {
  attendeeName: string;
  attendeeEmail: string;
  startTime: string;
  durationMinutes?: number;
  notes?: string;
}) {
  const creds = await loadGoogleCreds(userId);
  if (!creds) throw new Error("Google Calendar not connected");
  const auth = await getAuthClient(userId, creds);
  const cal = google.calendar({ version: "v3", auth });

  const start = new Date(args.startTime);
  const end = new Date(start.getTime() + (args.durationMinutes || 30) * 60 * 1000);

  const event = await cal.events.insert({
    calendarId: creds.calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: `Meeting with ${args.attendeeName}`,
      description: args.notes || undefined,
      start: { dateTime: start.toISOString(), timeZone: creds.timeZone },
      end: { dateTime: end.toISOString(), timeZone: creds.timeZone },
      attendees: [{ email: args.attendeeEmail, displayName: args.attendeeName }],
      conferenceData: {
        createRequest: {
          requestId: `nextnote-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const meet = event.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || null;
  return {
    eventId: event.data.id,
    start: event.data.start?.dateTime,
    end: event.data.end?.dateTime,
    meetLink: meet,
  };
}

export async function getFreeBusy(userId: string, args: { startDate: string; endDate: string }) {
  const creds = await loadGoogleCreds(userId);
  if (!creds) throw new Error("Google Calendar not connected");
  const auth = await getAuthClient(userId, creds);
  const cal = google.calendar({ version: "v3", auth });

  const fb = await cal.freebusy.query({
    requestBody: {
      timeMin: new Date(`${args.startDate}T00:00:00`).toISOString(),
      timeMax: new Date(`${args.endDate}T23:59:59`).toISOString(),
      timeZone: creds.timeZone,
      items: [{ id: creds.calendarId }],
    },
  });

  const busy = fb.data.calendars?.[creds.calendarId]?.busy || [];
  return { busy: busy.map((b) => ({ start: b.start, end: b.end })), timeZone: creds.timeZone };
}

export async function updateEvent(userId: string, args: { eventId: string; newStartTime: string; durationMinutes?: number }) {
  const creds = await loadGoogleCreds(userId);
  if (!creds) throw new Error("Google Calendar not connected");
  const auth = await getAuthClient(userId, creds);
  const cal = google.calendar({ version: "v3", auth });

  const existing = await cal.events.get({ calendarId: creds.calendarId, eventId: args.eventId });
  const origStart = existing.data.start?.dateTime ? new Date(existing.data.start.dateTime) : null;
  const origEnd = existing.data.end?.dateTime ? new Date(existing.data.end.dateTime) : null;
  const origDuration = origStart && origEnd ? (origEnd.getTime() - origStart.getTime()) / 60000 : 30;

  const newStart = new Date(args.newStartTime);
  const newEnd = new Date(newStart.getTime() + (args.durationMinutes || origDuration) * 60 * 1000);

  const updated = await cal.events.patch({
    calendarId: creds.calendarId,
    eventId: args.eventId,
    sendUpdates: "all",
    requestBody: {
      start: { dateTime: newStart.toISOString(), timeZone: creds.timeZone },
      end: { dateTime: newEnd.toISOString(), timeZone: creds.timeZone },
    },
  });

  return {
    eventId: updated.data.id,
    start: updated.data.start?.dateTime,
    end: updated.data.end?.dateTime,
  };
}

export async function deleteEvent(userId: string, args: { eventId: string }) {
  const creds = await loadGoogleCreds(userId);
  if (!creds) throw new Error("Google Calendar not connected");
  const auth = await getAuthClient(userId, creds);
  const cal = google.calendar({ version: "v3", auth });
  await cal.events.delete({
    calendarId: creds.calendarId,
    eventId: args.eventId,
    sendUpdates: "all",
  });
  return { eventId: args.eventId };
}

export type CalendarEvent = calendar_v3.Schema$Event;
