import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mapAppointment, requireUser } from "@/lib/crm";
import { syncAppointmentCreated } from "@/lib/calendarSync";

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { prospectId, date, time, duration, meetLink, agenda, calendarEventId } = body;
  if (!prospectId || !date || !time || !duration) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify prospect ownership
  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id")
    .eq("id", prospectId)
    .eq("user_id", userId)
    .single();
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      user_id: userId,
      prospect_id: prospectId,
      date,
      time,
      duration,
      meet_link: meetLink ?? null,
      agenda: agenda ?? null,
      calendar_event_id: calendarEventId ?? null,
      outcome: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Create appointment error:", error);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }

  // Flip prospect to Booked
  await supabaseAdmin
    .from("prospects")
    .update({ status: "Booked" })
    .eq("id", prospectId)
    .eq("user_id", userId);

  // Push to Google Calendar (best-effort) and re-read the row so the
  // response reflects calendar_event_id + any auto-generated meet_link.
  if (!calendarEventId) {
    await syncAppointmentCreated(data.id);
    const { data: refreshed } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("id", data.id)
      .single();
    return NextResponse.json({ appointment: mapAppointment(refreshed ?? data) });
  }

  return NextResponse.json({ appointment: mapAppointment(data) });
}
