import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Hero } from "@/components/streamvista/Hero";
import { Workflow } from "@/components/streamvista/Workflow";
import { PlatformOverview } from "@/components/streamvista/PlatformOverview";
import { SupportedContent } from "@/components/streamvista/SupportedContent";
import { RightsDistribution } from "@/components/streamvista/RightsDistribution";
import { AIContentLicensingSection } from "@/components/home/AIContentLicensingSection";
import { FinalCta } from "@/components/streamvista/FinalCta";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={dashboardForRole(role)} replace />;

  return (
    <main className="min-h-dvh home-serif">
      <Seo
        title="StreamVista — Film Sales, Content Licensing & OTT Distribution Network"
        description="Connect films, series and screen content with verified OTT platforms, broadcasters, satellite TV, FAST channels, distributors and streaming services worldwide. StreamVista supports rights-ready catalogues, buyer discovery and professional delivery workflows."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "StreamVista",
            alternateName: "StreamVista Global Film Content Network",
            url: "https://streamvista.in/",
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "StreamVista",
            alternateName: "StreamVista Global Film Content Network",
            url: "https://streamvista.in/",
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Film Sales, Content Licensing & OTT Distribution Connectivity",
            description:
              "Connectivity and workflow platform linking creators, filmmakers, producers, studios and rights holders with OTT platforms, broadcasters, satellite TV, FAST channels, distributors and digital streaming services worldwide.",
            provider: {
              "@type": "Organization",
              name: "StreamVista",
              url: "https://streamvista.in/",
            },
            areaServed: "Worldwide",
          },
        ]}
      />
      <Navbar />
      <Hero />
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
