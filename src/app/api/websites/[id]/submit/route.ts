import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email-templates";

const MAX_FIELD_LEN = 2000;
const LEADS_FOLDER_NAME = "Website Leads";
const LEADS_FOLDER_COLOR = "#10b981";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    .select("id, user_id, prospect_id, prospect_name")
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

  // Notify the prospect (the local business that owns this site) by email so
  // they can call the homeowner back. Best-effort — never block on email.
  if (site.prospect_id) {
    notifyProspectOfWebsiteLead({
      prospectId: site.prospect_id as string,
      siteName: site.prospect_name || "your website",
      submitter: { name, email, phone, message },
    }).catch((e) => console.error("notifyProspectOfWebsiteLead failed:", e));
  }

  return NextResponse.json({ ok: true });
}

async function notifyProspectOfWebsiteLead(args: {
  prospectId: string;
  siteName: string;
  submitter: { name: string | null; email: string | null; phone: string | null; message: string | null };
}) {
  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("name, email, contact_name")
    .eq("id", args.prospectId)
    .maybeSingle();

  // The prospect owner's email is the only place to send the alert. If they
  // didn't fill in an email when the prospect was created, silently skip —
  // the lead is still in the agency's CRM, no harm done.
  if (!prospect?.email) return;

  const businessName = (prospect.name as string | null)?.trim() || args.siteName;
  const contactName = (prospect.contact_name as string | null)?.trim() || "";

  const { name, email: leadEmail, phone, message } = args.submitter;
  const greeting = contactName ? `Hi ${escapeHtml(contactName.split(/\s+/)[0])},` : "Hi there,";

  const detailRows: string[] = [];
  if (name) detailRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:12px;width:100px;">Name</td><td style="padding:6px 0;font-size:14px;color:#111;">${escapeHtml(name)}</td></tr>`);
  if (phone) detailRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Phone</td><td style="padding:6px 0;font-size:14px;color:#111;"><a href="tel:${escapeHtml(phone)}" style="color:#e8553d;text-decoration:none;">${escapeHtml(phone)}</a></td></tr>`);
  if (leadEmail) detailRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Email</td><td style="padding:6px 0;font-size:14px;color:#111;"><a href="mailto:${escapeHtml(leadEmail)}" style="color:#e8553d;text-decoration:none;">${escapeHtml(leadEmail)}</a></td></tr>`);

  const messageBlock = message
    ? `<div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border-left:3px solid #e8553d;border-radius:6px;"><p style="margin:0 0 6px 0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">What they said</p><p style="margin:0;color:#111;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p></div>`
    : "";

  const subject = name
    ? `New lead from your website — ${name}`
    : `New lead from your website`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#fff4f0;color:#e8553d;font-weight:600;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;">New website lead</div>
      </div>
      <h1 style="margin:0 0 14px 0;font-size:22px;color:#111;text-align:center;">Someone just requested an inspection</h1>
      <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#374151;">${greeting} a visitor on <strong>${escapeHtml(businessName)}</strong>'s website filled out the contact form. Reach out soon — fast follow-up wins jobs.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:0 0 4px 0;">
        ${detailRows.join("")}
      </table>
      ${messageBlock}
      ${phone ? `<div style="margin-top:22px;text-align:center;"><a href="tel:${escapeHtml(phone)}" style="display:inline-block;padding:12px 24px;background:#e8553d;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Call ${escapeHtml(name || "now")}</a></div>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px 0;" />
      <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">Sent by <strong>${escapeHtml(businessName)}</strong> · This lead is also saved in your CRM.</p>
    </div>
  `;

  const text = [
    `${greeting.replace(/<[^>]+>/g, "")}`,
    "",
    `A visitor on ${businessName}'s website just submitted the contact form.`,
    "",
    name ? `Name:    ${name}` : null,
    phone ? `Phone:   ${phone}` : null,
    leadEmail ? `Email:   ${leadEmail}` : null,
    message ? `\nMessage:\n${message}` : null,
    "",
    "Reach out soon — fast follow-up wins jobs.",
  ].filter(Boolean).join("\n");

  await sendEmail({
    to: prospect.email,
    subject,
    html,
    text,
    fromName: businessName,
    // Replies go straight to the homeowner who submitted the form.
    replyTo: leadEmail || undefined,
  });
}
