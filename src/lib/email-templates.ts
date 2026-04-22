import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@nextnote.to";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nextnote.to";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  return resend.emails.send({
    from: `NextNote <${FROM_EMAIL}>`,
    to: [params.to],
    replyTo: FROM_EMAIL,
    subject: params.subject,
    text: params.text,
    html: params.html,
    headers: {
      "List-Unsubscribe": `<mailto:${FROM_EMAIL}?subject=unsubscribe>`,
    },
  });
}

const LOGO_MARKUP = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr>
    <td align="center" valign="middle" width="92" height="92" bgcolor="#ff8e6b" style="background:linear-gradient(135deg,#ffa184 0%,#ff7551 100%);background-color:#ff8e6b;width:92px;height:92px;border-radius:22px;-webkit-border-radius:22px;-moz-border-radius:22px;padding:6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
        <tr>
          <td align="center" valign="middle" width="80" height="80" style="border:1.5px solid #ffffff;border-radius:50%;-webkit-border-radius:50%;-moz-border-radius:50%;width:80px;height:80px;padding:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                <td align="center" valign="middle" width="60" height="60" style="border:1.5px solid #ffffff;border-radius:50%;-webkit-border-radius:50%;-moz-border-radius:50%;width:60px;height:60px;padding:0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td align="center" valign="middle" width="42" height="42" bgcolor="#e8553d" style="background-color:#e8553d;width:42px;height:42px;border-radius:50%;-webkit-border-radius:50%;-moz-border-radius:50%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ffffff;font-weight:900;font-size:22px;line-height:42px;text-align:center;">
                        <span style="color:#ffffff;font-weight:900;font-size:22px;line-height:42px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">N</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

