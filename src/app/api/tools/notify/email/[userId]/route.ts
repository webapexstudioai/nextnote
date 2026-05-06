import { NextRequest, NextResponse } from "next/server";
import { authorizeNotifyCall } from "@/lib/toolAuth";
import { sendEmail } from "@/lib/email-templates";
import { rateLimit } from "@/lib/rateLimit";

const MAX_SUBJECT = 200;
const MAX_BODY = 5000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const auth = await authorizeNotifyCall(req, userId);
  if ("error" in auth) return auth.error;

  // 20 outbound emails per user per hour — enough for a busy reception line,
  // tight enough to bound abuse if a prompt-injection sneaks through.
  const limit = rateLimit(`tool-email:${userId}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: "Email rate limit reached. Try again later." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const subject = (typeof body?.subject === "string" ? body.subject : "").slice(0, MAX_SUBJECT);
  const message = (typeof body?.message === "string" ? body.message : "").slice(0, MAX_BODY);

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ success: false, error: "Valid `to` email is required." }, { status: 400 });
  }
  if (!subject || !message) {
    return NextResponse.json({ success: false, error: "`subject` and `message` are required." }, { status: 400 });
  }

  // White-label: the recipient sees the agency name as the sender, replies
  // route to the owner's email, and the body header shows the agency logo +
  // name instead of NextNote branding.
  const { agencyName, ownerName, email: ownerEmail, logoUrl } = auth.user;
  const safeBody = escapeHtml(message).replace(/\n/g, "<br />");

  const headerMarkup = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(agencyName)}" width="48" height="48" style="display:block;border-radius:12px;margin:0 auto 12px auto;border:0;" />`
    : "";

  const footerLine = ownerName && ownerName.toLowerCase() !== agencyName.toLowerCase()
    ? `${escapeHtml(ownerName)} · ${escapeHtml(agencyName)}`
    : escapeHtml(agencyName);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        ${headerMarkup}
        <div style="font-weight:700;font-size:16px;color:#111;">${escapeHtml(agencyName)}</div>
      </div>
      <div>${safeBody}</div>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:11px;color:#777;margin:0;">${footerLine}</p>
    </div>
  `;
  const text = `${message}\n\n—\n${ownerName && ownerName !== agencyName ? `${ownerName}\n` : ""}${agencyName}`;

  try {
    await sendEmail({
      to,
      subject,
      html,
      text,
      fromName: agencyName,
      replyTo: ownerEmail || undefined,
    });
    return NextResponse.json({ success: true, message: `Email sent to ${to}.` });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Email failed" },
      { status: 500 },
    );
  }
}
