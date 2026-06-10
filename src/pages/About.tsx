import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";
import { TrustBadges } from "@/components/streamvista/TrustBadges";
import { Seo } from "@/components/Seo";

export default function About() {
  return (
    <>
      <Seo title="About StreamVista & Support — Crayons Pictures" description="StreamVista OPC Pvt Ltd and Crayons Pictures: who we are, what we build, and how to reach support for StreamVista Cloud X." path="/about" />
    <LegalLayout title="About Us & Support" eyebrow="Company · Support">

      <LegalSection title="StreamVista OPC Pvt Ltd">
        StreamVista OPC Pvt Ltd is an India-registered private company headquartered in{" "}
        <strong className="text-foreground">Ernakulam, Kerala</strong>. It owns and develops the
        StreamVista Cloud X platform — a premium production-grade cloud workspace built for
        filmmakers, studios, agencies, and independent creators.
      </LegalSection>

      <LegalSection title="Crayons Pictures">
        StreamVista Cloud X is operated by <strong className="text-foreground">Crayons Pictures</strong>,
        a creative production house with deep roots in film, design, and post-production. Crayons
        Pictures brings hands-on studio expertise to the product, shaping a tool that mirrors the
        real workflow of working creators rather than a generic file-store.
      </LegalSection>

      <LegalSection title="What We Build">
        A secure, cinematic, and frictionless cloud studio: enterprise-grade storage on C CLOUD,
        Cloud, controlled sharing, DMCA-respecting distribution, and pricing that scales from a
        free tier to full production capacity.
      </LegalSection>

      <LegalSection title="Trust & Security">
        <TrustBadges className="mt-2" />
      </LegalSection>

      <LegalSection title="Support">
        <div className="space-y-1">
          <div>
            <span>Email:</span>{" "}
            <a className="text-accent hover:underline" href="mailto:support@streamvistacreator.com">
              support@streamvistacreator.com
            </a>
          </div>
          <div>
            <span>Hours:</span> Monday – Saturday · 10:00 – 19:00 IST
          </div>
          <div>
            <span>Address:</span> Ernakulam, Kerala, India
          </div>
        </div>
        <p className="text-xs mt-3">
          For copyright takedowns please see our IP & Copyright (DMCA) Policy. For billing
          questions, see the Refund & Cancellation Policy.
        </p>
      </LegalSection>
    </LegalLayout>
    </>
  );
}
