import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent } from "@/lib/agentOwnership";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { agentId } = await params;
    try {
      await assertOwnsAgent(session.userId, agentId);
    } catch {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, WebP, or GIF." }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    // Same 'avatars' bucket as user pfps — folder per user, file per agent.
    const filePath = `agents/${session.userId}/${agentId}.${ext}`;

    const upload = async () =>
      supabaseAdmin.storage.from("avatars").upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    let { error: uploadError } = await upload();
    if (uploadError && (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket"))) {
      await supabaseAdmin.storage.createBucket("avatars", { public: true });
      ({ error: uploadError } = await upload());
    }
    if (uploadError) {
      console.error("Agent logo upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);
    const logoUrl = urlData.publicUrl + `?t=${Date.now()}`;

    await supabaseAdmin
      .from("user_agents")
      .update({ business_logo_url: logoUrl })
      .eq("user_id", session.userId)
      .eq("elevenlabs_agent_id", agentId);

    return NextResponse.json({ url: logoUrl });
  } catch (err) {
    console.error("Agent logo upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { agentId } = await params;
    try {
      await assertOwnsAgent(session.userId, agentId);
    } catch {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    for (const ext of ["jpg", "png", "webp", "gif"]) {
      await supabaseAdmin.storage
        .from("avatars")
        .remove([`agents/${session.userId}/${agentId}.${ext}`]);
    }

    await supabaseAdmin
      .from("user_agents")
      .update({ business_logo_url: null })
      .eq("user_id", session.userId)
      .eq("elevenlabs_agent_id", agentId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agent logo delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
