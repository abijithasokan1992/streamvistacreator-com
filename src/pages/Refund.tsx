import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";
import { Seo } from "@/components/Seo";

export default function Refund() {
  return (
    <>
      <Seo
        title="Refund & Cancellation Policy — StreamVista Cloud X"
        description="StreamVista Cloud X refund and cancellation policy, including the 30-day money-back guarantee for new paid subscriptions and how Paddle handles refunds as Merchant of Record."
        path="/refund"
      />
      <LegalLayout title="Refund & Cancellation Policy" eyebrow="Legal · Billing">
        <LegalSection title="1. Overview">
          StreamVista Cloud X is operated by <strong className="text-foreground">Crayons Pictures</strong>{" "}
          (StreamVista OPC Pvt Ltd). Card-based subscriptions and one-time purchases on the
          platform are sold and processed by{" "}
          <strong className="text-foreground">Paddle.com Market Ltd ("Paddle")</strong> as our
          Merchant of Record. This page explains how refunds and cancellations work and how to
          request one. This page is maintained by Crayons Pictures.
        </LegalSection>

        <LegalSection title="2. 30-Day Money-Back Guarantee">
          We offer a <strong className="text-foreground">30-day money-back guarantee</strong> on
          new paid subscriptions and one-time storage block purchases. If you are not satisfied
          with your purchase, you may request a full refund within{" "}
          <strong className="text-foreground">thirty (30) calendar days</strong> of the original
          purchase date. Refunds are processed by Paddle, our payment provider and Merchant of
          Record, in line with{" "}
          <a
            className="text-accent hover:underline"
            href="https://www.paddle.com/legal/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Paddle's Refund Policy
          </a>
          .
        </LegalSection>

        <LegalSection title="3. How to Request a Refund">
          To request a refund for a card-based order, visit{" "}
          <a
            className="text-accent hover:underline"
            href="https://www.paddle.net"
            target="_blank"
            rel="noopener noreferrer"
          >
            paddle.net
          </a>{" "}
          and look up your order using the email address you checked out with, or contact our
          support team at{" "}
          <a className="text-accent hover:underline" href="mailto:support@streamvistacreator.com">
            support@streamvistacreator.com
          </a>{" "}
          and we will help coordinate the refund through Paddle. For INR domestic Razorpay
          transactions, please email support and we will process the refund directly. Approved
          refunds are returned to the original payment method, typically within 5–10 business
          days depending on your bank.
        </LegalSection>

        <LegalSection title="4. Cancelling a Subscription">
          You can cancel a recurring subscription at any time from your dashboard or from the
          billing portal linked in your purchase receipt. Cancellation stops future renewals;
          your access continues until the end of the current paid billing period. After the
          period ends, related entitlements (such as additional storage blocks) are removed.
        </LegalSection>

        <LegalSection title="5. Free Tier">
          The Free tier carries no charge and therefore no refund. Free workspaces may be
          archived after extended inactivity per our retention policy.
        </LegalSection>

        <LegalSection title="6. Failed Payments & Chargebacks">
          Repeated failed payments may result in suspension of paid features. Initiating an
          unjustified chargeback instead of requesting a refund through Paddle or our support
          team may result in suspension of the workspace; please contact us first so we can help.
        </LegalSection>

        <LegalSection title="7. Jurisdiction">
          This policy is governed by the laws of India and is subject to the courts of
          Ernakulam, Kerala, without prejudice to any mandatory consumer-protection rights you
          have in your country of residence, or to Paddle's obligations as Merchant of Record.
        </LegalSection>
      </LegalLayout>
    </>
  );
}
