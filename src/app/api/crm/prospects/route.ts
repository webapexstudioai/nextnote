import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mapProspect, requireUser } from "@/lib/crm";
import { assertProspectQuota } from "@/lib/tierGuard";
import type { Prospect } from "@/types";

type ProspectInput = Partial<Prospect> & { folderId: string; name: string };

function toRow(userId: string, input: ProspectInput) {
  return {
    user_id: userId,
    folder_id: input.folderId,
    file_id: input.fileId ?? null,
    name: input.name,
    phone: input.phone ?? "",
    email: input.email ?? "",
    service: input.service ?? "",
    notes: input.notes ?? "",
    address: input.address ?? null,
    website: input.website ?? null,
    contact_name: input.contactName ?? null,
    maps_url: input.mapsUrl ?? null,
    status: input.status ?? "New",
    deal_value: input.dealValue ?? null,
    closed_at: input.closedAt ?? null,
    generated_website_id: input.generatedWebsiteId ?? null,
  };
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  // Batch insert
  if (Array.isArray(body.prospects)) {
    const inputs = body.prospects as ProspectInput[];
    if (inputs.length === 0) return NextResponse.json({ prospects: [] });

    const quota = await assertProspectQuota(userId, inputs.length);
    if (!quota.ok) return quota.response;

    // Validate folder ownership for all unique folder_ids
    const folderIds = Array.from(new Set(inputs.map((p) => p.folderId).filter(Boolean)));
    if (folderIds.length === 0) {
      return NextResponse.json({ error: "folderId required" }, { status: 400 });
    }
    const { data: owned } = await supabaseAdmin
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .in("id", folderIds);
    const ownedSet = new Set((owned ?? []).map((f) => f.id));
    if (!folderIds.every((id) => ownedSet.has(id))) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 403 });
    }

    const rows = inputs.map((p) => toRow(userId, p));
    const { data, error } = await supabaseAdmin.from("prospects").insert(rows).select("*");
    if (error || !data) {
      console.error("Batch insert prospects error:", error);
      return NextResponse.json({ error: "Failed to add prospects" }, { status: 500 });
    }
    return NextResponse.json({
      prospects: data.map((p) => mapProspect(p, [])),
    });
  }

  // Single insert
  const input = body as ProspectInput;
  if (!input.folderId || !input.name) {
    return NextResponse.json({ error: "folderId and name required" }, { status: 400 });
  }

  const quota = await assertProspectQuota(userId, 1);
  if (!quota.ok) return quota.response;

  const { data: folder } = await supabaseAdmin
    .from("folders")
    .select("id")
    .eq("id", input.folderId)
    .eq("user_id", userId)
    .single();
  if (!folder) return NextResponse.json({ error: "Invalid folder" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .insert(toRow(userId, input))
    .select("*")
    .single();

  if (error || !data) {
    console.error("Create prospect error:", error);
    return NextResponse.json({ error: "Failed to create prospect" }, { status: 500 });
  }

  return NextResponse.json({ prospect: mapProspect(data, []) });
}
