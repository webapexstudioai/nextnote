import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import {
  getAuthedGoogleClient,
  googleReconnectResponse,
  isGoogleAuthError,
} from "@/lib/google";
import { getSession, getAuthSession } from "@/lib/session";

function formatTime12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(params: {
  prospectName: string;
  hostName?: string;
  date: string;
  time: string;
  duration: number;
  agenda?: string;
  meetLink?: string;
}) {
  const { prospectName, hostName, date, time, duration, agenda, meetLink } = params;
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = formatTime12h(time);
  const firstName = prospectName.split(" ")[0] || prospectName;
  const hostLine = hostName ? `with ${escapeHtml(hostName)}` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:6px 10px;border-radius:999px;">Confirmed</div>
        <h1 style="color:#ffffff;font-size:26px;line-height:1.2;margin:14px 0 4px;font-weight:700;">You&rsquo;re booked, ${escapeHtml(firstName)}.</h1>
        <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">Here are your meeting details ${hostLine}.</p>
      </div>

      <div style="padding:28px 32px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;width:90px;">Date</td>
              <td style="padding:8px 0;color:#111827;font-size:15px;font-weight:600;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;">Time</td>
              <td style="padding:8px 0;color:#111827;font-size:15px;font-weight:600;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;">Duration</td>
              <td style="padding:8px 0;color:#111827;font-size:15px;font-weight:600;">${duration} minutes</td>
            </tr>
            ${hostName ? `
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;">Host</td>
              <td style="padding:8px 0;color:#111827;font-size:15px;font-weight:600;">${escapeHtml(hostName)}</td>
            </tr>` : ""}
            ${agenda ? `
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Agenda</td>
              <td style="padding:8px 0;color:#111827;font-size:14px;line-height:1.5;">${escapeHtml(agenda)}</td>
            </tr>` : ""}
          </table>
        </div>

        ${meetLink ? `
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${meetLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 1px 2px rgba(79,70,229,0.3);">
            Join Google Meet
          </a>
        </div>
        <p style="color:#6b7280;font-size:12px;text-align:center;margin:0 0 8px;">
          Or copy this link:<br>
          <a href="${meetLink}" style="color:#4f46e5;word-break:break-all;">${meetLink}</a>
        </p>` : ""}

        <div style="background:#eef2ff;border-left:3px solid #4f46e5;border-radius:6px;padding:12px 14px;margin-top:20px;">
          <p style="color:#3730a3;font-size:13px;margin:0;line-height:1.5;">
            <strong>Tip:</strong> This meeting is on your calendar. You&rsquo;ll get a reminder an hour before.
          </p>
        </div>
      </div>

      <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">Sent via NextNote</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function encodeSubject(subject: string) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function encodeFromName(name: string) {
  if (/^[\x20-\x7E]*$/.test(name)) return `"${name.replace(/"/g, '\\"')}"`;
  return `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?=`;
}

function buildRawEmail(to: string, from: string, subject: string, html: string): string {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html, "utf8").toString("base64"),
    ``,
    `--${boundary}--`,
  ];
  const raw = lines.join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated with Google" }, { status: 401 });
  }

  const authSession = await getAuthSession();
  const hostName = authSession.name || authSession.agencyName || undefined;

  const { prospectName, prospectEmail, date, time, duration, agenda, meetLink } = await req.json();

  if (!prospectEmail || !prospectName) {
    return NextResponse.json({ error: "Missing prospectEmail or prospectName" }, { status: 400 });
  }

  const oauth2Client = await getAuthedGoogleClient(session);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const senderEmail = session.email || "me";
  const fromHeader = hostName && session.email
    ? `${encodeFromName(hostName)} <${session.email}>`
    : senderEmail;

  const html = buildEmailHtml({ prospectName, hostName, date, time, duration, agenda, meetLink });
  const subjectDate = new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const raw = buildRawEmail(
    prospectEmail,
    fromHeader,
    `Appointment confirmed — ${subjectDate} at ${formatTime12h(time)}`,
    html,
  );

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return googleReconnectResponse();
    }
    console.error("Gmail send error:", error);
    return NextResponse.json({ error: "Failed to send confirmation email" }, { status: 500 });
  }
}
