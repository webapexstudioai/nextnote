import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mapFile, requireUser } from "@/lib/crm";

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { folderId, name, source } = await req.json();
  if (!folderId || !name) {
    return NextResponse.json({ error: "folderId and name required" }, { status: 400 });
  }

  // Verify folder ownership
  const { data: folder } = await supabaseAdmin
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .single();
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("files")
    .insert({
      user_id: userId,
      folder_id: folderId,
      name,
      source: source || "manual",
      prospect_count: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Create file error:", error);
    return NextResponse.json({ error: "Failed to create file" }, { status: 500 });
  }

  return NextResponse.json({ file: mapFile(data) });
}
