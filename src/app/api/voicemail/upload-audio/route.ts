import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePro } from "@/lib/tierGuard";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/x-m4a"]);

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const gate = await requirePro(session.userId, "Voicemail drops");
    if (!gate.ok) return gate.response;

    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    const uid = crypto.randomUUID();
    const path = `${session.userId}/${uid}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from("voicemail-audio")
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (upErr) {
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage
      .from("voicemail-audio")
      .getPublicUrl(path);

    return NextResponse.json({ url: pub.publicUrl, path, filename: file.name });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
