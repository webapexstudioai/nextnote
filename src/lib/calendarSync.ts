// Best-effort sync between dashboard CRM appointments and the user's Google
// Calendar. Each function silently no-ops when Google isn't connected — we
// don't want a missing OAuth to block the appointment write.
//
// We pass naive `dateTime` ("2026-05-08T14:00:00") with the user's timezone
// in a separate `timeZone` field. Google honors the timeZone field only when
// dateTime has no offset; passing toISOString() (UTC) silently drops it.

import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase";
import { loadGoogleCreds, getAuthClient } from "@/lib/googleCalendar";

type AppointmentRow = {
  id: string;
  user_id: string;
  prospect_id: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm:ss
  duration: number;      // minutes
  agenda: string | null;
  meet_link: string | null;
  calendar_event_id: string | null;
};

type ProspectRow = {
  name: string | null;
  contact_name: string | null;
  email: string | null;
};

function pad(n: number) { return n.toString().padStart(2, "0"); }

function addMinutesToTime(time: string, minutes: number): string {
  // time is "HH:mm:ss" — return "HH:mm:ss" minutes later, possibly past 24h.
  // Google accepts "25:00:00" as next-day so we don't need a date roll, but
  // we keep it inside 0–23 anyway by computing a Date and reading back.
  const [h, m, s] = time.split(":").map((p) => parseInt(p, 10));
  const total = h * 60 + m + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${pad(eh)}:${pad(em)}:${pad(s || 0)}`;
}

async function loadAppointment(id: string): Promise<{ appt: AppointmentRow; prospect: ProspectRow } | null> {
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, user_id, prospect_id, date, time, duration, agenda, meet_link, calendar_event_id")
    .eq("id", id)
    .maybeSingle();
  if (!appt) return null;
  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("name, contact_name, email")
    .eq("id", appt.prospect_id)
    .maybeSingle();
  return { appt: appt as AppointmentRow, prospect: (prospect ?? { name: null, contact_name: null, email: null }) as ProspectRow };
}

function buildSummary(p: ProspectRow): string {
  const who = (p.contact_name || p.name || "prospect").trim();
  return `Meeting with ${who}`;
}

export async function syncAppointmentCreated(appointmentId: string): Promise<void> {
  try {
    const loaded = await loadAppointment(appointmentId);
    if (!loaded) return;
    const { appt, prospect } = loaded;
    const creds = await loadGoogleCreds(appt.user_id);
    if (!creds) return;

    const auth = await getAuthClient(appt.user_id, creds);
    const cal = google.calendar({ version: "v3", auth });

    const startDateTime = `${appt.date}T${appt.time}`;
    const endTime = addMinutesToTime(appt.time, appt.duration);
    const endDateTime = `${appt.date}T${endTime}`;

    const attendees = prospect.email ? [{ email: prospect.email, displayName: prospect.contact_name || prospect.name || undefined }] : [];

    const ev = await cal.events.insert({
      calendarId: creds.calendarId,
      conferenceDataVersion: appt.meet_link ? 0 : 1,
      sendUpdates: prospect.email ? "all" : "none",
      requestBody: {
        summary: buildSummary(prospect),
        description: appt.agenda || undefined,
        start: { dateTime: startDateTime, timeZone: creds.timeZone },
        end: { dateTime: endDateTime, timeZone: creds.timeZone },
        attendees,
        // Only auto-create a Meet link if the user didn't paste one in.
        ...(appt.meet_link
          ? {}
          : {
              conferenceData: {
                createRequest: {
                  requestId: `nextnote-${appt.id}`,
                  conferenceSolutionKey: { type: "hangoutsMeet" },
                },
              },
            }),
      },
    });

    const eventId = ev.data.id || null;
    const meet = ev.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || null;

    const updates: Record<string, string | null> = {};
    if (eventId) updates.calendar_event_id = eventId;
    if (meet && !appt.meet_link) updates.meet_link = meet;
    if (Object.keys(updates).length) {
      await supabaseAdmin.from("appointments").update(updates).eq("id", appt.id);
    }
  } catch (err) {
    console.error("calendarSync.created failed", err);
  }
}

export async function syncAppointmentRescheduled(oldAppointmentId: string, newAppointmentId: string): Promise<void> {
  try {
    const oldLoaded = await loadAppointment(oldAppointmentId);
    const newLoaded = await loadAppointment(newAppointmentId);
    if (!newLoaded) return;
    const { appt: newAppt, prospect } = newLoaded;
    const creds = await loadGoogleCreds(newAppt.user_id);
    if (!creds) return;

    const auth = await getAuthClient(newAppt.user_id, creds);
    const cal = google.calendar({ version: "v3", auth });

    const startDateTime = `${newAppt.date}T${newAppt.time}`;
    const endDateTime = `${newAppt.date}T${addMinutesToTime(newAppt.time, newAppt.duration)}`;

    const oldEventId = oldLoaded?.appt.calendar_event_id || null;

    if (oldEventId) {
      // Patch the existing event in place — preserves Meet link + attendee
      // history — and transfer ownership of the eventId to the new row.
      try {
        await cal.events.patch({
          calendarId: creds.calendarId,
          eventId: oldEventId,
          sendUpdates: prospect.email ? "all" : "none",
          requestBody: {
            start: { dateTime: startDateTime, timeZone: creds.timeZone },
            end: { dateTime: endDateTime, timeZone: creds.timeZone },
          },
        });
        await supabaseAdmin
          .from("appointments")
          .update({ calendar_event_id: oldEventId })
          .eq("id", newAppt.id);
        await supabaseAdmin
          .from("appointments")
          .update({ calendar_event_id: null })
          .eq("id", oldAppointmentId);
        return;
      } catch (err) {
        console.error("calendarSync.reschedule patch failed, falling back to create", err);
      }
    }

    // No existing event (or patch failed) — create a fresh one.
    await syncAppointmentCreated(newAppointmentId);
  } catch (err) {
    console.error("calendarSync.rescheduled failed", err);
  }
}

export async function syncAppointmentCanceled(appointmentId: string): Promise<void> {
  try {
    const loaded = await loadAppointment(appointmentId);
    if (!loaded) return;
    const { appt } = loaded;
    if (!appt.calendar_event_id) return;
    const creds = await loadGoogleCreds(appt.user_id);
    if (!creds) return;

    const auth = await getAuthClient(appt.user_id, creds);
    const cal = google.calendar({ version: "v3", auth });

    try {
      await cal.events.delete({
        calendarId: creds.calendarId,
        eventId: appt.calendar_event_id,
        sendUpdates: "all",
      });
    } catch (err) {
      // 404/410 = already gone, which is fine.
      console.warn("calendarSync.cancel delete returned error (likely already removed)", err);
    }

    await supabaseAdmin
      .from("appointments")
      .update({ calendar_event_id: null })
      .eq("id", appt.id);
  } catch (err) {
    console.error("calendarSync.canceled failed", err);
  }
}
