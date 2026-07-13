import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";
import { Seo } from "@/components/Seo";

export default function Privacy() {
  return (
    <>
      <Seo title="Privacy Policy — StreamVista Cloud X" description="How StreamVista collects, uses and protects your account, billing and content data on StreamVista Cloud X." path="/privacy" />
    <LegalLayout title="Privacy Policy" eyebrow="Legal · Privacy">

      <LegalSection title="1. Who We Are & Controller Status">
        StreamVista Cloud X is owned by <strong className="text-foreground">StreamVista OPC Pvt Ltd</strong>{" "}
        and operated by <strong className="text-foreground">Crayons Pictures</strong>, with operations
        headquartered in Ernakulam, Kerala, India. Crayons Pictures acts as the{" "}
        <strong className="text-foreground">data controller</strong> for personal data collected through
        the Service and determines the purposes and means of its processing. This Privacy Policy
        explains how we collect, use, and protect your information. This page is maintained by
        Crayons Pictures to answer common privacy questions about StreamVista Cloud X.
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <ul className="list-disc pl-6 space-y-1">
          <li>Account data: name, email, password hash, role, and workspace metadata.</li>
          <li>Contact data: optional phone number, studio or business identifiers.</li>
          <li>Billing data: payment identifiers and invoice metadata (no full card numbers).</li>
          <li>Usage data: logs, device, IP, browser, and feature interactions.</li>
          <li>User Content: media assets, project files, and derivative artifacts you upload.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Authentication & Account Security">
        Authentication is handled via industry-standard JWT sessions issued by our managed identity
        layer. Passwords are stored only as salted hashes; we never see your raw password. Optional
        social sign-in providers may share verified email and profile only.
      </LegalSection>

      <LegalSection title="4. Storage on C CLOUD">
        All User Content is stored on <strong className="text-foreground">C CLOUD Infrastructure</strong>{" "}
        object storage with server-side AES-256 encryption at rest and TLS 1.2+ in transit. Access
        is mediated by short-lived pre-authenticated requests; raw bucket credentials are never
        exposed to the browser. Backups and lifecycle policies follow C CLOUD's enterprise SLA of
        99.9% uptime.
      </LegalSection>

      <LegalSection title="5. How We Use Data & Legal Basis">
        We process personal data to operate the Service, process payments, deliver notifications,
        prevent abuse, comply with legal obligations, and improve the platform. We do not sell
        personal data. Our legal bases for processing are:
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong className="text-foreground">Performance of a contract</strong> — to provide
            the Service, authenticate your account, store and deliver your User Content, and
            fulfil paid subscriptions.</li>
          <li><strong className="text-foreground">Legitimate interests</strong> — to secure the
            platform, prevent fraud and abuse, monitor performance, and improve features.</li>
          <li><strong className="text-foreground">Consent</strong> — for optional communications
            and cookies that are not strictly necessary, where required.</li>
          <li><strong className="text-foreground">Legal obligation</strong> — to comply with tax,
            accounting, and statutory recordkeeping requirements.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Sharing & Subprocessors">
        We share personal data only with vetted recipients strictly required to operate the
        Service, each bound by data processing agreements. Categories of recipients include:
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong className="text-foreground">Paddle.com Market Ltd</strong> — our payment
            provider and <strong className="text-foreground">Merchant of Record</strong> for
            card-based subscriptions and one-time purchases. Paddle processes order, billing,
            tax, and subscription-management data on its own behalf as the seller-of-record, and
            handles refunds and billing support. See{" "}
            <a className="text-accent hover:underline" href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              Paddle's Privacy Notice
            </a>.
          </li>
          <li>Razorpay — for INR domestic payment flows where applicable.</li>
          <li>C CLOUD Infrastructure — hosting and object storage of User Content.</li>
          <li>Email and telephony providers — for transactional notifications.</li>
          <li>Analytics and security tooling — to operate and protect the Service.</li>
          <li>Professional advisers and authorities — where required by law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Your Rights">
        Subject to applicable law, you may request access, correction, export, restriction, or
        deletion of your personal data, object to processing, or withdraw consent at any time by
        writing to{" "}
        <a className="text-accent hover:underline" href="mailto:support@streamvista.in">
          support@streamvista.in
        </a>
        . We respond within 30 days. For payment-specific data held by Paddle as MoR, you may also
        contact Paddle directly via{" "}
        <a className="text-accent hover:underline" href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">
          paddle.com
        </a>.
      </LegalSection>

      <LegalSection title="8. Retention">
        Account and content data is retained while your workspace is active and for up to 90 days
        thereafter to enable recovery, after which it is permanently purged from primary and backup
        stores. Payment, tax and invoicing records may be retained longer where required by law.
      </LegalSection>

      <LegalSection title="9. Security">
        We apply appropriate technical and organisational measures, including AES-256 encryption at
        rest, TLS 1.2+ in transit, role-based access controls, audit logging, and short-lived
        access tokens for storage operations.
      </LegalSection>

      <LegalSection title="10. Jurisdiction">
        This policy is governed by Indian law. Disputes are subject to the courts of Ernakulam,
        Kerala, India.
      </LegalSection>
    </LegalLayout>
    </>
  );
}
