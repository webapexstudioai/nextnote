import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";
import { normalizePhone, renderTemplate } from "@/lib/twilio";

const PERSONAL_SENTINEL = "personal";

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { prospect_id, template_id, body: rawBody } = await req.json();

  if (!prospect_id || typeof prospect_id !== "string") {
    return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  }
  if (!template_id && (!rawBody || typeof rawBody !== "string")) {
    return NextResponse.json({ error: "template_id or body required" }, { status: 400 });
  }

  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id, user_id, name, phone, contact_name")
    .eq("id", prospect_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const to = normalizePhone(prospect.phone || "");
  if (!to) return NextResponse.json({ error: "Prospect has no valid phone number" }, { status: 400 });

  let templateRow: { id: string; body: string } | null = null;
  if (template_id) {
    const { data } = await supabaseAdmin
      .from("sms_templates")
      .select("id, body")
      .eq("id", template_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    templateRow = data;
  }

  const { data: sender } = await supabaseAdmin
    .from("users")
    .select("name, agency_name")
    .eq("id", userId)
    .maybeSingle();

  const sourceBody = templateRow ? templateRow.body : (rawBody as string);
  const renderedBody = renderTemplate(sourceBody, {
    prospect_name: prospect.name,
    contact_name: prospect.contact_name,
    my_name: sender?.name || "",
    my_agency: sender?.agency_name || "",
  });

  const nowIso = new Date().toISOString();
  const { data: message, error: insertErr } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      user_id: userId,
      prospect_id: prospect.id,
      template_id: templateRow?.id ?? null,
      direction: "outbound",
      body: renderedBody,
      to_number: to,
      from_number: PERSONAL_SENTINEL,
      status: "sent_via_personal",
      sent_at: nowIso,
    })
    .select()
    .single();

  if (insertErr || !message) {
    return NextResponse.json({ error: insertErr?.message || "DB insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    message_id: message.id,
    status: "sent_via_personal",
    body: renderedBody,
    to,
    sms_link: `sms:${to}?body=${encodeURIComponent(renderedBody)}`,
  });
}
