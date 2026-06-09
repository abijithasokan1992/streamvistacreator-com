import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";
import { Seo } from "@/components/Seo";

export default function Terms() {
  return (
    <>
      <Seo title="Terms of Service — StreamVista Cloud X" description="Terms governing your use of the StreamVista Cloud X platform, operated by Crayons Pictures under StreamVista OPC Pvt Ltd." path="/terms" />
    <LegalLayout title="Terms of Service" eyebrow="Legal · Terms">

      <LegalSection title="1. Acceptance of Terms">
        These Terms of Service ("Terms") govern your access to and use of the StreamVista Cloud X
        platform ("Service"), owned by <strong className="text-foreground">StreamVista OPC Pvt Ltd</strong> and
        operated by <strong className="text-foreground">Crayons Pictures</strong>. By creating an account or
        using the Service you agree to be bound by these Terms.
      </LegalSection>

      <LegalSection title="2. Eligibility & Account">
        You must be at least 18 years of age and capable of forming a binding contract under
        applicable law. You are responsible for safeguarding your credentials and for all activity
        that occurs under your account.
      </LegalSection>

      <LegalSection title="3. Intellectual Property Ownership">
        <p>
          The Service, including all software, design, brand marks, UI, documentation, and
          underlying technology, is the exclusive property of StreamVista OPC Pvt Ltd and Crayons
          Pictures, and is protected by Indian and international copyright, trademark, and trade
          secret laws.
        </p>
        <p>
          <strong className="text-foreground">Your Content:</strong> You retain ownership of all
          original creative assets you upload ("User Content"). You grant StreamVista OPC Pvt Ltd a
          worldwide, royalty-free, non-exclusive licence to host, transcode, cache, and deliver your
          User Content solely for the purpose of operating the Service.
        </p>
        <p>
          <strong className="text-foreground">No transfer:</strong> Nothing in these Terms transfers
          any right, title, or interest in StreamVista IP to you. Reverse engineering, scraping,
          re-distribution, or white-labelling of the Service is strictly prohibited without prior
          written consent.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable Use">
        You agree not to upload unlawful, infringing, defamatory, or malicious content; not to
        attempt to disrupt or probe the Service; and not to use it to transmit malware or to
        circumvent content protections.
      </LegalSection>

      <LegalSection title="5. Plans, Billing & Suspension">
        Paid plans renew per the cycle selected at checkout. Failure of payment, abuse of the
        Service, or breach of these Terms may result in suspension or termination of your account
        and removal of stored assets.
      </LegalSection>

      <LegalSection title="6. Disclaimer & Limitation of Liability">
        The Service is provided on an "as-is" and "as-available" basis. To the maximum extent
        permitted by law, StreamVista OPC Pvt Ltd shall not be liable for any indirect, incidental,
        consequential, or punitive damages, and aggregate liability shall not exceed the fees paid
        by you for the Service during the three months preceding the claim.
      </LegalSection>

      <LegalSection title="7. Governing Law & Jurisdiction">
        These Terms are governed by the laws of India. The competent courts of
        <strong className="text-foreground"> Ernakulam, Kerala, India</strong> shall have exclusive
        jurisdiction over any dispute arising out of or in connection with these Terms.
      </LegalSection>

      <LegalSection title="8. Contact">
        Questions regarding these Terms may be sent to{" "}
        <a className="text-accent hover:underline" href="mailto:support@streamvistacreator.com">
          support@streamvistacreator.com
        </a>
        .
      </LegalSection>
    </LegalLayout>
    </>
  );
}
