import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";
import { syncAppointmentCanceled } from "@/lib/calendarSync";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.outcome === "string") updates.outcome = body.outcome;
  if (typeof body.cancelReason === "string") updates.cancel_reason = body.cancelReason;
  if (typeof body.meetingNotes === "string") updates.meeting_notes = body.meetingNotes;
  if (typeof body.summarizedNotes === "string") updates.summarized_notes = body.summarizedNotes;

  const { error } = await supabaseAdmin
    .from("appointments")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Update appointment error:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }

  // If the user marked this as canceled or no_show, drop the Google
  // Calendar event so it doesn't keep haunting their day view.
  if (updates.outcome === "canceled" || updates.outcome === "no_show") {
    await syncAppointmentCanceled(params.id);
  }

  return NextResponse.json({ ok: true });
}
