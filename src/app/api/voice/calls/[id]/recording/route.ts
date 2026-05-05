import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Proxies the Twilio recording with the user's basic-auth header. Twilio
// recording URLs require account auth; we don't want to ship that secret
// to the browser, so we stream the audio through this server route instead.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: call } = await supabaseAdmin
    .from("voice_calls")
    .select("recording_url, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!call || call.user_id !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!call.recording_url) {
    return NextResponse.json({ error: "No recording" }, { status: 404 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json({ error: "Phone provider not configured" }, { status: 503 });
  }

  const mp3Url = call.recording_url.endsWith(".mp3")
    ? call.recording_url
    : `${call.recording_url}.mp3`;
  const upstream = await fetch(mp3Url, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Recording fetch failed" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
