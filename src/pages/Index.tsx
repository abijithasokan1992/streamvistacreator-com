import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { TrustedDistributionPartners } from "@/components/streamvista/TrustedDistributionPartners";
import { Workflow } from "@/components/streamvista/Workflow";
import { PlatformOverview } from "@/components/streamvista/PlatformOverview";
import { SupportedContent } from "@/components/streamvista/SupportedContent";
import { RightsDistribution } from "@/components/streamvista/RightsDistribution";
import { AIContentLicensingSection } from "@/components/home/AIContentLicensingSection";
import { FinalCta } from "@/components/streamvista/FinalCta";
import { Footer } from "@/components/streamvista/Footer";
import { TrustBadges } from "@/components/streamvista/TrustBadges";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh home-serif">
      <Seo
        title="StreamVista — License Your Film, Series or Documentary"
        description="Upload your content, protect your rights and connect with verified buyers. License films, series and documentaries globally through one secure platform."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            url: "https://streamvista.in/",
          },
        ]}
      />
      <Navbar />
      <Hero />
      <TrustedDistributionPartners />
      <section className="border-b border-border/40 bg-background/60">
        <div className="container py-6">
          <TrustBadges compact className="justify-center" />
        </div>
      </section>
      <Workflow />
      <PlatformOverview />
      <SupportedContent />
      <RightsDistribution />
      <AIContentLicensingSection />
      <FinalCta />
      <Footer />
    </main>
  );
};

export default Index;
