import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — NextNote",
  description: "How NextNote collects, uses, and protects your data.",
};

const EFFECTIVE_DATE = "April 22, 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        NextNote (&quot;NextNote,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a product of Apex Studio. This Privacy Policy
        explains what information we collect when you use <strong>nextnote.to</strong>, our dashboard,
        and any related APIs (together, the &quot;Service&quot;), how we use it, who we share it with,
        and the choices you have.
      </p>

      <p>
        NextNote is a sales operating system for agencies and outbound teams. To provide that
        service, we store the prospect data you upload, the call and voicemail activity you
        generate, and — if you connect them — data from third-party accounts like Google Calendar
        and Gmail.
      </p>

      <h2>1. Information we collect</h2>

      <h3>1.1 Information you give us</h3>
      <ul>
        <li><strong>Account information</strong> — name, email address, hashed password, and any profile details you add.</li>
        <li><strong>Billing information</strong> — handled by Stripe. We store the last 4 digits of your card and your Stripe customer ID; we never see or store full card numbers.</li>
        <li><strong>Prospect and pipeline data</strong> — contacts, phone numbers, emails, notes, tags, appointments, and any files you upload.</li>
        <li><strong>Voice and audio</strong> — voicemail recordings you upload or record through the browser, and inbound/outbound call metadata (not call content) from our phone network.</li>
        <li><strong>Support communications</strong> — messages you send to our support chat or email.</li>
      </ul>

      <h3>1.2 Information from connected services</h3>
      <ul>
        <li><strong>Google (Calendar + Gmail send + profile)</strong> — if you connect your Google account, we receive an OAuth refresh token and use it to read and write calendar events, send emails on your behalf, and display your Google profile name and email. We store the refresh token encrypted at rest.</li>
        <li><strong>Telecom carrier</strong> — phone numbers you purchase or port through NextNote, verified caller IDs, and the delivery status of voicemail drops and calls.</li>
        <li><strong>ElevenLabs / Retell</strong> — AI agent configurations, conversation transcripts, and call recordings associated with voice agents you build.</li>
      </ul>

      <h3>1.3 Information collected automatically</h3>
      <ul>
        <li><strong>Usage telemetry</strong> — pages viewed, features used, errors encountered.</li>
        <li><strong>Device and log data</strong> — IP address, browser type, OS, and referring URL.</li>
        <li><strong>Cookies</strong> — a session cookie (encrypted via <code>iron-session</code>) to keep you signed in. We do not use third-party advertising cookies.</li>
      </ul>

      <h2>2. Google User Data — Limited Use disclosure</h2>

      <div className="callout">
        <strong>NextNote&apos;s use and transfer to any other app of information received from Google
        APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>, including the Limited Use requirements.</strong>
      </div>

      <p>Specifically, data obtained through Google OAuth is used only to:</p>
      <ul>
        <li>Display your Google profile (name, email, avatar) inside NextNote so you can confirm which account is connected.</li>
        <li>Read, create, update, and delete events on calendars you authorize, to power appointment booking and rescheduling.</li>
        <li>Send emails from your Gmail address when you explicitly trigger a send (e.g., an appointment confirmation).</li>
      </ul>

      <p>We do <strong>not</strong>:</p>
      <ul>
        <li>Transfer Google user data to third parties except as needed to provide the Service, to comply with applicable law, or as part of a merger or acquisition.</li>
        <li>Use Google user data to serve advertising.</li>
        <li>Allow humans to read Google user data unless (a) we have your explicit consent for specific messages, (b) it is necessary for security purposes such as investigating abuse, (c) it is necessary to comply with law, or (d) the data has been aggregated and anonymized for internal operations.</li>
        <li>Use Google user data to develop, improve, or train generalized or non-personalized AI or machine-learning models.</li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>Provide, operate, and maintain the Service.</li>
        <li>Authenticate you and keep your account secure.</li>
        <li>Process payments and manage credit balances.</li>
        <li>Send operational emails (receipts, security notices, product updates you can unsubscribe from).</li>
        <li>Power AI features you request — generating websites, summarizing notes, drafting receptionist scripts, parsing uploaded files.</li>
        <li>Detect abuse, fraud, and violations of our Terms of Service.</li>
        <li>Improve the Service (aggregated/anonymized analytics only — not Google user data).</li>
      </ul>

      <h2>4. How we share your information</h2>

      <p>We share personal information only with the sub-processors below, each bound by a data-processing agreement:</p>

      <ul>
        <li><strong>Supabase</strong> — primary database, authentication, and file storage.</li>
        <li><strong>Vercel</strong> — application hosting and serverless functions.</li>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Telecom carrier</strong> — phone number provisioning, voice calls, voicemail delivery.</li>
        <li><strong>ElevenLabs</strong> — AI voice agents and text-to-speech.</li>
        <li><strong>Deepgram</strong> — speech-to-text transcription for voice features.</li>
        <li><strong>Retell AI</strong> — optional AI voice agent runtime (only if you configure it).</li>
        <li><strong>Anthropic</strong> — Claude models used for AI features (website generation, receptionist drafting, summarization, support assistant).</li>
        <li><strong>Google</strong> — Calendar and Gmail APIs, only with your explicit OAuth consent.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
      </ul>

      <p>
        We may disclose information to comply with a lawful request (subpoena, court order, etc.),
        to protect the rights, property, or safety of NextNote, our users, or the public, or in
        connection with a corporate transaction such as a merger or acquisition (in which case
        we&apos;ll notify affected users in advance).
      </p>

      <p>We do not sell your personal information.</p>

      <h2>5. Data retention</h2>
      <ul>
        <li>Account data is retained for as long as your account is active.</li>
        <li>Deleted prospects, notes, and recordings are purged from primary storage within 30 days and from backups within 90 days.</li>
        <li>Billing records are retained for at least 7 years to comply with tax and accounting laws.</li>
        <li>You can delete your account at any time from Dashboard → Settings → Danger Zone. Upon deletion we erase or irreversibly anonymize your personal data on the schedule above.</li>
      </ul>

      <h2>6. Your rights</h2>

      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete your personal information.</li>
        <li>Export a portable copy of your data.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Withdraw consent at any time for OAuth-connected services (disconnect them in Settings → Integrations, or revoke at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>).</li>
        <li>Lodge a complaint with your local data-protection authority.</li>
      </ul>

      <p>To exercise any of these rights, email <a href="mailto:privacy@nextnote.to">privacy@nextnote.to</a>. We respond within 30 days.</p>

      <h2>7. Security</h2>
      <ul>
        <li>Data in transit is encrypted with TLS 1.2+.</li>
        <li>Data at rest is encrypted by our cloud providers (Supabase/AWS).</li>
        <li>OAuth refresh tokens and API keys you supply are encrypted at the application layer using a dedicated key.</li>
        <li>Passwords are hashed with industry-standard algorithms — we can never see your plaintext password.</li>
        <li>Access to production systems is restricted to authorized personnel and logged.</li>
      </ul>

      <p>No system is 100% secure. If we become aware of a breach affecting your data, we will notify you in line with applicable law.</p>

      <h2>8. Children</h2>
      <p>NextNote is not directed to anyone under 18. We do not knowingly collect personal data from minors. If you believe a child has given us their data, email us and we&apos;ll delete it.</p>

      <h2>9. International transfers</h2>
      <p>
        NextNote is operated from the United States. If you are located outside the US, your
        information will be transferred to and processed in the US and other countries where our
        sub-processors operate. We rely on standard contractual clauses or other appropriate
        safeguards where required.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be announced
        by email to your account address and/or a prominent notice in the dashboard at least 14
        days before they take effect. Your continued use after the effective date constitutes
        acceptance of the revised policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions, requests, or concerns? Email{" "}
        <a href="mailto:privacy@nextnote.to">privacy@nextnote.to</a> or write to:
      </p>
      <p>
        Apex Studio — NextNote<br />
        Privacy Team<br />
        <a href="mailto:support@nextnote.to">support@nextnote.to</a>
      </p>
    </>
  );
}
