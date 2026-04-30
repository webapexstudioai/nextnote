import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mapFolder, requireUser } from "@/lib/crm";
import { assertFolderQuota } from "@/lib/tierGuard";

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, color } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const quota = await assertFolderQuota(userId);
  if (!quota.ok) return quota.response;

  const { data, error } = await supabaseAdmin
    .from("folders")
    .insert({ user_id: userId, name, color: color || "#6366f1" })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Create folder error:", error);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }

  return NextResponse.json({ folder: mapFolder(data, []) });
}
