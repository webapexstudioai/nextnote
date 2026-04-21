import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function twiml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

async function handle(req: NextRequest, dropId: string) {
  let answeredBy = "";
  if (req.method === "POST") {
    try {
      const form = await req.formData();
      answeredBy = String(form.get("AnsweredBy") || "");
    } catch {}
  } else {
    answeredBy = req.nextUrl.searchParams.get("AnsweredBy") || "";
  }

  const { data: drop } = await supabaseAdmin
    .from("voicemail_drops")
    .select("id, campaign_id")
    .eq("id", dropId)
    .maybeSingle();
  if (!drop) return twiml("<Hangup/>");

  const { data: campaign } = await supabaseAdmin
    .from("voicemail_campaigns")
    .select("audio_url")
    .eq("id", drop.campaign_id)
    .maybeSingle();

  const audioUrl = campaign?.audio_url;

  // Log what AMD returned
  if (answeredBy) {
    await supabaseAdmin
      .from("voicemail_drops")
      .update({ answered_by: answeredBy })
      .eq("id", dropId);
  }

  const isMachine = answeredBy.startsWith("machine_end") || answeredBy === "fax";
  if (!isMachine || !audioUrl) {
    return twiml("<Hangup/>");
  }

  const escaped = audioUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return twiml(`<Play>${escaped}</Play><Hangup/>`);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ dropId: string }> }) {
  const { dropId } = await ctx.params;
  return handle(req, dropId);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ dropId: string }> }) {
  const { dropId } = await ctx.params;
  return handle(req, dropId);
}
