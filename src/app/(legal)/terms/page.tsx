import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — NextNote",
  description: "The terms that govern your use of NextNote.",
};

const EFFECTIVE_DATE = "April 22, 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="legal-meta">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        Welcome to NextNote. These Terms of Service (&quot;Terms&quot;) are a binding agreement between
        you (&quot;you,&quot; &quot;Customer&quot;) and Apex Studio, the operator of NextNote (&quot;NextNote,&quot; &quot;we,&quot;
        &quot;us&quot;). By creating an account or using the Service, you agree to these Terms. If you do
        not agree, do not use the Service.
      </p>

      <h2>1. Account registration</h2>
      <ul>
        <li>You must be at least 18 years old and legally able to enter into contracts.</li>
        <li>You&apos;re responsible for the accuracy of the information you provide and for keeping your credentials secret.</li>
        <li>You&apos;re responsible for everything that happens under your account. Notify us immediately at <a href="mailto:support@nextnote.to">support@nextnote.to</a> if you suspect unauthorized access.</li>
      </ul>

      <h2>2. The Service</h2>
      <p>
        NextNote provides a CRM and outbound sales platform including prospect management,
        appointment scheduling, voicemail drops, AI-generated websites, AI voice receptionists,
        and related features. The specific features available depend on the plan you&apos;re on and
        the credits in your account.
      </p>

      <h2>3. Acceptable use</h2>

      <p>You agree <strong>not</strong> to:</p>
      <ul>
        <li>Violate any law, including laws governing telemarketing, SMS/voicemail solicitation (e.g., the TCPA in the US), unsolicited email (CAN-SPAM), consumer protection, or data privacy.</li>
        <li>Send voicemails, calls, or emails to recipients who have not provided appropriate consent or who are on a do-not-contact list applicable to you.</li>
        <li>Impersonate any person or entity, including spoofing caller IDs you don&apos;t own or aren&apos;t authorized to use.</li>
        <li>Upload content you don&apos;t have the right to use, or that infringes anyone&apos;s rights.</li>
        <li>Send content that is harassing, threatening, obscene, deceptive, or promotes illegal activity.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service (except where expressly permitted by law).</li>
        <li>Use automated means to scrape or overload the Service.</li>
        <li>Resell access to the Service without a separate written agreement with us.</li>
        <li>Use the Service to build or train a competing AI model.</li>
      </ul>

      <p>
        <strong>You are solely responsible</strong> for confirming you have consent to contact every
        phone number, email address, or individual you load into NextNote. We provide tools; you
        operate them lawfully.
      </p>

      <h2>4. Credits, plans, and billing</h2>

      <h3>4.1 Credits</h3>
      <ul>
        <li>NextNote features are metered in credits. 1 credit equals $0.01 USD of retail value.</li>
        <li>Credits are prepaid and non-refundable except where required by law.</li>
        <li>Credits do not expire while your account is active. If your account is closed or terminated, unused credits are forfeited.</li>
        <li>Credits have no cash value and cannot be transferred between accounts.</li>
      </ul>

      <h3>4.2 Subscriptions</h3>
      <ul>
        <li>Subscription plans renew automatically at the end of each billing cycle until cancelled.</li>
        <li>You can cancel anytime from Dashboard → Billing. Cancellation takes effect at the end of the current billing cycle.</li>
        <li>We may change pricing with at least 30 days&apos; notice by email. Continued use after the new price takes effect constitutes acceptance.</li>
        <li>All fees are exclusive of taxes. You are responsible for any applicable sales, VAT, or similar taxes.</li>
      </ul>

      <h3>4.3 Phone numbers</h3>
      <ul>
        <li>Phone numbers purchased through NextNote are leased from our upstream telecom carrier and administered by NextNote on your behalf.</li>
        <li>The monthly rental fee is deducted in credits on the anniversary of purchase. If your balance is insufficient, the number is released and cannot be guaranteed to be recoverable.</li>
      </ul>

      <h3>4.4 Failed payments</h3>
      <p>
        If a payment fails, we&apos;ll retry per our dunning schedule. If the payment remains unpaid
        for 14 days, we may suspend the account. Suspended accounts retain data for 30 days
        before deletion.
      </p>

      <h2>5. Your content</h2>

      <p>
        You retain ownership of all data you upload to NextNote (&quot;Customer Data&quot;). You grant us a
        limited license to store, process, and display Customer Data as necessary to provide the
        Service, and to use aggregated, de-identified data to improve the Service. We do not use
        Customer Data to train generalized AI models, and we do not use Google user data for any
        AI training.
      </p>

      <h2>6. AI-generated output</h2>

      <p>
        When you use AI features (website generation, receptionist drafting, summarization, etc.),
        NextNote passes your prompts to third-party AI providers (currently Anthropic). Output is
        generated by those models and may contain inaccuracies. You are responsible for reviewing
        and verifying AI output before using it with prospects or customers.
      </p>

      <p>
        Subject to your compliance with these Terms, we assign to you all right, title, and
        interest we may have in AI output generated specifically for your prompts. You warrant
        that your prompts do not infringe any third-party rights.
      </p>

      <h2>7. Third-party services</h2>
      <p>
        NextNote integrates with third-party services (Google, Stripe, ElevenLabs, telecom carriers, etc.).
        Your use of those services is governed by their own terms and privacy policies. We are
        not responsible for third-party services, and their availability may change without
        notice.
      </p>

      <h2>8. Intellectual property</h2>
      <ul>
        <li>NextNote, the dashboard, the underlying software, and all related documentation are owned by Apex Studio and protected by intellectual property laws.</li>
        <li>We grant you a non-exclusive, non-transferable, revocable license to use the Service during your subscription term, solely as permitted by these Terms.</li>
        <li>Feedback you send us is non-confidential, and we may use it without restriction or compensation to you.</li>
      </ul>

      <h2>9. Service availability</h2>
      <p>
        We aim for high uptime but do not guarantee uninterrupted Service. We may perform
        maintenance, roll out updates, or experience outages. We&apos;ll use commercially reasonable
        efforts to minimize disruption.
      </p>

      <h2>10. Suspension and termination</h2>
      <ul>
        <li>You may stop using the Service or delete your account at any time.</li>
        <li>We may suspend or terminate your account if you materially breach these Terms, fail to pay, or if required by law. We&apos;ll give notice where feasible, but not where doing so would frustrate an active investigation of abuse or fraud.</li>
        <li>Upon termination, Sections 4 (for accrued fees), 5, 8, 11, 12, 13, and 14 survive.</li>
      </ul>

      <h2>11. Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY
        LAW, NEXTNOTE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
        WILL BE ERROR-FREE, SECURE, OR UNINTERRUPTED.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXTNOTE SHALL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES; LOSS OF PROFITS, REVENUE, DATA,
        OR BUSINESS OPPORTUNITIES; OR ANY OTHER DAMAGES IN EXCESS OF THE GREATER OF (a) THE FEES
        YOU PAID TO NEXTNOTE IN THE 12 MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE
        CLAIM, OR (b) ONE HUNDRED US DOLLARS ($100).
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless NextNote and its affiliates, officers,
        employees, and agents from any claims, damages, liabilities, and expenses (including
        reasonable attorneys&apos; fees) arising out of (a) Customer Data, (b) your use of the Service,
        (c) your violation of these Terms, or (d) your violation of any law or third-party right,
        including without limitation telemarketing, anti-spam, and data-protection laws.
      </p>

      <h2>14. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to
        conflict-of-law principles. Any dispute shall be resolved exclusively in the state or
        federal courts located in Delaware, and you consent to that jurisdiction.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be announced by email
        to your account address and/or a prominent notice in the dashboard at least 14 days
        before they take effect. Your continued use after the effective date constitutes
        acceptance.
      </p>

      <h2>16. Miscellaneous</h2>
      <ul>
        <li>If any provision of these Terms is held unenforceable, the rest remains in effect.</li>
        <li>Our failure to enforce a provision is not a waiver of our right to enforce it later.</li>
        <li>You may not assign these Terms without our written consent. We may assign them in connection with a merger, acquisition, or sale of assets.</li>
        <li>These Terms, together with the Privacy Policy, are the entire agreement between us regarding the Service.</li>
      </ul>

      <h2>17. Contact</h2>
      <p>
        Questions? Email <a href="mailto:support@nextnote.to">support@nextnote.to</a>.
      </p>
    </>
  );
}
