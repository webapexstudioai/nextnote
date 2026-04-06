import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { getSession } from "@/lib/session";

function buildEmailHtml(params: {
  prospectName: string;
  date: string;
  time: string;
  duration: number;
  agenda?: string;
  meetLink?: string;
}) {
  const { prospectName, date, time, duration, agenda, meetLink } = params;
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
    <h1 style="color: #111827; font-size: 24px; margin: 0 0 8px;">Appointment Confirmed</h1>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Hi ${prospectName}, your meeting has been scheduled.</p>

    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 100px;">Date</td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Time</td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${time}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Duration</td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${duration} minutes</td>
        </tr>
        ${agenda ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Agenda</td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px;">${agenda}</td>
        </tr>` : ""}
      </table>
    </div>

    ${meetLink ? `
    <a href="${meetLink}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
      Join Google Meet
    </a>
    <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">
      Or copy this link: <a href="${meetLink}" style="color: #4f46e5;">${meetLink}</a>
    </p>` : ""}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via NextNote</p>
  </div>
</body>
</html>`;
}

function buildRawEmail(to: string, from: string, subject: string, html: string): string {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString("base64"),
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

  const { prospectName, prospectEmail, date, time, duration, agenda, meetLink } = await req.json();

  if (!prospectEmail || !prospectName) {
    return NextResponse.json({ error: "Missing prospectEmail or prospectName" }, { status: 400 });
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const senderEmail = session.email || "me";

  const html = buildEmailHtml({ prospectName, date, time, duration, agenda, meetLink });
  const raw = buildRawEmail(
    prospectEmail,
    senderEmail,
    `Appointment Confirmed — ${new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`,
    html,
  );

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gmail send error:", error);
    return NextResponse.json({ error: "Failed to send confirmation email" }, { status: 500 });
  }
}
