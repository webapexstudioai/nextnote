import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.phone === "string") updates.phone = body.phone;
  if (typeof body.email === "string") updates.email = body.email;
  if (typeof body.service === "string") updates.service = body.service;
  if (typeof body.notes === "string") updates.notes = body.notes;
  if (typeof body.address === "string") updates.address = body.address;
  if (typeof body.website === "string") updates.website = body.website;
  if (typeof body.contactName === "string") updates.contact_name = body.contactName;
  if (typeof body.mapsUrl === "string") updates.maps_url = body.mapsUrl;
  if (typeof body.status === "string") updates.status = body.status;
  if (body.folderId !== undefined) updates.folder_id = body.folderId;
  if (body.fileId !== undefined) updates.file_id = body.fileId ?? null;
  if (body.dealValue !== undefined) updates.deal_value = body.dealValue;
  if (body.closedAt !== undefined) updates.closed_at = body.closedAt;
  if (body.generatedWebsiteId !== undefined) updates.generated_website_id = body.generatedWebsiteId;

  const { error } = await supabaseAdmin
    .from("prospects")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Update prospect error:", error);
    return NextResponse.json({ error: "Failed to update prospect" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("prospects")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Delete prospect error:", error);
    return NextResponse.json({ error: "Failed to delete prospect" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
