import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { requirePro } from "@/lib/tierGuard";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "audio/mpeg", "audio/mp3",
  "audio/wav", "audio/x-wav", "audio/wave",
  "audio/mp4", "audio/m4a", "audio/x-m4a",
]);

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("voicemail_recordings")
    .select("id, name, public_url, mime_type, duration_seconds, size_bytes, source, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load recordings" }, { status: 500 });
  }

  return NextResponse.json({
    recordings: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      url: r.public_url,
      mimeType: r.mime_type,
      durationSeconds: r.duration_seconds,
      sizeBytes: r.size_bytes,
      source: r.source,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const gate = await requirePro(session.userId, "Voicemail drops");
  if (!gate.ok) return gate.response;

  const form = await req.formData();
  const file = form.get("audio");
  const rawName = form.get("name");
  const durationRaw = form.get("duration");
  const source = form.get("source") === "uploaded" ? "uploaded" : "recorded";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }

  const name = (typeof rawName === "string" ? rawName : "").trim().slice(0, 80)
    || `Recording ${new Date().toLocaleDateString()}`;

  const duration = (() => {
    const n = Number(durationRaw);
    if (Number.isFinite(n) && n > 0 && n < 3600) return Math.round(n);
    return null;
  })();

  const extFromType: Record<string, string> = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
    "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a",
  };
  const ext = extFromType[file.type] || "bin";
  const uid = crypto.randomUUID();
  const path = `${session.userId}/library/${uid}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from("voicemail-audio")
    .upload(path, buf, { contentType: file.type, upsert: false });

  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabaseAdmin.storage.from("voicemail-audio").getPublicUrl(path);

  const { data: row, error: insErr } = await supabaseAdmin
    .from("voicemail_recordings")
    .insert({
      user_id: session.userId,
      name,
      storage_path: path,
      public_url: pub.publicUrl,
      mime_type: file.type,
      duration_seconds: duration,
      size_bytes: file.size,
      source,
    })
    .select("id, name, public_url, mime_type, duration_seconds, size_bytes, source, created_at")
    .single();

  if (insErr || !row) {
    await supabaseAdmin.storage.from("voicemail-audio").remove([path]).catch(() => {});
    return NextResponse.json({ error: "Failed to save recording" }, { status: 500 });
  }

  return NextResponse.json({
    recording: {
      id: row.id,
      name: row.name,
      url: row.public_url,
      mimeType: row.mime_type,
      durationSeconds: row.duration_seconds,
      sizeBytes: row.size_bytes,
      source: row.source,
      createdAt: row.created_at,
    },
  });
}
