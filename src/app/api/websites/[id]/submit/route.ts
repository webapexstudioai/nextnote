import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const MAX_FIELD_LEN = 2000;
const LEADS_FOLDER_NAME = "Website Leads";
const LEADS_FOLDER_COLOR = "#10b981";

type Body = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  // Honeypot — real humans leave this empty; bots fill every visible input.
  company_website?: unknown;
};

function asStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > MAX_FIELD_LEN) return null;
  return trimmed;
}

async function ensureLeadsFolder(userId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", LEADS_FOLDER_NAME)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("folders")
    .insert({ user_id: userId, name: LEADS_FOLDER_NAME, color: LEADS_FOLDER_COLOR })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || id.length > 80) {
    return NextResponse.json({ error: "Invalid site id" }, { status: 400 });
  }

  const ipKey = clientKey(req, `website-submit:${id}`);
  const limit = rateLimit(ipKey, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — silently succeed so bots don't learn they were blocked.
  if (asStr(body.company_website)) {
    return NextResponse.json({ ok: true });
  }

  const name = asStr(body.name);
  const email = asStr(body.email);
  const phone = asStr(body.phone);
  const message = asStr(body.message);

  if (!name && !email && !phone) {
    return NextResponse.json(
      { error: "Please provide a name, email, or phone number." },
      { status: 400 },
    );
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const { data: site } = await supabaseAdmin
    .from("generated_websites")
    .select("id, user_id, prospect_name")
    .eq("id", id)
    .maybeSingle();

  if (!site?.user_id) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const folderId = await ensureLeadsFolder(site.user_id);
  if (!folderId) {
    return NextResponse.json({ error: "Could not route lead" }, { status: 500 });
  }

  const displayName = name || email || phone || "Website lead";
  const noteParts: string[] = [];
  if (site.prospect_name) noteParts.push(`Submitted via site for ${site.prospect_name}`);
  if (message) noteParts.push(message);

  const { error: insertErr } = await supabaseAdmin.from("prospects").insert({
    user_id: site.user_id,
    folder_id: folderId,
    name: displayName,
    email: email || null,
    phone: phone || null,
    notes: noteParts.join("\n\n") || null,
    status: "New",
    source: "website_form",
    source_site_id: id,
  });

  if (insertErr) {
    return NextResponse.json({ error: "Could not save lead" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
