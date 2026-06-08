import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";

export default function Refund() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" eyebrow="Legal · Billing">
      <LegalSection title="1. Overview">
        StreamVista Cloud X is a Software-as-a-Service (SaaS) platform. Because storage capacity,
        bandwidth, and infrastructure resources are reserved and allocated on Oracle Cloud at the
        moment your subscription is activated, fees are generally non-refundable once provisioning
        has occurred.
      </LegalSection>

      <LegalSection title="2. 7-Day Cancellation Window">
        New paid subscriptions may be cancelled for a full refund within{" "}
        <strong className="text-foreground">seven (7) calendar days</strong> of the original
        purchase date, provided that:
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Less than 10% of allocated storage has been consumed; and</li>
          <li>No outbound delivery, sharing, or transcoding quota has been substantially used; and</li>
          <li>The request is sent from the registered account email.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. No-Refund After Allocation">
        After the 7-day window, or after storage has been materially consumed, all fees become{" "}
        <strong className="text-foreground">non-refundable</strong>. You may cancel renewal at any
        time from your dashboard; cancellation stops future billing but does not refund the current
        cycle.
      </LegalSection>

      <LegalSection title="4. Free Tier">
        The Free tier carries no charge and therefore no refund. Free workspaces may be archived
        after extended inactivity per our retention policy.
      </LegalSection>

      <LegalSection title="5. Failed Payments & Chargebacks">
        Repeated failed payments or unjustified chargebacks may result in immediate suspension and
        potential termination of the workspace and its stored assets.
      </LegalSection>

      <LegalSection title="6. How to Request a Refund">
        Email{" "}
        <a className="text-accent hover:underline" href="mailto:support@streamvistacreator.com">
          support@streamvistacreator.com
        </a>{" "}
        from your registered account with your order ID and reason. Approved refunds are processed
        to the original payment method within 7–10 business days.
      </LegalSection>

      <LegalSection title="7. Jurisdiction">
        This policy is governed by the laws of India and subject to the courts of Ernakulam,
        Kerala.
      </LegalSection>
    </LegalLayout>
  );
}
