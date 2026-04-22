import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mapAppointment, requireUser } from "@/lib/crm";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { date, time, duration, meetLink, agenda } = await req.json();
  if (!date || !time || !duration) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Get original appointment scoped to user
  const { data: original } = await supabaseAdmin
    .from("appointments")
    .select("prospect_id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();
  if (!original) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

  // Mark old as rescheduled
  await supabaseAdmin
    .from("appointments")
    .update({ outcome: "rescheduled" })
    .eq("id", params.id)
    .eq("user_id", userId);

  // Create new one
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      user_id: userId,
      prospect_id: original.prospect_id,
      date,
      time,
      duration,
      meet_link: meetLink ?? null,
      agenda: agenda ?? null,
      outcome: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Reschedule appointment error:", error);
    return NextResponse.json({ error: "Failed to reschedule" }, { status: 500 });
  }

  return NextResponse.json({ appointment: mapAppointment(data) });
}
