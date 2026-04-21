import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, ctx: { params: Promise<{ dropId: string }> }) {
  const { dropId } = await ctx.params;
  try {
    const form = await req.formData();
    const callStatus = String(form.get("CallStatus") || "");
    const answeredBy = String(form.get("AnsweredBy") || "");

    const mapped =
      callStatus === "completed"
        ? answeredBy.startsWith("machine_end") || answeredBy === "fax"
          ? "delivered"
          : "no_voicemail"
        : callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer"
        ? "failed"
        : callStatus;

    await supabaseAdmin
      .from("voicemail_drops")
      .update({
        status: mapped,
        answered_by: answeredBy || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", dropId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
