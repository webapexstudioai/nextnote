// Cal.com v2 API client. User supplies their own API key per NextNote account.
// Docs: https://cal.com/docs/api-reference/v2

const V2 = "https://api.cal.com/v2";

interface CalCreds {
  apiKey: string;
  eventTypeId: string;
  timeZone: string;
}

async function call<T>(path: string, method: string, apiKey: string, body?: unknown, apiVersion = "2024-08-13"): Promise<T> {
  const res = await fetch(`${V2}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "cal-api-version": apiVersion,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = (data as { error?: { message?: string }; message?: string })?.error?.message
      || (data as { message?: string })?.message
      || `Cal.com ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function createBooking(creds: CalCreds, args: {
  attendeeName: string;
  attendeeEmail: string;
  startTime: string; // ISO 8601
  notes?: string;
  language?: string;
}) {
  return call<{ data: { uid: string; id: number; start: string; end: string; status: string; meetingUrl?: string } }>(
    "/bookings",
    "POST",
    creds.apiKey,
    {
      start: args.startTime,
      eventTypeId: Number(creds.eventTypeId),
      attendee: {
        name: args.attendeeName,
        email: args.attendeeEmail,
        timeZone: creds.timeZone,
        language: args.language || "en",
      },
      metadata: args.notes ? { notes: args.notes } : undefined,
    }
  );
}

export async function getAvailableSlots(creds: CalCreds, args: {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}) {
  const q = new URLSearchParams({
    eventTypeId: creds.eventTypeId,
    start: args.startDate,
    end: args.endDate,
    timeZone: creds.timeZone,
  });
  return call<{ data: Record<string, { start: string }[]> }>(
    `/slots?${q.toString()}`,
    "GET",
    creds.apiKey,
    undefined,
    "2024-09-04"
  );
}

export async function rescheduleBooking(creds: CalCreds, args: {
  bookingUid: string;
  newStartTime: string; // ISO 8601
  reason?: string;
}) {
  return call<{ data: { uid: string; start: string; end: string; status: string } }>(
    `/bookings/${encodeURIComponent(args.bookingUid)}/reschedule`,
    "POST",
    creds.apiKey,
    {
      start: args.newStartTime,
      reschedulingReason: args.reason || "Rescheduled by AI agent",
    }
  );
}