export function renderLayout(opts: {
  preheader: string;
  bodyHtml: string;
}) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="only light" />
  <meta name="supported-color-schemes" content="only light" />
  <title>NextNote</title>
  <!--[if mso]>
  <style type="text/css">
    table, td, div, h1, h2, p { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: only light; supported-color-schemes: only light; }
    @media only screen and (max-width: 620px) {
      .nn-container { width: 100% !important; max-width: 100% !important; }
      .nn-card { padding: 28px 22px !important; }
      .nn-heading { font-size: 22px !important; }
      .nn-outer { padding: 24px 10px !important; }
      .nn-feature-label { font-size: 13px !important; }
    }
    /* Prevent Gmail dark-mode color inversion */
    [data-ogsc] .nn-logo { color-scheme: only light !important; }
    u + .body .nn-logo { color-scheme: only light !important; }
    a { color: #ff8a6a; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#050507;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">
    ${opts.preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="nn-outer" style="background-color:#050507;padding:48px 20px;">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr><td>
        <![endif]-->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="nn-container" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding:0 0 28px;">
              ${LOGO_MARKUP}
            </td>
          </tr>
          <tr>
            <td class="nn-card" bgcolor="#101018" style="background-color:#101018;border:1px solid #2a1a18;border-radius:14px;padding:40px 40px;">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 12px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#71717a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <span style="color:#f4f4f5;font-weight:600;">NextNote</span> &mdash; the pipeline and prospect platform for modern agencies.
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#52525b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <a href="${APP_URL}" style="color:#71717a;text-decoration:none;">nextnote.to</a> &middot; &copy; ${new Date().getFullYear()} NextNote. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
          </td></tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderVerificationEmail(verifyUrl: string) {
  const body = `
    <h1 class="nn-heading" style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:600;color:#fafafa;letter-spacing:-0.02em;line-height:1.3;">
      Confirm your email address
    </h1>
    <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#a1a1aa;">
      Welcome to NextNote. Click the button below to verify your email and finish setting up your account.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td bgcolor="#e8553d" style="background-color:#e8553d;border-radius:10px;">
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.005em;">
            Verify email address
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#71717a;">
      Or paste this URL into your browser:
    </p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;word-break:break-all;">
      <a href="${verifyUrl}" style="color:#a1a1aa;text-decoration:underline;">${verifyUrl}</a>
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
      <tr><td height="1" bgcolor="#2a1a18" style="background-color:#2a1a18;height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr>
    </table>
    <p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#71717a;">
      This link expires in <strong style="color:#a1a1aa;">1 hour</strong>. If you didn&rsquo;t create a NextNote account, you can safely ignore this email.
    </p>
  `;

  const html = renderLayout({
    preheader: "Confirm your email to activate your NextNote account. Link expires in 1 hour.",
    bodyHtml: body,
  });

  const text = `Confirm your email address

Welcome to NextNote. Click the link below to verify your email and finish setting up your account:

${verifyUrl}

This link expires in 1 hour. If you didn't create a NextNote account, you can safely ignore this email.

© ${new Date().getFullYear()} NextNote`;

  return { html, text };
}

type PlanKey = "starter" | "pro";

const PLAN_DETAILS: Record<PlanKey, { name: string; price: string; credits: string; features: string[] }> = {
  starter: {
    name: "Starter",
    price: "$29/month",
    credits: "150 AI credits",
    features: [
      "Basic CRM &amp; prospect pipeline",
      "Folders and lead organization",
      "Manual lead entry",
      "Appointment booking",
      "Up to 100 prospects, 5 folders",
      "150 AI credits included",
    ],
  },
  pro: {
    name: "Pro",
    price: "$79/month",
    credits: "350 AI credits (250 + 100 upgrade bonus)",
    features: [
      "Everything in Starter",
      "AI summaries &amp; insights",
      "Spreadsheet import (XLSX)",
      "Google Calendar sync",
      "Voicemail drop tools",
      "Up to 1,000 prospects, 25 folders",
    ],
  },
};

export function renderWelcomeEmail(planKey: PlanKey) {
  const plan = PLAN_DETAILS[planKey];
  const dashboardUrl = `${APP_URL}/dashboard`;

  const featuresRows = plan.features
    .map(
      (f) => `
      <tr>
        <td width="22" valign="top" style="padding:8px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#2a1510" style="background-color:#2a1510;width:16px;height:16px;border-radius:8px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#ff8a6a;line-height:16px;">&#10003;</td></tr>
          </table>
        </td>
        <td class="nn-feature-label" style="padding:8px 0 8px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#d4d4d8;">${f}</td>
      </tr>`
    )
    .join("");

  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr>
        <td bgcolor="#2a1510" style="background-color:#2a1510;border:1px solid #3d1f18;border-radius:999px;padding:5px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#ff8a6a;letter-spacing:0.05em;text-transform:uppercase;">
          ${plan.name} Plan Active
        </td>
      </tr>
    </table>
    <h1 class="nn-heading" style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#fafafa;letter-spacing:-0.02em;line-height:1.25;">
      Welcome to the NextNote family 🎉
    </h1>
    <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#a1a1aa;">
      Your <strong style="color:#fafafa;">${plan.name}</strong> subscription is now active. We&rsquo;re pumped to have you on board &mdash; here&rsquo;s what you unlocked.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px;">
      <tr>
        <td bgcolor="#1a0e0c" style="background-color:#1a0e0c;border:1px solid #3d1f18;border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#ff8a6a;letter-spacing:0.06em;text-transform:uppercase;">Your plan</p>
          <p style="margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#fafafa;">${plan.name} &middot; ${plan.price}</p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#a1a1aa;">${plan.credits}</p>
        </td>
      </tr>
    </table>
    <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#fafafa;letter-spacing:-0.01em;">
      What&rsquo;s included
    </h2>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 32px;">
      ${featuresRows}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
      <tr>
        <td bgcolor="#e8553d" style="background-color:#e8553d;border-radius:10px;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:14px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.005em;">
            Go to your dashboard
          </a>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
      <tr><td height="1" bgcolor="#2a1a18" style="background-color:#2a1a18;height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr>
    </table>
    <p style="margin:20px 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#e4e4e7;">Need a hand?</p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Reply to this email any time and our team will get back to you. We&rsquo;re here to help you get your pipeline humming.
    </p>
  `;

  const html = renderLayout({
    preheader: `Your ${plan.name} plan is active — here's everything you unlocked.`,
    bodyHtml: body,
  });

  const text = `Welcome to the NextNote family!

Your ${plan.name} subscription (${plan.price}) is now active.

What's included:
${plan.features.map((f) => `- ${f.replace(/&amp;/g, "&")}`).join("\n")}

${plan.credits}

Go to your dashboard: ${dashboardUrl}

Need help? Just reply to this email.

© ${new Date().getFullYear()} NextNote`;

  return { html, text };
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const { html, text } = renderVerificationEmail(verifyUrl);
  return sendEmail({
    to,
    subject: "Verify your NextNote email",
    html,
    text,
  });
}

export async function sendWelcomeEmail(to: string, planKey: PlanKey) {
  const { html, text } = renderWelcomeEmail(planKey);
  const planName = PLAN_DETAILS[planKey].name;
  return sendEmail({
    to,
    subject: `Welcome to NextNote ${planName} 🎉`,
    html,
    text,
  });
}
