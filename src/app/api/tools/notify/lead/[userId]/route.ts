import { NextRequest, NextResponse } from "next/server";
import { authorizeNotifyCall } from "@/lib/toolAuth";
import { supabaseAdmin } from "@/lib/supabase";

const PHONE_LEADS_FOLDER = "Phone Leads";
const PHONE_LEADS_COLOR = "#e8553d";
const MAX_FIELD = 2000;

function asStr(v: unknown, max = MAX_FIELD): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

async function ensurePhoneLeadsFolder(userId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", PHONE_LEADS_FOLDER)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabaseAdmin
    .from("folders")
    .insert({ user_id: userId, name: PHONE_LEADS_FOLDER, color: PHONE_LEADS_COLOR })
    .select("id")
    .single();
  return created?.id || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeNotifyCall(req, userId);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = asStr(body?.caller_name, 200) || "Phone caller";
  const phone = asStr(body?.caller_phone, 30);
  const email = asStr(body?.caller_email, 200);
  const service = asStr(body?.service_requested, 500);
  const summary = asStr(body?.summary, MAX_FIELD);

  if (!phone && !email) {
    return NextResponse.json(
      { success: false, error: "Need at least one of `caller_phone` or `caller_email`." },
      { status: 400 },
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Invalid `caller_email`." }, { status: 400 });
  }

  const folderId = await ensurePhoneLeadsFolder(auth.user.id);
  if (!folderId) {
    return NextResponse.json({ success: false, error: "Could not route lead." }, { status: 500 });
  }

  const noteParts: string[] = [];
  if (service) noteParts.push(`Asked about: ${service}`);
  if (summary) noteParts.push(summary);

  const { error } = await supabaseAdmin.from("prospects").insert({
    user_id: auth.user.id,
    folder_id: folderId,
    name,
    email: email || null,
    phone: phone || null,
    service: service || null,
    notes: noteParts.join("\n\n") || null,
    status: "New",
    source: "phone_call",
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Saved ${name} to your Phone Leads.` });
}
