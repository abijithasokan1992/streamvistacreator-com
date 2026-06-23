import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";
import { TrustBadges } from "@/components/streamvista/TrustBadges";
import { Seo } from "@/components/Seo";
import EcosystemAbout from "@/components/about/EcosystemAbout";

export default function About() {
  return (
    <>
      <Seo
        title="About StreamVista Ecosystem — Founder & Brands"
        description="StreamVista OPC Pvt Ltd, Crayons Pictures, Crayons Bridge, Crayons Loop and founder Abijith Asokan — the integrated media infrastructure ecosystem."
        path="/about"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "StreamVista OPC Pvt Ltd",
            url: "https://streamvistacreator.com/about",
            email: "support@streamvistacreator.com",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Ernakulam",
              addressRegion: "Kerala",
              addressCountry: "IN",
            },
            openingHours: "Mo-Sa 10:00-19:00",
            parentOrganization: {
              "@type": "Organization",
              name: "StreamVista",
              url: "https://streamvistacreator.com/",
            },
          },
        ]}
      />
      <main className="container py-12 md:py-16 max-w-6xl">
        <EcosystemAbout />
      </main>
      <LegalLayout title="Support & Company Details" eyebrow="Company · Support" headingAs="h2">
        <LegalSection title="Registered entity">
          StreamVista OPC Pvt Ltd is an India-registered private company headquartered in{" "}
          <strong className="text-foreground">Ernakulam, Kerala</strong>. It owns and develops the
          StreamVista Cloud X platform.
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
            <div><span>Hours:</span> Monday – Saturday · 10:00 – 19:00 IST</div>
            <div><span>Address:</span> Ernakulam, Kerala, India</div>
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
