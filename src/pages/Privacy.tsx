import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" eyebrow="Legal · Privacy">
      <LegalSection title="1. Who We Are">
        StreamVista Cloud X is owned by <strong className="text-foreground">StreamVista OPC Pvt Ltd</strong>{" "}
        and operated by <strong className="text-foreground">Crayons Pictures</strong>, with operations
        headquartered in Ernakulam, Kerala, India. This Privacy Policy explains how we collect, use,
        and protect your information.
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

      <LegalSection title="4. Storage on Oracle Cloud">
        All User Content is stored on <strong className="text-foreground">Oracle Cloud Infrastructure</strong>{" "}
        object storage with server-side AES-256 encryption at rest and TLS 1.2+ in transit. Access
        is mediated by short-lived pre-authenticated requests; raw bucket credentials are never
        exposed to the browser. Backups and lifecycle policies follow Oracle's enterprise SLA of
        99.9% uptime.
      </LegalSection>

      <LegalSection title="5. How We Use Data">
        To operate the Service, process payments, deliver notifications, prevent abuse, comply with
        legal obligations, and improve the platform. We do not sell personal data.
      </LegalSection>

      <LegalSection title="6. Sharing">
        We share data only with vetted processors strictly required for operation — payment
        gateways, email delivery, telephony, analytics, and Oracle Cloud — each bound by data
        processing agreements.
      </LegalSection>

      <LegalSection title="7. Your Rights">
        You may request access, correction, export, or deletion of your personal data by writing to{" "}
        <a className="text-accent hover:underline" href="mailto:support@streamvistacreator.com">
          support@streamvistacreator.com
        </a>
        . We respond within 30 days.
      </LegalSection>

      <LegalSection title="8. Retention">
        Account and content data is retained while your workspace is active and for up to 90 days
        thereafter to enable recovery, after which it is permanently purged from primary and backup
        stores.
      </LegalSection>

      <LegalSection title="9. Jurisdiction">
        This policy is governed by Indian law. Disputes are subject to the courts of Ernakulam,
        Kerala, India.
      </LegalSection>
    </LegalLayout>
  );
}
